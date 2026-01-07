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
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from 'module';
import { runJxa } from "./jxa-runner.js";
import { processRecord } from "./commands/organize.js";
import { 
  addTasks, 
  executeQueue, 
  getQueueStatus, 
  clearQueue 
} from "./queue.js";
import { buildSearchQuery } from "./utils.js";

const require = createRequire(import.meta.url);
const pkg = require('../package.json');


const server = new Server(
  {
    name: "devonthink-mcp",
    version: pkg.version,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

/**
 * Tool Definitions
 */
const TOOLS = [
  {
    name: "queue_tasks",
    description: `Add tasks to the execution queue for batch processing.
Supported Actions & Params:
- create: { name, type, content, database, group, tags }
- move: { uuid, destination }
- delete: { uuid }
- tag.add: { uuids: [], tags: [] }
- tag.remove: { uuids: [], tags: [] }
- tag.set: { uuids: [], tags: [] }
- tag.merge: { target, sources, database? }
- tag.rename: { from, to, database? }
- tag.delete: { tag, database? }
- chat: { prompt?, promptRecord?, records?, url?, engine?, model?, temperature?, role?, mode?, usage?, format?, thinking?, toolCalls? }
- organize: { uuid, auto: true }
- summarize: { uuid, save: true }
Variables like "$1.uuid" can be used to reference results of previous tasks.`,
    inputSchema: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: { 
                type: "string",
                enum: [
                  "create", "delete", "move", "modify", 
                  "replicate", "duplicate", "convert",
                  "tag.add", "tag.remove", "tag.merge", "tag.rename", "tag.delete",
                  "link", "unlink", "organize", "summarize", "search", "chat"
                ]
              },
              params: { type: "object" },
              dependsOn: { type: "array", items: { type: "integer" } }
            },
            required: ["action", "params"]
          }
        },
        options: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["sequential", "parallel", "transactional"] },
            verbose: { type: "boolean" }
          }
        }
      },
      required: ["tasks"]
    }
  },
  {
    name: "execute_queue",
    description: "Execute all pending tasks in the queue.",
    inputSchema: {
      type: "object",
      properties: {
        dryRun: { type: "boolean", description: "Validate only, don't execute" },
        verbose: { type: "boolean", description: "If true, returns detailed result for every task. Default false (summary only)." },
        mode: { type: "string", enum: ["sequential", "parallel", "transactional"] }
      }
    }
  },
  {
    name: "get_queue_status",
    description: "Get current queue status and task list.",
    inputSchema: {
      type: "object",
      properties: {
        includeCompleted: { type: "boolean", default: false }
      }
    }
  },
  {
    name: "clear_queue",
    description: "Clear completed/failed tasks or entire queue.",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["completed", "failed", "all"], default: "completed" }
      }
    }
  },
  {
    name: "verify_queue",
    description: "Perform a deep existence check of all resources referenced in the queue against DEVONthink.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "repair_queue",
    description: "Use AI to analyze and fix an invalid or failed task queue based on session context.",
    inputSchema: {
      type: "object",
      properties: {
        apply: { type: "boolean", description: "Actually apply the fixes. Default false.", default: false },
        engine: { type: "string", description: "AI engine to use. Default 'claude'." }
      }
    }
  },
  {
    name: "search_records",
    description: "Search for records in DEVONthink using full-text or metadata filters.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
        database: { type: "string", description: "Optional database name or UUID" },
        limit: { type: "number", description: "Max results (default 20)", default: 20 },
        createdAfter: { type: "string", description: "Filter by creation date (after)" },
        createdBefore: { type: "string", description: "Filter by creation date (before)" },
        modifiedAfter: { type: "string", description: "Filter by modification date (after)" },
        modifiedBefore: { type: "string", description: "Filter by modification date (before)" },
        addedAfter: { type: "string", description: "Filter by addition date (after)" },
        addedBefore: { type: "string", description: "Filter by addition date (before)" },
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
          enum: ["all", "incoming", "outgoing", "similar", "byData", "byTags"],
          description: "Type of relation to return. 'byData' uses text/metadata comparison, 'byTags' uses tag comparison.",
          default: "all"
        },
        database: {
          type: "string",
          description: "Optional database name to scope classification (only for byData/byTags)"
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
    name: "manage_record",
    description: "Comprehensive record management: Create, Update, Move, Delete (Trash), or Convert.",
    inputSchema: {
      type: "object",
      properties: {
        action: { 
          type: "string", 
          enum: ["create", "update", "move", "trash", "convert"],
          description: "The action to perform"
        },
        uuid: { type: "string", description: "Target record UUID (required for update, move, trash, convert)" },
        name: { type: "string", description: "Name/Title (create/update)" },
        type: { 
          type: "string", 
          enum: ["markdown", "txt", "rtf", "bookmark", "html", "group", "smart group"],
          description: "Record type (create only)",
          default: "markdown"
        },
        content: { type: "string", description: "Text content (create)" },
        database: { type: "string", description: "Target database (create)" },
        destination: { type: "string", description: "Destination group UUID or path (create/move)" },
        url: { type: "string", description: "URL (create bookmark/update)" },
        tags: { type: "array", items: { type: "string" }, description: "Tags to set/add" },
        comment: { type: "string", description: "Comment to set" },
        query: { type: "string", description: "Search query (create smart group)" },
        convertFormat: { type: "string", description: "Format to convert to (markdown, pdf, etc.)" }
      },
      required: ["action"],
    },
  }
];

/**
 * Tool Handlers
 */
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

/**
 * Resource Handlers
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  // Get list of databases to expose their smart groups
  const dbs = await runJxa("read", "listDatabases", []);
  
  const resources = [
    {
      uri: "devonthink://inbox",
      name: "Global Inbox",
      mimeType: "application/json",
      description: "Contents of the Global Inbox"
    },
    {
      uri: "devonthink://selection",
      name: "Current Selection",
      mimeType: "application/json",
      description: "Currently selected records in DEVONthink"
    }
  ];

  if (dbs.success !== false) { // dbs is array on success
    dbs.forEach(db => {
      resources.push({
        uri: `devonthink://${encodeURIComponent(db.name)}/smartgroups`,
        name: `Smart Groups: ${db.name}`,
        mimeType: "application/json",
        description: `Root-level smart groups in ${db.name}`
      });
    });
  }

  return { resources };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const url = new URL(uri);
  const pathParts = url.pathname.split("/").filter(p => p.length > 0);
  
  // URL parsing:
  // devonthink://inbox -> hostname=inbox, path=""
  // devonthink://selection -> hostname=selection
  // devonthink://dbname/smartgroups -> hostname=dbname, path=smartgroups
  // devonthink://dbname/smartgroup/xyz -> hostname=dbname, path=smartgroup/xyz
  
  const hostname = url.hostname; // dbName or 'inbox'/'selection'
  
  try {
    if (hostname === "inbox") {
      const result = await runJxa("read", "listGroupContents", [JSON.stringify({ groupRef: "Inbox" })]);
      return {
        contents: [{
          uri: uri,
          mimeType: "application/json",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }

    if (hostname === "selection") {
      const result = await runJxa("read", "getSelection", []);
      return {
        contents: [{
          uri: uri,
          mimeType: "application/json",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }

    // Database Resources
    const dbName = decodeURIComponent(hostname);
    
    // Check path for specific resource type
    if (pathParts[0] === "smartgroups") {
      // List smart groups in this DB
      const result = await runJxa("read", "listSmartGroups", [dbName]);
      return {
        contents: [{
          uri: uri,
          mimeType: "application/json",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }

    if (pathParts[0] === "smartgroup" && pathParts[1]) {
      // Read contents of a specific smart group
      // pathParts[1] is the smart group name or UUID
      // We first need to resolve it. 
      // listGroupContents expects a UUID or path.
      // If we pass a name, listGroupContents might fail if it expects UUID.
      // But my listGroupContents supports "Database" + "Path".
      // So if pathParts[1] is a name, we can pass dbName and "/" + pathParts[1]
      
      const identifier = decodeURIComponent(pathParts[1]);
      let result;
      
      // Try to treat identifier as UUID first?
      if (identifier.match(/^[A-F0-9-]{36}$/i)) { // Simple UUID check
         result = await runJxa("read", "listGroupContents", [JSON.stringify({ groupRef: identifier })]);
      } else {
         // Treat as name in root of DB
         // We construct a legacy call or just use listGroupContents logic?
         // listGroupContents in "legacy" mode takes (db, path).
         // But via JSON mode it takes groupRef (UUID).
         
         // I need a way to resolve name to UUID first?
         // Or update listGroupContents to handle db+path in JSON.
         // My listGroupContents.js supports legacy args arg1, arg2.
         // But passing JSON {"groupRef": "..."} assumes UUID.
         
         // Let's rely on UUIDs in URIs ideally.
         // But if user asks for "To Process", they use name.
         
         // I'll assume for now resources are listed with UUIDs in the list_smartgroups output?
         // listSmartGroups returns {name, uuid...}.
         // So if I use those to generate subsequent URIs, I should use UUIDs.
         // But here I am handling `devonthink://...`.
         
         // Let's try to lookup by name if not UUID.
         // I'll leverage the fact that listGroupContents accepts db+path if I pass raw args?
         // But runJxa passes JSON usually.
         
         // Actually, I can use the `listSmartGroups` logic to find it first.
         const groups = await runJxa("read", "listSmartGroups", [dbName]);
         const found = groups.smartGroups?.find(g => g.name === identifier || g.uuid === identifier);
         
         if (found) {
            result = await runJxa("read", "listGroupContents", [JSON.stringify({ groupRef: found.uuid })]);
         } else {
            throw new Error(`Smart group not found: ${identifier} in ${dbName}`);
         }
      }

      return {
        contents: [{
          uri: uri,
          mimeType: "application/json",
          text: JSON.stringify(result, null, 2)
        }]
      };
    }

    throw new Error(`Unknown resource path: ${uri}`);
    
  } catch (error) {
    throw new Error(`Failed to read resource ${uri}: ${error.message}`);
  }
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "queue_tasks": {
        const result = await addTasks(args.tasks, args.options);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "execute_queue": {
        const result = await executeQueue(args);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "get_queue_status": {
        const result = await getQueueStatus();
        if (!args.includeCompleted) {
           result.tasks = result.tasks.filter(t => t.status !== 'completed');
        }
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "clear_queue": {
        await clearQueue(args.scope);
        return { content: [{ type: "text", text: `Queue cleared (scope: ${args.scope || 'completed'})` }] };
      }

      case "verify_queue": {
        const result = await verifyQueue();
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "repair_queue": {
        const result = await aiRepairQueue(args);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }

      case "search_records": {
        const combinedQuery = buildSearchQuery(args.query, {
          createdAfter: args.createdAfter,
          createdBefore: args.createdBefore,
          modifiedAfter: args.modifiedAfter,
          modifiedBefore: args.modifiedBefore,
          addedAfter: args.addedAfter,
          addedBefore: args.addedBefore
        });
        const result = await runJxa("read", "search", [
          combinedQuery,
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
        const params = { uuid: args.uuid, type: args.type || "all" };
        if (args.database) params.database = args.database;
        const result = await runJxa("read", "getRelated", [JSON.stringify(params)]);
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

      case "manage_record": {
        const { action, uuid, name, type, content, database, destination, url, tags, comment, convertFormat, query } = args;
        
        let scriptName;
        let scriptArgs = {};

        switch (action) {
          case "create":
            scriptName = "createRecord";
            scriptArgs = {
              name,
              type: type || "markdown",
              content,
              database: database || process.env.DT_DEFAULT_DATABASE,
              groupPath: destination,
              url,
              tags,
              query
            };
            break;

          case "update":
            scriptName = "modifyRecordProperties";
            if (!uuid) throw new Error("UUID is required for update action");
            scriptArgs = {
              uuid,
              newName: name,
              tagsReplace: tags, // Assuming 'tags' arg means "set these tags"
              comment,
              // If URL update is needed, modifyRecordProperties doesn't strictly handle it, 
              // but we'll focus on metadata here. 
              // To update content, we'd need updateRecord.js, but let's keep it simple for now.
            };
            break;

          case "move":
             scriptName = "modifyRecordProperties";
             if (!uuid) throw new Error("UUID is required for move action");
             if (!destination) throw new Error("Destination is required for move action");
             scriptArgs = {
               uuid,
               destGroupUuid: destination
             };
             break;

          case "trash":
             scriptName = "deleteRecord";
             if (!uuid) throw new Error("UUID is required for trash action");
             // deleteRecord takes uuid as direct arg, not json, but our JXA runner can handle it?
             // No, our JXA runner expects json string for most. 
             // Wait, deleteRecord.js takes UUID as argv[4].
             // I need to check how I call runJxa. 
             // My runJxa wrapper passes args as process arguments.
             // deleteRecord expects: ... deleteRecord.js <uuid>
             // createRecord expects: ... createRecord.js '<json>'
             // I need to handle this difference.
             break;

          case "convert":
             scriptName = "convertRecord";
             if (!uuid) throw new Error("UUID is required for convert action");
             scriptArgs = {
               uuid,
               to: convertFormat,
               destGroupUuid: destination
             };
             break;

          default:
            throw new Error(`Unknown action: ${action}`);
        }

        // Special handling for deleteRecord which expects raw UUID
        if (action === "trash") {
             const result = await runJxa("write", "deleteRecord", [uuid]);
             return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
        }

        // All others expect JSON
        const result = await runJxa("write", scriptName, [JSON.stringify(scriptArgs)]);
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
