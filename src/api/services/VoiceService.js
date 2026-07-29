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
const DEFAULT_VOICE = "Kore"; // voz neutra do Gemini; boa em PT-BR
const ELEVEN_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"; // Rachel (ElevenLabs)

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

/**
 * Configuração GLOBAL de voz (definida pelo admin do SaaS, igual à LLM):
 * provedor, chave e vozes liberadas. O tenant nunca vê a chave.
 */
export async function resolveVoiceConfig() {
  let s = null;
  try {
    s = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
  } catch { /* usa env */ }
  const provider = (s?.voiceProvider || process.env.VOICE_PROVIDER || "GEMINI").toUpperCase();
  const elevenKey = s?.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY || null;
  let enabledVoices = [];
  try { enabledVoices = s?.enabledVoices ? JSON.parse(s.enabledVoices) : []; } catch { enabledVoices = []; }
  return { provider, elevenKey, enabledVoices };
}

/** Vozes nativas do Gemini (catálogo fixo). */
export const GEMINI_VOICES = [
  { id: "Kore", name: "Kore (feminina, neutra)" },
  { id: "Aoede", name: "Aoede (feminina, suave)" },
  { id: "Leda", name: "Leda (feminina, jovem)" },
  { id: "Puck", name: "Puck (masculina, animada)" },
  { id: "Charon", name: "Charon (masculina, grave)" },
  { id: "Orus", name: "Orus (masculina, firme)" },
];

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

  /**
   * Lista as vozes disponíveis no provedor ativo. Para a ElevenLabs consulta a
   * API com a chave global (o admin escolhe quais liberar); para o Gemini
   * devolve o catálogo fixo.
   */
  async listProviderVoices() {
    const { provider, elevenKey } = await resolveVoiceConfig();
    if (provider !== "ELEVENLABS") return { provider, voices: GEMINI_VOICES };
    if (!elevenKey) return { provider, voices: [], error: "Chave da ElevenLabs não configurada." };
    try {
      const { data } = await axios.get("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": elevenKey },
        timeout: 30000,
      });
      const voices = (data?.voices || []).map((v) => ({
        id: v.voice_id,
        name: v.name,
        // Metadados úteis para o admin escolher (sotaque, gênero, uso).
        labels: v.labels || {},
        preview: v.preview_url || null,
      }));
      return { provider, voices };
    } catch (e) {
      console.error("[Voice] Erro ao listar vozes da ElevenLabs:", e.response?.data?.detail?.message || e.message);
      return { provider, voices: [], error: "Não foi possível listar as vozes (verifique a chave)." };
    }
  }

  /**
   * Vozes LIBERADAS para as contas. Se o admin não restringiu nada, devolve
   * todas as do provedor ativo.
   */
  async listEnabledVoices() {
    const { provider, enabledVoices } = await resolveVoiceConfig();
    if (Array.isArray(enabledVoices) && enabledVoices.length) {
      return { provider, voices: enabledVoices };
    }
    const all = await this.listProviderVoices();
    return { provider, voices: all.voices.map((v) => ({ id: v.id, name: v.name })) };
  }

  /**
   * Converte um arquivo de áudio para OGG/Opus (formato da nota de voz do
   * WhatsApp). Devolve a URL canônica; mantém o original se o ffmpeg falhar.
   */
  async _toOpus(srcPath, base) {
    const oggPath = path.join(AUDIO_DIR, `${base}.ogg`);
    try {
      await execFileAsync("ffmpeg", [
        "-y", "-i", srcPath,
        "-c:a", "libopus", "-b:a", "32k", "-ar", "48000", "-ac", "1",
        "-application", "voip",
        oggPath,
      ]);
      try { fs.unlinkSync(srcPath); } catch (_) {}
      console.log(`[Voice] 🔊 TTS gerado em OGG/Opus: ${base}.ogg`);
      return `/api/uploads/${base}.ogg`;
    } catch (e) {
      console.warn(`[Voice] ⚠️ ffmpeg falhou (${String(e.message).slice(0, 120)}). Mantendo original — o WhatsApp pode não exibir a nota de voz.`);
      return `/api/uploads/${path.basename(srcPath)}`;
    }
  }

  /**
   * Texto → áudio, pelo provedor GLOBAL configurado pelo admin
   * (Gemini ou ElevenLabs). Devolve caminho relativo ou null.
   */
  async synthesizeSpeech(text, voiceId) {
    const { provider, elevenKey } = await resolveVoiceConfig();
    if (provider === "ELEVENLABS") {
      return this._elevenLabsSpeech(text, voiceId, elevenKey);
    }
    return this._geminiSpeech(text, voiceId);
  }

  /** TTS via ElevenLabs (vozes naturais) usando a chave GLOBAL do admin. */
  async _elevenLabsSpeech(text, voiceId, apiKey) {
    if (!apiKey) { console.error("[Voice] Sem chave da ElevenLabs (configure no admin)."); return null; }
    const voice = voiceId && !/^[A-Z][a-z]+$/.test(voiceId) ? voiceId : ELEVEN_DEFAULT_VOICE;
    try {
      const { data } = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
        {
          text,
          model_id: process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        },
        {
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json", accept: "audio/mpeg" },
          responseType: "arraybuffer",
          timeout: 60000,
        }
      );
      if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
      const base = `tts_${crypto.randomBytes(6).toString("hex")}`;
      const mp3Path = path.join(AUDIO_DIR, `${base}.mp3`);
      fs.writeFileSync(mp3Path, Buffer.from(data));
      return await this._toOpus(mp3Path, base);
    } catch (e) {
      // O corpo do erro vem como arraybuffer — converte para texto legível.
      let detail = e.message;
      try { if (e.response?.data) detail = Buffer.from(e.response.data).toString("utf8").slice(0, 200); } catch (_) {}
      console.error("[Voice] Erro no TTS (ElevenLabs):", detail);
      return null;
    }
  }

  /** TTS nativo do Gemini (fallback/alternativa mais barata). */
  async _geminiSpeech(text, voiceName) {
    const key = await geminiKey();
    if (!key) { console.error("[Voice] Sem chave Gemini para TTS."); return null; }
    // IDs da ElevenLabs não valem como voz Gemini — cai no default.
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
      return await this._toOpus(wavPath, base);
    } catch (e) {
      console.error("[Voice] Erro no TTS:", e.response?.data?.error?.message || e.message);
      return null;
    }
  }
}

export default new VoiceService();
