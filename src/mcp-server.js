/**
 * DEVONthink MCP Server
 * Implementation of the Model Context Protocol for DEVONthink 4
 * @version 2.0.0
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { runJxa } from "./jxa-runner.js";
import { processRecord } from "./commands/organize.js";

const server = new Server(
  {
    name: "devonthink-mcp",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Tool Definitions
 */
const TOOLS = [
  {
    name: "search_records",
    description: "Search for records in DEVONthink using full-text or metadata filters.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
        database: { type: "string", description: "Optional database name or UUID" },
        limit: { type: "number", description: "Max results (default 20)", default: 20 },
      },
      required: ["query"],
    },
  },
  {
    name: "get_record_properties",
    description: "Get detailed metadata for a specific record (tags, comment, dates, path, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        uuid: { type: "string", description: "The UUID of the record" },
      },
      required: ["uuid"],
    },
  },
  {
    name: "explore_devonthink",
    description: "Navigate and explore the DEVONthink environment (databases, selection, groups, reveal UI).",
    inputSchema: {
      type: "object",
      properties: {
        scope: { 
          type: "string", 
          enum: ["databases", "selection", "children", "reveal"],
          description: "What to explore or action to take"
        },
        uuid: { type: "string", description: "Target UUID (required for 'children' and 'reveal')" },
        mode: { 
          type: "string", 
          enum: ["window", "tab", "reveal"],
          description: "Reveal mode (default 'window')",
          default: "window"
        },
      },
      required: ["scope"],
    },
  },
  {
    name: "get_record_content",
    description: "Read the plain text content or markdown of a specific record by UUID.",
    inputSchema: {
      type: "object",
      properties: {
        uuid: { type: "string", description: "The UUID of the record" },
        maxLength: { type: "number", description: "Maximum characters to return (default 5000)", default: 5000 },
      },
      required: ["uuid"],
    },
  },
  {
    name: "get_related_records",
    description: "Find related records (backlinks, wiki links, or AI-suggested similarities).",
    inputSchema: {
      type: "object",
      properties: {
        uuid: { type: "string", description: "The record UUID to explore" },
        type: { 
          type: "string", 
          enum: ["all", "incoming", "outgoing", "similar"],
          description: "Type of relation to return",
          default: "all"
        },
      },
      required: ["uuid"],
    },
  },
  {
    name: "list_group_contents",
    description: "List the contents of a specific group/folder.",
    inputSchema: {
      type: "object",
      properties: {
        uuid: { type: "string", description: "The UUID of the group" },
      },
      required: ["uuid"],
    },
  },
  {
    name: "organize_record",
    description: "Intelligently organize a record: OCR, rename, tag, and summarize based on content.",
    inputSchema: {
      type: "object",
      properties: {
        uuid: { type: "string", description: "The UUID of the record to organize" },
        auto: { type: "boolean", description: "Enable all features (OCR, rename, tag, summarize)", default: true },
        ocr: { type: "boolean", description: "Force OCR" },
        rename: { type: "boolean", description: "Suggest/apply new name" },
        tag: { type: "boolean", description: "Suggest/apply semantic tags" },
        summarize: { type: "boolean", description: "Add summary to comment" },
        promptRecord: { type: "string", description: "UUID of a record containing custom instructions" },
      },
      required: ["uuid"],
    },
  },
  {
    name: "summarize_record",
    description: "Generate an AI summary of a record and optionally save it to the comment field.",
    inputSchema: {
      type: "object",
      properties: {
        uuid: { type: "string", description: "The UUID of the record to summarize" },
        promptRecord: { type: "string", description: "UUID of a record containing custom summarization instructions" },
        save: { type: "boolean", description: "Whether to save the summary to the record's comment field", default: true },
      },
      required: ["uuid"],
    },
  },
  {
    name: "create_record",
    description: "Create a new record (markdown, text, bookmark, or group) in DEVONthink.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The title of the record" },
        type: { 
          type: "string", 
          enum: ["markdown", "txt", "rtf", "bookmark", "html", "group"],
          description: "Record type",
          default: "markdown"
        },
        content: { type: "string", description: "Content for text-based records" },
        database: { type: "string", description: "Database name or UUID (default: current/Inbox)" },
        groupPath: { type: "string", description: "Destination group path (e.g., '/Notes') or UUID" },
        url: { type: "string", description: "URL for bookmark records" },
        tags: { type: "array", items: { type: "string" }, description: "Tags to apply" },
      },
      required: ["name"],
    },
  }
];

/**
 * Tool Handlers
 */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "search_records": {
        const result = await runJxa("read", "search", [
          args.query,
          JSON.stringify({ database: args.database, limit: args.limit || 20 })
        ]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "get_record_properties": {
        const result = await runJxa("read", "getRecordProperties", [args.uuid]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "explore_devonthink": {
        const { scope, uuid, mode } = args;
        let result;
        
        switch (scope) {
          case "databases":
            result = await runJxa("read", "listDatabases", []);
            break;
          case "selection":
            result = await runJxa("read", "getSelection", []);
            break;
          case "children":
            if (!uuid) throw new Error("UUID is required for 'children' scope");
            result = await runJxa("read", "listGroupContents", [JSON.stringify({ groupRef: uuid })]);
            break;
          case "reveal":
            if (!uuid) throw new Error("UUID is required for 'reveal' scope");
            // mode can be window, tab, or reveal (reveal means navigate in-place)
            result = await runJxa("utils", "revealRecord", [uuid, "self", mode || "window"]);
            break;
          default:
            throw new Error(`Unknown scope: ${scope}`);
        }
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "get_record_content": {
        const result = await runJxa("read", "getRecordPreview", [
          args.uuid,
          String(args.maxLength || 5000)
        ]);
        return { content: [{ type: "text", text: result.preview || "No content found." }] };
      }

      case "get_related_records": {
        const result = await runJxa("read", "getRelated", [
          JSON.stringify({ uuid: args.uuid, type: args.type || "all" })
        ]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "list_group_contents": {
        const result = await runJxa("read", "listGroupContents", [
          JSON.stringify({ groupRef: args.uuid })
        ]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "organize_record": {
        const options = { ...args };
        if (args.promptRecord) {
            options.prompt = args.promptRecord;
        } else if (process.env.DT_ORGANIZE_PROMPT) {
            options.prompt = process.env.DT_ORGANIZE_PROMPT;
        }
        const result = await processRecord(args.uuid, options);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "create_record": {
        const result = await runJxa("write", "createRecord", [
          JSON.stringify({
            name: args.name,
            type: args.type || "markdown",
            content: args.content,
            database: args.database || process.env.DT_DEFAULT_DATABASE,
            groupPath: args.groupPath,
            url: args.url,
            tags: args.tags
          })
        ]);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "summarize_record": {
        const { uuid, promptRecord, native, type, format, save = true } = args;
        
        // Native Mode
        if (native) {
             const result = await runJxa('write', 'summarizeNative', [JSON.stringify({
                 uuid,
                 type: type || "annotations",
                 format: format || "markdown"
             })]);
             return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        // AI Mode
        const preview = await runJxa('read', 'getRecordPreview', [uuid, '10000']);
        if (!preview.success) throw new Error(preview.error);

        const promptUuid = promptRecord || process.env.DT_SUMMARIZE_PROMPT;
        let customInstruction = "";
        if (promptUuid) {
           const pRec = await runJxa('read', 'getRecordPreview', [promptUuid, '5000']);
           if (pRec.success) customInstruction = pRec.preview;
        }

        const chatPrompt = `You are an expert at summarizing information. 
        ${customInstruction ? `Follow these specific instructions: ${customInstruction}` : "Provide a concise 1-2 sentence summary of the following text."}
        
        Text:
        ${preview.preview.substring(0, 8000)}`;

        const chatResult = await runJxa('read', 'chat', [JSON.stringify({ prompt: chatPrompt, thinking: false, format: 'text' })]);
        if (!chatResult.success) throw new Error(chatResult.error);

        const summary = chatResult.response.trim();
        if (save) {
            await runJxa('write', 'modifyRecordProperties', [JSON.stringify({ uuid, comment: summary })]);
        }
        return { content: [{ type: "text", text: summary }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: error.message }],
    };
  }
});

/**
 * Start Server
 */
export async function runMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DEVONthink MCP Server running on stdio");
}
