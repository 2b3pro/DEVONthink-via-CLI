#!/usr/bin/env osascript -l JavaScript
// Send a chat message to DEVONthink's AI
// Usage: osascript -l JavaScript chat.js '<json>'
// JSON format: {"prompt":"...","records":["uuid1","uuid2"],"url":"...","engine":"claude","model":"...","temperature":0.7,"role":"...","mode":"auto","usage":"auto","format":"text","thinking":true,"toolCalls":true}
// Required: prompt
// Optional: records (array of UUIDs), url, engine, model, temperature (0-2), role, mode (auto/text/vision),
//           usage (cheapest/auto/best), format (text/json/html/message/raw), thinking (boolean), toolCalls (boolean)
//
// Engine values: chatgpt, claude, gemini, mistral, perplexity, openrouter,
//                openai-compatible, lmstudio, ollama, remote-ollama
//
// Examples:
//   osascript -l JavaScript chat.js '{"prompt":"Hello!"}'
//   osascript -l JavaScript chat.js '{"prompt":"Summarize","records":["ABC123-DEF456"]}'
//   osascript -l JavaScript chat.js '{"prompt":"Explain this image","url":"https://example.com/image.png"}'
//   osascript -l JavaScript chat.js '{"prompt":"List facts","format":"json","thinking":false}'

ObjC.import("Foundation");

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

// Detect if string looks like a UUID (alphanumeric with hyphens, no slashes)
function isUuid(str) {
  if (!str || typeof str !== "string") return false;
  // Handle x-devonthink-item:// URLs
  if (str.startsWith("x-devonthink-item://")) return true;
  if (str.includes("/")) return false;
  return /^[A-F0-9-]{8,}$/i.test(str) && str.includes("-");
}

// Extract UUID from x-devonthink-item:// URL or return raw UUID
function extractUuid(str) {
  if (!str) return null;
  // Match x-devonthink-item:// followed by UUID, optionally followed by query params
  const urlMatch = str.match(/^x-devonthink-item:\/\/([A-F0-9-]+)(?:\?.*)?$/i);
  if (urlMatch) return urlMatch[1];
  if (isUuid(str)) return str;
  return str;
}

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

// Map CLI usage values to DEVONthink AppleScript enum names
const USAGE_MAP = {
  'cheapest': 'cheapest',
  'auto': 'auto',
  'best': 'best'
};

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: chat.js \'{"prompt":"Hello!"}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    let { prompt, promptRecord, records, url, engine, model, temperature, role, mode, usage, format, thinking, toolCalls } = params;

    const app = Application("DEVONthink");
    const options = {};

    // If promptRecord is provided, read the prompt from that record
    if (promptRecord) {
      const uuid = extractUuid(promptRecord);
      const record = app.getRecordWithUuid(uuid);
      if (!record) {
        throw new Error("Prompt record not found: " + uuid);
      }
      const recordText = record.plainText();
      if (!recordText) {
        throw new Error("Prompt record has no text content: " + uuid);
      }
      // If both prompt and promptRecord are provided, append record text to prompt?
      // Or just use record text if prompt is empty?
      // Logic: If prompt is provided, append record text. If not, use record text.
      if (prompt) {
        prompt = prompt + "\n\n" + recordText;
      } else {
        prompt = recordText;
      }
    }

    if (!prompt) throw new Error("Missing required field: prompt");

    // Handle records array - convert UUIDs to record objects
    if (records && Array.isArray(records) && records.length > 0) {
      const recordObjs = [];
      for (const ref of records) {
        const uuid = extractUuid(ref);
        const record = app.getRecordWithUuid(uuid);
        if (!record) {
          throw new Error("Record not found: " + uuid);
        }
        recordObjs.push(record);
      }
      options.record = recordObjs;
    }

    // URL context (web page, PDF, image)
    if (url) {
      options.URL = url;
    }

    // Engine
    if (engine) {
      const engineName = ENGINE_MAP[engine.toLowerCase()];
      if (!engineName) {
        throw new Error("Unknown engine: " + engine + ". Valid engines: " + Object.keys(ENGINE_MAP).join(", "));
      }
      options.engine = engineName;
    }

    // Model
    if (model) {
      options.model = model;
    }

    // Temperature (0-2)
    if (temperature !== undefined && temperature !== null) {
      const temp = parseFloat(temperature);
      if (isNaN(temp) || temp < 0 || temp > 2) {
        throw new Error("Temperature must be between 0 and 2");
      }
      options.temperature = temp;
    }

    // System role
    if (role) {
      options.role = role;
    }

    // Content mode (auto, text, vision)
    if (mode) {
      options.mode = mode;
    }

    // Usage mode (cheapest, auto, best)
    if (usage) {
      const usageVal = USAGE_MAP[usage.toLowerCase()];
      if (!usageVal) {
        throw new Error("Unknown usage: " + usage + ". Valid values: cheapest, auto, best");
      }
      options.usage = usageVal;
    }

    // Response format (text, json, html, message, raw)
    if (format) {
      // DEVONthink expects specific case for some values
      const formatMap = {
        'text': 'text',
        'json': 'JSON',
        'html': 'HTML',
        'message': 'message',
        'raw': 'raw'
      };
      const formatVal = formatMap[format.toLowerCase()];
      if (!formatVal) {
        throw new Error("Unknown format: " + format + ". Valid values: text, json, html, message, raw");
      }
      options.as = formatVal;
    }

    // Thinking toggle (default true, only set if explicitly false)
    if (thinking === false) {
      options.thinking = false;
    }

    // Tool calls toggle (default true, only set if explicitly false)
    if (toolCalls === false) {
      options.toolCalls = false;
    }

    // Make the API call
    const response = app.getChatResponseForMessage(prompt, options);

    // Build result based on response type
    const result = {
      success: true,
      engine: options.engine || app.currentChatEngine() || "default",
      model: options.model || app.currentChatModel() || "default"
    };

    if (records && records.length > 0) {
      result.recordCount = records.length;
    }
    if (url) {
      result.url = url;
    }

    // Handle different response types
    if (response === null || response === undefined) {
      result.response = null;
      result.message = "No response received";
    } else if (typeof response === "object") {
      // JSON or dictionary response
      result.response = response;
      result.responseType = "object";
    } else {
      // Text response
      result.response = String(response);
      result.responseType = "text";
    }

    JSON.stringify(result, null, 2);
  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
