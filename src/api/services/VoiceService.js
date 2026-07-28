import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import prisma from "../config/prisma.js";

const execFileAsync = promisify(execFile);

/**
 * VoiceService — voz do agente via Google Gemini (chave única global).
 *
 *  - transcribeAudio(buffer, mimeType): áudio → texto (STT). O Gemini entende
 *    áudio nativamente, então usamos o mesmo motor/uma única chave.
 *  - synthesizeSpeech(text, voiceName): texto → arquivo de áudio WAV (TTS) via
 *    modelo gemini-2.5-flash-preview-tts. Devolve o caminho relativo servido.
 *
 * A chave vem do PlatformSettings (admin) → env GEMINI_API_KEY. Nunca do tenant.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const STT_MODEL = "gemini-2.5-flash";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_VOICE = "Kore"; // voz neutra; boa em PT-BR

// Diretório para os áudios gerados. Usa o MESMO UPLOAD_DIR do StorageService
// (volume persistente em produção) para que a URL /api/uploads/… encontre o
// arquivo ao ser tocado no painel/webchat.
const AUDIO_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");

async function geminiKey() {
  try {
    const s = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    if (s?.geminiApiKey) return s.geminiApiKey;
  } catch { /* usa env */ }
  return process.env.GEMINI_API_KEY || null;
}

// Envolve PCM (16-bit LE, mono) em um cabeçalho WAV para virar arquivo tocável.
function pcmToWav(pcmBuffer, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

class VoiceService {
  /** Áudio → texto. Recebe Buffer + mimeType (ex.: "audio/ogg"). */
  async transcribeAudio(buffer, mimeType = "audio/ogg") {
    const key = await geminiKey();
    if (!key) { console.error("[Voice] Sem chave Gemini para transcrição."); return null; }
    try {
      const { data } = await axios.post(
        `${GEMINI_BASE}/${STT_MODEL}:generateContent?key=${key}`,
        {
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
              { text: "Transcreva este áudio em português do Brasil. Responda APENAS com o texto falado, sem comentários." },
            ],
          }],
        },
        { timeout: 60000 }
      );
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join(" ").trim();
      return text || null;
    } catch (e) {
      console.error("[Voice] Erro na transcrição:", e.response?.data?.error?.message || e.message);
      return null;
    }
  }

  /**
   * Lê/entende mídia (imagem, PDF, etc.) via Gemini multimodal e devolve um
   * resumo em texto para o agente usar. Recebe Buffer + mimeType + instrução.
   */
  async describeMedia(buffer, mimeType, instruction) {
    const key = await geminiKey();
    if (!key) { console.error("[Voice] Sem chave Gemini para leitura de mídia."); return null; }
    try {
      const { data } = await axios.post(
        `${GEMINI_BASE}/${STT_MODEL}:generateContent?key=${key}`,
        {
          contents: [{
            parts: [
              { inline_data: { mime_type: mimeType, data: buffer.toString("base64") } },
              { text: instruction },
            ],
          }],
        },
        { timeout: 60000 }
      );
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join(" ").trim();
      return text || null;
    } catch (e) {
      console.error("[Voice] Erro ao ler mídia:", e.response?.data?.error?.message || e.message);
      return null;
    }
  }

  /** Texto → arquivo WAV. Devolve caminho relativo (/uploads/…) ou null. */
  async synthesizeSpeech(text, voiceName) {
    const key = await geminiKey();
    if (!key) { console.error("[Voice] Sem chave Gemini para TTS."); return null; }
    // O voiceId da ElevenLabs (legado) não vale como voz Gemini — usa o default.
    const voice = /^[A-Z][a-z]+$/.test(voiceName || "") ? voiceName : DEFAULT_VOICE;
    try {
      const { data } = await axios.post(
        `${GEMINI_BASE}/${TTS_MODEL}:generateContent?key=${key}`,
        {
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        },
        { timeout: 60000 }
      );
      const b64 = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
      if (!b64) { console.error("[Voice] TTS não retornou áudio."); return null; }
      const wav = pcmToWav(Buffer.from(b64, "base64"));
      if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

      const base = `tts_${crypto.randomBytes(6).toString("hex")}`;
      const wavPath = path.join(AUDIO_DIR, `${base}.wav`);
      fs.writeFileSync(wavPath, wav);

      // O WhatsApp só renderiza nota de voz em OGG/Opus — um WAV é aceito no
      // envio mas não aparece no app. Convertemos com ffmpeg; se não houver
      // ffmpeg, mantemos o WAV (que ao menos toca no painel).
      const oggPath = path.join(AUDIO_DIR, `${base}.ogg`);
      try {
        await execFileAsync("ffmpeg", [
          "-y", "-i", wavPath,
          "-c:a", "libopus", "-b:a", "32k", "-ar", "48000", "-ac", "1",
          "-application", "voip",
          oggPath,
        ]);
        try { fs.unlinkSync(wavPath); } catch (_) {}
        console.log(`[Voice] 🔊 TTS gerado em OGG/Opus: ${base}.ogg`);
        return `/api/uploads/${base}.ogg`;
      } catch (e) {
        console.warn(`[Voice] ⚠️ ffmpeg falhou (${String(e.message).slice(0, 120)}). Mantendo WAV — o WhatsApp pode não exibir a nota de voz.`);
        return `/api/uploads/${base}.wav`;
      }
    } catch (e) {
      console.error("[Voice] Erro no TTS:", e.response?.data?.error?.message || e.message);
      return null;
    }
  }
}

export default new VoiceService();
