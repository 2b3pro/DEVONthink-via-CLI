/**
 * Chat Command
 * AI chat with DEVONthink's integrated LLM support
 * @version 1.0.0
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { readStdin, readUuidsFromStdin, isStdinMarker } from '../utils.js';

function collectRecords(value, previous) {
  return previous.concat([value]);
}

export function registerChatCommand(program) {
  const chat = program
    .command('chat')
    .description('AI chat with DEVONthink');

  // dt chat [prompt] - Main chat command
  // Prompt is optional to support stdin
  chat
    .command('ask [prompt]', { isDefault: true })
    .description('Send a chat message')
    .option('-r, --record <uuid>', 'Document(s) for context (repeatable, or - for stdin)', collectRecords, [])
    .option('-P, --prompt-record <uuid>', 'Use record content as prompt')
    .option('-U, --url <url>', 'Web page/image/PDF URL for context')
    .option('-e, --engine <engine>', 'Chat engine (chatgpt, claude, gemini, ollama, etc.)')
    .option('-m, --model <model>', 'Specific model name')
    .option('-T, --temperature <temp>', 'Creativity 0-2 (0=focused, 2=random)', parseFloat)
    .option('--role <text>', 'System role/persona')
    .option('--mode <mode>', 'Content mode: auto, text, vision')
    .option('-u, --usage <mode>', 'Usage mode: cheapest, auto, best')
    .option('-f, --format <fmt>', 'Response format: text, json, html, message, raw')
    .option('--no-thinking', 'Disable reasoning (faster/cheaper)')
    .option('--no-tools', 'Disable tool calls (no search/download)')
    .option('--json', 'Output raw JSON wrapper')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output response text')
    .action(async (prompt, options) => {
      try {
        await requireDevonthink();

        let finalPrompt = prompt;
        let records = options.record || [];

        // Handle explicit stdin markers
        // Use '-' marker for unambiguous stdin input:
        // - prompt as '-': read prompt from stdin
        // - --record -: read UUIDs from stdin

        if (prompt === '-' || isStdinMarker(prompt)) {
          // Explicit: prompt from stdin
          finalPrompt = await readStdin();
          if (!finalPrompt) {
            throw new Error('No prompt received from stdin');
          }
        } else if (records.length === 1 && isStdinMarker(records[0])) {
          // Explicit: records from stdin
          records = await readUuidsFromStdin();
          if (records.length === 0) {
            throw new Error('No UUIDs received from stdin');
          }
        } else if (!prompt && !options.promptRecord && !process.stdin.isTTY) {
          // No prompt provided and stdin is piped - read prompt from stdin
          finalPrompt = await readStdin();
          if (!finalPrompt) {
            throw new Error('No prompt provided and no data from stdin');
          }
        }

        // Validate we have a prompt or a prompt record
        if (!finalPrompt && !options.promptRecord) {
          throw new Error('No prompt provided. Usage: dt chat "your prompt" or echo "prompt" | dt chat');
        }

        // Build params object
        const params = { prompt: finalPrompt };

        if (options.promptRecord) {
          params.promptRecord = options.promptRecord;
        }
        if (records.length > 0) {
          params.records = records;
        }
        if (options.url) params.url = options.url;
        if (options.engine) params.engine = options.engine;
        if (options.model) params.model = options.model;
        if (options.temperature !== undefined) params.temperature = options.temperature;
        if (options.role) params.role = options.role;
        if (options.mode) params.mode = options.mode;
        if (options.usage) params.usage = options.usage;
        if (options.format) params.format = options.format;
        if (options.thinking === false) params.thinking = false;
        if (options.tools === false) params.toolCalls = false;

        const result = await runJxa('read', 'chat', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          // Output just the response
          const response = result.response;
          if (typeof response === 'object') {
            console.log(JSON.stringify(response, null, 2));
          } else {
            console.log(response || '');
          }
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt chat models [--engine <engine>]
  chat
    .command('models')
    .description('List available chat models')
    .option('-e, --engine <engine>', 'Filter by engine')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output model names (one per line)')
    .action(async (options) => {
      try {
        await requireDevonthink();

        const params = {};
        if (options.engine) params.engine = options.engine;

        const result = await runJxa('read', 'chatModels', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          console.log((result.models || []).join('\n'));
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt chat capabilities --engine <engine> --model <model>
  chat
    .command('capabilities')
    .alias('caps')
    .description('Get model capabilities')
    .requiredOption('-e, --engine <engine>', 'Chat engine')
    .requiredOption('-m, --model <model>', 'Model name')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (options) => {
      try {
        await requireDevonthink();

        const params = {
          engine: options.engine,
          model: options.model
        };

        const result = await runJxa('read', 'chatCapabilities', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
