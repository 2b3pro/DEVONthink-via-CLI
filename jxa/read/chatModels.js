#!/usr/bin/env osascript -l JavaScript
// List available chat models for an engine
// Usage: osascript -l JavaScript chatModels.js '<json>'
// JSON format: {"engine":"claude"}
// Optional: engine (if not provided, uses current default engine)
//
// Engine values: chatgpt, claude, gemini, mistral, perplexity, openrouter,
//                openai-compatible, lmstudio, ollama, remote-ollama
//
// Examples:
//   osascript -l JavaScript chatModels.js '{}'
//   osascript -l JavaScript chatModels.js '{"engine":"claude"}'
//   osascript -l JavaScript chatModels.js '{"engine":"ollama"}'

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

const jsonArg = getArg(4, '{}');

try {
  const params = JSON.parse(jsonArg);
  const { engine } = params;

  const app = Application("DEVONthink");

  let engineName;
  if (engine) {
    engineName = ENGINE_MAP[engine.toLowerCase()];
    if (!engineName) {
      throw new Error("Unknown engine: " + engine + ". Valid engines: " + Object.keys(ENGINE_MAP).join(", "));
    }
  } else {
    // Use current default engine
    engineName = app.currentChatEngine();
    if (!engineName) {
      throw new Error("No default chat engine configured. Please specify --engine.");
    }
  }

  const models = app.getChatModelsForEngine(engineName);

  if (!models || models.length === 0) {
    JSON.stringify({
      success: true,
      engine: engineName,
      models: [],
      count: 0,
      message: "No models available for engine: " + engineName
    });
  } else {
    JSON.stringify({
      success: true,
      engine: engineName,
      models: models,
      count: models.length
    });
  }
} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
