import axios from "axios";
import fs from "fs";
import path from "path";

class TTSService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.baseUrl = "https://api.elevenlabs.io/v1/text-to-speech";
  }

  /**
   * Converte texto em áudio usando ElevenLabs
   * @param {string} text Texto a ser convertido
   * @param {string} voiceId ID da voz (Rachel default)
   * @param {string} customApiKey Chave de API opcional (do tenant)
   * @returns {Promise<string>} Caminho relativo do arquivo de áudio gerado
   */
  async generateSpeech(text, voiceId = "21m00Tcm4TlvDq8ikWAM", customApiKey = null) {
    const apiKey = customApiKey || this.apiKey;
    if (!apiKey) {
      console.error("[TTSService] Nenhuma chave de API da ElevenLabs encontrada.");
      return null;
    }

    try {
      console.log(`[TTSService] Gerando áudio para: "${text.substring(0, 30)}..." com voz ${voiceId}`);
      
      const response = await axios({
        method: "POST",
        url: `${this.baseUrl}/${voiceId}`,
        data: {
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        },
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "accept": "audio/mpeg"
        },
        responseType: "arraybuffer"
      });

      const filename = `sdr_audio_${Date.now()}.mp3`;
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, response.data);

      return `/uploads/${filename}`;
    } catch (error) {
      console.error("[TTSService] Erro ao gerar áudio:", error.response?.data || error.message);
      return null;
    }
  }
}

export default new TTSService();
