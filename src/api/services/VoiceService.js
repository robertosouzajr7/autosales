import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import prisma from "../config/prisma.js";
import { stopwatch } from "../utils/timing.js";

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
// Flash é o modelo de baixa latência da ElevenLabs (~75ms contra os ~5s do
// multilingual_v2 medidos em produção). Num atendimento por WhatsApp a espera
// pesa mais que a expressividade extra; para voltar ao modelo mais rico,
// basta ELEVENLABS_MODEL=eleven_multilingual_v2.
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5";

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
  const elevenKey = s?.elevenLabsApiKey || process.env.ELEVENLABS_API_KEY || null;
  let enabledVoices = [];
  try { enabledVoices = s?.enabledVoices ? JSON.parse(s.enabledVoices) : []; } catch { enabledVoices = []; }
  return { elevenKey, enabledVoices };
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

/**
 * Confere se o conteúdo é um OGG com stream Opus — o único formato que o
 * WhatsApp renderiza como nota de voz. A primeira página traz "OggS" seguido
 * do cabeçalho "OpusHead" (num OGG/Vorbis viria "\x01vorbis").
 * Aceita um Buffer (resposta de API) ou um caminho de arquivo.
 */
function isOpusOgg(source) {
  const head = Buffer.isBuffer(source) ? source.subarray(0, 64) : readHead(source);
  if (!head || head.length < 36) return false;
  if (head.subarray(0, 4).toString("latin1") !== "OggS") return false;
  return head.includes("OpusHead");
}

function readHead(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(64);
    const read = fs.readSync(fd, buf, 0, 64, 0);
    return buf.subarray(0, read);
  } catch {
    return null;
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch (_) {} }
  }
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

  /**
   * Lista as vozes disponíveis no provedor ativo. Para a ElevenLabs consulta a
   * API com a chave global (o admin escolhe quais liberar); para o Gemini
   * devolve o catálogo fixo.
   */
  async listProviderVoices() {
    const { elevenKey } = await resolveVoiceConfig();
    // Vozes padrão (Gemini) — sempre disponíveis, sem custo extra.
    const voices = GEMINI_VOICES.map((v) => ({ ...v, provider: "GEMINI", premium: false, preview: null }));

    // Vozes premium (ElevenLabs) — exigem plano com voz premium.
    if (!elevenKey) return { voices, elevenConfigured: false };
    try {
      const { data } = await axios.get("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": elevenKey },
        timeout: 30000,
      });
      for (const v of data?.voices || []) {
        voices.push({
          id: v.voice_id,
          name: v.name,
          provider: "ELEVENLABS",
          premium: true,
          labels: v.labels || {},
          // preview_url da própria ElevenLabs: amostra pronta, sem custo.
          preview: v.preview_url || null,
        });
      }
      return { voices, elevenConfigured: true };
    } catch (e) {
      console.error("[Voice] Erro ao listar vozes da ElevenLabs:", e.response?.data?.detail?.message || e.message);
      return { voices, elevenConfigured: true, error: "Não foi possível listar as vozes premium (verifique a chave)." };
    }
  }

  /**
   * Vozes disponíveis para uma conta. Devolve TODAS as liberadas pelo admin,
   * marcando as premium como `locked` quando o plano não dá direito — a UI
   * mostra a voz, deixa ouvir a amostra e oferece o upgrade.
   */
  async listEnabledVoices(tenantId = null) {
    const { enabledVoices } = await resolveVoiceConfig();
    const all = await this.listProviderVoices();

    // Filtro do admin (se houver): só as vozes que ele liberou no catálogo.
    let voices = all.voices;
    if (Array.isArray(enabledVoices) && enabledVoices.length) {
      const ids = new Set(enabledVoices.map((v) => v.id));
      voices = voices.filter((v) => ids.has(v.id) || !v.premium);
    }

    // Direito do plano às vozes premium.
    let premiumAllowed = false;
    if (tenantId) {
      premiumAllowed = await prisma.tenant
        .findUnique({ where: { id: tenantId }, select: { plan: { select: { enablePremiumVoice: true } } } })
        .then((t) => !!t?.plan?.enablePremiumVoice)
        .catch(() => false);
    }

    return {
      premiumAllowed,
      voices: voices.map((v) => ({
        id: v.id,
        name: v.name,
        provider: v.provider,
        premium: !!v.premium,
        preview: v.preview || null,
        locked: !!v.premium && !premiumAllowed,
      })),
    };
  }

  /** Descobre o provedor de uma voz pelo id (Gemini usa nomes, Eleven usa hash). */
  providerOf(voiceId) {
    return GEMINI_VOICES.some((v) => v.id === voiceId) ? "GEMINI" : "ELEVENLABS";
  }

  /**
   * Gera (e cacheia) uma amostra curta de uma voz do Gemini para o cliente
   * ouvir antes de escolher. As vozes da ElevenLabs já têm preview_url próprio.
   */
  async previewVoice(voiceId) {
    const safe = String(voiceId).replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safe) return null;
    const cached = path.join(AUDIO_DIR, `preview_${safe}.ogg`);
    if (fs.existsSync(cached)) return `/api/uploads/preview_${safe}.ogg`;

    const sample = "Olá! Sou o assistente virtual e é assim que a minha voz soa no atendimento.";
    const url = await this._geminiSpeech(sample, safe);
    if (!url) return null;
    // Renomeia para o nome de cache (evita gerar de novo a cada clique).
    try {
      const generated = path.join(AUDIO_DIR, path.basename(url));
      fs.renameSync(generated, cached);
      return `/api/uploads/preview_${safe}.ogg`;
    } catch {
      return url;
    }
  }

  /**
   * Converte um buffer de áudio para OGG/Opus e devolve a URL servível.
   * O navegador grava em WebM, que o WhatsApp não aceita como nota de voz.
   */
  async bufferToOpus(buffer, extensaoOrigem = "webm") {
    if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
    const base = `rec_${crypto.randomBytes(6).toString("hex")}`;
    const ext = String(extensaoOrigem).replace(/[^a-z0-9]/gi, "") || "webm";
    const srcPath = path.join(AUDIO_DIR, `${base}.${ext}`);
    fs.writeFileSync(srcPath, buffer);
    const url = await this._toOpus(srcPath, base);
    // _toOpus devolve o original quando o ffmpeg falha; avisa quem chamou.
    return { url, opus: url.endsWith(".ogg") };
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
        // -vn/-map_metadata descartam capa e tags: um OGG com arte embutida é
        // tratado como faixa de música, não como nota de voz.
        "-vn", "-map_metadata", "-1",
        "-c:a", "libopus", "-b:a", "32k", "-ar", "48000", "-ac", "1",
        "-application", "voip",
        "-f", "ogg", oggPath,
      ]);
      // Se o ffmpeg da imagem não tiver libopus ele pode cair em Vorbis, que o
      // WhatsApp exibe como arquivo — melhor detectar aqui do que no celular.
      if (!isOpusOgg(oggPath)) {
        console.warn(`[Voice] ⚠️ ${base}.ogg não saiu em Opus (libopus ausente?). O WhatsApp não exibiria como nota de voz.`);
        try { fs.unlinkSync(oggPath); } catch (_) {}
        return `/api/uploads/${path.basename(srcPath)}`;
      }
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
  async synthesizeSpeech(text, voiceId, tenantId = null) {
    const { elevenKey } = await resolveVoiceConfig();
    const provider = this.providerOf(voiceId);

    if (provider === "ELEVENLABS") {
      // Voz premium: exige plano com direito. Sem direito, cai na voz padrão
      // (não bloqueia o atendimento — só não usa a voz premium).
      let allowed = false;
      if (tenantId) {
        allowed = await prisma.tenant
          .findUnique({ where: { id: tenantId }, select: { plan: { select: { enablePremiumVoice: true } } } })
          .then((t) => !!t?.plan?.enablePremiumVoice)
          .catch(() => false);
      }
      if (allowed && elevenKey) return this._elevenLabsSpeech(text, voiceId, elevenKey);
      console.warn("[Voice] Voz premium sem direito no plano (ou sem chave) — usando voz padrão.");
      return this._geminiSpeech(text, DEFAULT_VOICE);
    }
    return this._geminiSpeech(text, voiceId);
  }

  /** TTS via ElevenLabs (vozes naturais) usando a chave GLOBAL do admin. */
  async _elevenLabsSpeech(text, voiceId, apiKey) {
    if (!apiKey) { console.error("[Voice] Sem chave da ElevenLabs (configure no admin)."); return null; }
    const voice = voiceId && !/^[A-Z][a-z]+$/.test(voiceId) ? voiceId : ELEVEN_DEFAULT_VOICE;
    const sw = stopwatch("tts-elevenlabs");
    try {
      const { data } = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
        {
          text,
          model_id: ELEVEN_MODEL,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        },
        {
          // Pede o Opus já no formato da nota de voz (48kHz/32kbps) — mesmo
          // alvo do ffmpeg. Quando vem em OGG, a conversão é dispensada.
          params: { output_format: "opus_48000_32" },
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json", accept: "audio/ogg" },
          responseType: "arraybuffer",
          timeout: 60000,
        }
      );
      sw.lap("api");
      if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
      const base = `tts_${crypto.randomBytes(6).toString("hex")}`;
      const buf = Buffer.from(data);

      // Caminho rápido: já veio pronto, sem passar pelo ffmpeg.
      if (isOpusOgg(buf)) {
        const oggPath = path.join(AUDIO_DIR, `${base}.ogg`);
        fs.writeFileSync(oggPath, buf);
        sw.done(`${ELEVEN_MODEL} · ${voice} · ${text.length} chars · opus direto`);
        return `/api/uploads/${base}.ogg`;
      }

      // Veio em outro container (MP3, por ex.): converte como antes.
      const rawPath = path.join(AUDIO_DIR, `${base}.mp3`);
      fs.writeFileSync(rawPath, buf);
      const out = await this._toOpus(rawPath, base);
      sw.lap("ffmpeg");
      sw.done(`${ELEVEN_MODEL} · ${voice} · ${text.length} chars`);
      return out;
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
    const sw = stopwatch("tts-gemini");
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
      sw.lap("api");
      const b64 = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
      if (!b64) { console.error("[Voice] TTS não retornou áudio."); return null; }
      const wav = pcmToWav(Buffer.from(b64, "base64"));
      if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

      const base = `tts_${crypto.randomBytes(6).toString("hex")}`;
      const wavPath = path.join(AUDIO_DIR, `${base}.wav`);
      fs.writeFileSync(wavPath, wav);
      const out = await this._toOpus(wavPath, base);
      sw.lap("ffmpeg");
      sw.done(`${TTS_MODEL} · ${voice} · ${text.length} chars`);
      return out;
    } catch (e) {
      console.error("[Voice] Erro no TTS:", e.response?.data?.error?.message || e.message);
      return null;
    }
  }
}

export default new VoiceService();
