import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "../config/prisma.js";

/**
 * AIProviderService
 * ------------------
 * Camada única de acesso a LLMs para o agente. Abstrai três provedores
 * (Google Gemini, OpenAI/GPT e Anthropic/Claude) atrás de duas operações:
 *
 *   - generateText(): uma resposta simples (sem ferramentas)
 *   - runToolLoop(): o laço de tool-use (function calling) até a resposta final
 *
 * A escolha de provedor/modelo/chave é resolvida por resolveAIConfig(), na
 * ordem: PlatformSettings (configurado pelo admin) → Tenant → variáveis de
 * ambiente. Assim o admin controla o modelo no painel, mas cada tenant pode
 * ter a própria chave.
 *
 * As ferramentas usam um formato normalizado independente de provedor:
 *   { name, description, parameters }  // parameters = JSON Schema (type: object)
 * e cada provedor converte para o seu próprio formato.
 */

// Catálogo de modelos suportados (fonte da verdade para o dropdown do admin).
export const MODEL_CATALOG = {
  GEMINI: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.0-flash",
    "gemini-flash-latest",
  ],
  OPENAI: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "o4-mini",
  ],
  ANTHROPIC: [
    "claude-opus-4-8",
    "claude-sonnet-5",
    "claude-haiku-4-5",
    "claude-opus-4-7",
  ],
};

export const DEFAULT_MODEL = {
  GEMINI: "gemini-2.5-flash",
  OPENAI: "gpt-4o-mini",
  ANTHROPIC: "claude-opus-4-8",
};

// Fallbacks de modelo Gemini (alguns modelos somem de v1beta em certas regiões).
const GEMINI_FALLBACKS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];

function approxTokens(str) {
  return Math.ceil((str || "").length / 4);
}

class AIProviderService {
  /**
   * Resolve provedor, modelo e chave para um tenant.
   * Prioridade: PlatformSettings (admin) → Tenant → env.
   */
  async resolveAIConfig(tenantId) {
    let settings = null;
    try {
      settings = await prisma.platformSettings.findUnique({ where: { id: "singleton" } });
    } catch { /* singleton pode não existir ainda */ }

    let tenant = null;
    if (tenantId) {
      try {
        tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { aiProvider: true, aiApiKey: true, openAiKey: true },
        });
      } catch { /* ignore */ }
    }

    // Provedor: admin manda; senão herda do tenant; senão GEMINI.
    const provider = (settings?.aiProvider || tenant?.aiProvider || "GEMINI").toUpperCase();

    // Modelo: admin manda; senão default do provedor.
    const model = settings?.aiModel || DEFAULT_MODEL[provider] || DEFAULT_MODEL.GEMINI;

    // Chave: chave específica do provedor no admin → chave do tenant → env.
    let apiKey = null;
    if (provider === "GEMINI") {
      apiKey = settings?.geminiApiKey || tenant?.aiApiKey || process.env.GEMINI_API_KEY;
    } else if (provider === "OPENAI") {
      apiKey = settings?.openaiApiKey || tenant?.openAiKey || tenant?.aiApiKey || process.env.OPENAI_API_KEY;
    } else if (provider === "ANTHROPIC") {
      apiKey = settings?.anthropicApiKey || tenant?.aiApiKey || process.env.ANTHROPIC_API_KEY;
    }

    return { provider, model, apiKey };
  }

  /**
   * Geração simples de texto (sem ferramentas).
   * @returns {Promise<{ text: string, tokens: number }>}
   */
  async generateText({ provider, model, apiKey, system, prompt }) {
    if (provider === "OPENAI") return this._openaiText({ model, apiKey, system, prompt });
    if (provider === "ANTHROPIC") return this._anthropicText({ model, apiKey, system, prompt });
    return this._geminiText({ model, apiKey, system, prompt });
  }

  /**
   * Laço de tool-use (function calling) até a resposta final.
   * @param tools Array<{ name, description, parameters }>
   * @param executeTool async (name, args) => object
   * @returns {Promise<{ text: string, toolCalls: Array, tokens: number }>}
   */
  async runToolLoop({ provider, model, apiKey, system, prompt, tools, executeTool }) {
    if (provider === "OPENAI") return this._openaiToolLoop({ model, apiKey, system, prompt, tools, executeTool });
    if (provider === "ANTHROPIC") return this._anthropicToolLoop({ model, apiKey, system, prompt, tools, executeTool });
    return this._geminiToolLoop({ model, apiKey, system, prompt, tools, executeTool });
  }

  // ─────────────────────────── GEMINI ───────────────────────────

  async _geminiText({ model, apiKey, system, prompt }) {
    const genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY);
    const candidates = [model, ...GEMINI_FALLBACKS.filter((m) => m !== model)];
    let lastError = null;
    for (const modelName of candidates) {
      try {
        const gm = genAI.getGenerativeModel({ model: modelName, systemInstruction: system });
        const result = await gm.generateContent(prompt);
        const text = result.response.text();
        return { text, tokens: approxTokens(prompt) + approxTokens(text) };
      } catch (err) {
        lastError = err;
        if (String(err.message).includes("404") || String(err.message).toLowerCase().includes("not found")) continue;
        throw err;
      }
    }
    throw lastError || new Error("Nenhum modelo Gemini disponível.");
  }

  async _geminiToolLoop({ model, apiKey, system, prompt, tools, executeTool }) {
    const genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY);
    const functionDeclarations = tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    const candidates = [model, ...GEMINI_FALLBACKS.filter((m) => m !== model)];
    let lastError = null;

    for (const modelName of candidates) {
      try {
        const gm = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: system,
          tools: functionDeclarations.length ? [{ functionDeclarations }] : undefined,
        });

        const chat = gm.startChat();
        let result = await chat.sendMessage(prompt);
        let tokens = approxTokens(prompt);
        const toolCalls = [];

        // Até 5 rodadas de tool-use para evitar laço infinito.
        for (let round = 0; round < 5; round++) {
          const response = result.response;
          const parts = response.candidates?.[0]?.content?.parts || [];
          const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

          if (!calls.length) {
            const text = response.text?.() || "";
            tokens += approxTokens(text);
            return { text, toolCalls, tokens };
          }

          const toolResponses = [];
          for (const fc of calls) {
            let toolResult = {};
            try {
              toolResult = await executeTool(fc.name, fc.args || {});
            } catch (e) {
              toolResult = { error: e.message };
            }
            toolCalls.push({ name: fc.name, args: fc.args, result: toolResult });
            tokens += approxTokens(JSON.stringify(toolResult));
            toolResponses.push({ functionResponse: { name: fc.name, response: toolResult } });
          }

          result = await chat.sendMessage(toolResponses);
        }

        const finalText = result.response.text?.() || "";
        tokens += approxTokens(finalText);
        return { text: finalText, toolCalls, tokens };
      } catch (err) {
        lastError = err;
        if (String(err.message).includes("404") || String(err.message).toLowerCase().includes("not found")) continue;
        throw err;
      }
    }
    throw lastError || new Error("Nenhum modelo Gemini disponível.");
  }

  // ─────────────────────────── OPENAI ───────────────────────────

  async _getOpenAI(apiKey) {
    const { default: OpenAI } = await import("openai");
    return new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
  }

  async _openaiText({ model, apiKey, system, prompt }) {
    const client = await this._getOpenAI(apiKey);
    const resp = await client.chat.completions.create({
      model,
      messages: [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ],
    });
    const text = resp.choices?.[0]?.message?.content || "";
    const tokens = resp.usage?.total_tokens || approxTokens(prompt) + approxTokens(text);
    return { text, tokens };
  }

  async _openaiToolLoop({ model, apiKey, system, prompt, tools, executeTool }) {
    const client = await this._getOpenAI(apiKey);
    const openaiTools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const messages = [
      ...(system ? [{ role: "system", content: system }] : []),
      { role: "user", content: prompt },
    ];

    const toolCalls = [];
    let tokens = 0;
    let finalText = "";

    for (let round = 0; round < 5; round++) {
      const resp = await client.chat.completions.create({
        model,
        messages,
        tools: openaiTools.length ? openaiTools : undefined,
      });
      tokens += resp.usage?.total_tokens || 0;
      const msg = resp.choices?.[0]?.message;
      if (!msg) break;

      const calls = msg.tool_calls || [];
      if (!calls.length) {
        finalText = msg.content || "";
        break;
      }

      // Preserva a mensagem do assistente que pediu as ferramentas.
      messages.push(msg);

      for (const call of calls) {
        const name = call.function?.name;
        let args = {};
        try {
          args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch { args = {}; }

        let toolResult = {};
        try {
          toolResult = await executeTool(name, args);
        } catch (e) {
          toolResult = { error: e.message };
        }
        toolCalls.push({ name, args, result: toolResult });

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(toolResult),
        });
      }
    }

    if (!tokens) tokens = approxTokens(prompt) + approxTokens(finalText);
    return { text: finalText, toolCalls, tokens };
  }

  // ────────────────────────── ANTHROPIC ─────────────────────────

  async _getAnthropic(apiKey) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    return new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
  }

  async _anthropicText({ model, apiKey, system, prompt }) {
    const client = await this._getAnthropic(apiKey);
    const resp = await client.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (resp.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const tokens = (resp.usage?.input_tokens || 0) + (resp.usage?.output_tokens || 0)
      || approxTokens(prompt) + approxTokens(text);
    return { text, tokens };
  }

  async _anthropicToolLoop({ model, apiKey, system, prompt, tools, executeTool }) {
    const client = await this._getAnthropic(apiKey);
    const anthropicTools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));

    const messages = [{ role: "user", content: prompt }];
    const toolCalls = [];
    let tokens = 0;
    let finalText = "";

    for (let round = 0; round < 5; round++) {
      const resp = await client.messages.create({
        model,
        max_tokens: 1024,
        system,
        messages,
        tools: anthropicTools.length ? anthropicTools : undefined,
      });
      tokens += (resp.usage?.input_tokens || 0) + (resp.usage?.output_tokens || 0);

      // Texto acumulado desta rodada (Claude pode falar antes de chamar ferramentas).
      const roundText = (resp.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      if (roundText) finalText = roundText;

      if (resp.stop_reason !== "tool_use") break;

      const toolUseBlocks = (resp.content || []).filter((b) => b.type === "tool_use");
      if (!toolUseBlocks.length) break;

      // Preserva a resposta do assistente (com os blocos tool_use).
      messages.push({ role: "assistant", content: resp.content });

      const toolResultBlocks = [];
      for (const block of toolUseBlocks) {
        let toolResult = {};
        try {
          toolResult = await executeTool(block.name, block.input || {});
        } catch (e) {
          toolResult = { error: e.message };
        }
        toolCalls.push({ name: block.name, args: block.input, result: toolResult });
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(toolResult),
        });
      }

      messages.push({ role: "user", content: toolResultBlocks });
    }

    if (!tokens) tokens = approxTokens(prompt) + approxTokens(finalText);
    return { text: finalText, toolCalls, tokens };
  }
}

export default new AIProviderService();
