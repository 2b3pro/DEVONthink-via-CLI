#!/usr/bin/env osascript -l JavaScript
// Get capabilities of a chat model
// Usage: osascript -l JavaScript chatCapabilities.js '<json>'
// JSON format: {"engine":"claude","model":"claude-3-opus"}
// Required: engine, model
//
// Engine values: chatgpt, claude, gemini, mistral, perplexity, openrouter,
//                openai-compatible, lmstudio, ollama, remote-ollama
//
// Returns: contextWindow, deepSearch, thinking, toolCalls, vision
//
// Examples:
//   osascript -l JavaScript chatCapabilities.js '{"engine":"claude","model":"claude-3-opus"}'
//   osascript -l JavaScript chatCapabilities.js '{"engine":"chatgpt","model":"gpt-4"}'

ObjC.import("Foundation");

// Map CLI engine names to DEVONthink AppleScript enum names
const ENGINE_MAP = {
  'chatgpt': 'ChatGPT',
  'claude': 'Claude',
  'gemini': 'Gemini',
  'mistral': 'Mistral',
  'perplexity': 'Perplexity',
  'openrouter': 'OpenRouter',
  'openai-compatible': 'OpenAI Compatible',
  'lmstudio': 'LM Studio',
  'ollama': 'Ollama',
  'remote-ollama': 'Remote Ollama'
};

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: chatCapabilities.js \'{"engine":"claude","model":"claude-3-opus"}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { engine, model } = params;

    if (!engine) throw new Error("Missing required field: engine");
    if (!model) throw new Error("Missing required field: model");

    const engineName = ENGINE_MAP[engine.toLowerCase()];
    if (!engineName) {
      throw new Error("Unknown engine: " + engine + ". Valid engines: " + Object.keys(ENGINE_MAP).join(", "));
    }

    const app = Application("DEVONthink");
    const caps = app.getChatCapabilitiesForEngine(engineName, { model: model });

    if (!caps) {
      JSON.stringify({
        success: false,
        error: "Could not get capabilities for model: " + model + " on engine: " + engineName
      });
    } else {
      // Capabilities object returns values directly, not as functions
      JSON.stringify({
        success: true,
        engine: engineName,
        model: model,
        contextWindow: caps.contextWindow,
        deepSearch: caps.deepSearch,
        thinking: caps.thinking,
        toolCalls: caps.toolCalls,
        vision: caps.vision
      });
    }
  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
