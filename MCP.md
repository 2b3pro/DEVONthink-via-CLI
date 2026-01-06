# DEVONthink Model Context Protocol (MCP) Server

This CLI includes a built-in **MCP Server** that enables AI assistants (like **Claude Desktop**) to directly search, read, and navigate your DEVONthink databases.

## What is this?
The [Model Context Protocol (MCP)](https://modelcontextprotocol.io) is an open standard that allows AI models to connect to your local data. By running `dt mcp run`, you turn DEVONthink into a "knowledge provider" for your AI.

**Capabilities exposed to Claude:**
- **Search:** Full-text and metadata search of your databases.
- **Read:** Retrieve the plain text content of any record.
- **Navigate:** Follow "See Also" suggestions, Wiki Links, and Backlinks to traverse your knowledge graph.
- **Explore:** List contents of groups and folders.

## Setup for Claude Desktop

1. **Get your config snippet:**
   Run the following command in your terminal:
   ```bash
   dt mcp config
   ```
   This will output a JSON snippet tailored to your specific installation path.

2. **Edit Claude's Config:**
   Open (or create) the configuration file at:
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

3. **Paste the Config:**
   Add the snippet inside the `mcpServers` object. It should look something like this:

   ```json
   {
     "mcpServers": {
       "devonthink": {
         "command": "/path/to/your/node",
         "args": [
           "/usr/local/bin/dt",
           "mcp",
           "run"
         ],
         "env": {
           "PATH": "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
           "DT_ORGANIZE_PROMPT": "YOUR-SOP-RECORD-UUID-HERE",
           "DT_DEFAULT_DATABASE": "Inbox"
         }
       }
     }
   }
   ```

   **Environment Variables:**
   - `DT_ORGANIZE_PROMPT`: UUID of a record containing organization instructions.
   - `DT_SUMMARIZE_PROMPT`: UUID of a record containing summarization instructions.
   - `DT_DEFAULT_DATABASE`: Default database name or UUID for creating new records (optional).

4. **Restart Claude Desktop:**
   Quit and restart the Claude app. You should see a generic "hammer/tool" icon or indicator that the `devonthink` server is connected.

## Usage Examples

Once connected, you can ask Claude natural language questions that require access to your files:

> "Search my DEVONthink for notes about 'Machine Learning' and summarize the top 3 results."

> "Find the document 'Project Alpha' and tell me what other documents link to it."

> "Read my 'Meeting Notes' folder and list all action items."

> "Using the 'See Also' connections, find surprising links between my history notes and my economics notes."

> "Summarize the files in my 'To Read' smart group."

> "Check my 'SOPs' smart group for instructions on how to file this receipt."

## Resources

The server exposes DEVONthink "Contexts" as read-only resources that the AI can attach to the conversation. This allows you to give the AI instant access to dynamic collections of files.

| URI Scheme | Description |
| :--- | :--- |
| `devonthink://inbox` | The contents of your Global Inbox. |
| `devonthink://selection` | The currently selected record(s) in the frontmost window. |
| `devonthink://{DB}/smartgroups` | A list of all root-level Smart Groups in database `{DB}`. |
| `devonthink://{DB}/smartgroup/{ID}` | The contents of a specific Smart Group (by Name or UUID). |

**How to use Resources:**
- **Context Injection:** "Refactor this code based on `@devonthink://selection`."
- **Queue Processing:** "Summarize everything in `@devonthink://Inbox/smartgroup/To_Process`."
- **Instruction Libraries:** Create a root Smart Group named "SOPs" and ask the AI to "Read my SOPs before starting."

## Troubleshooting

### "Server connection failed"
- Ensure `dt` is accessible in your path. The absolute path provided by `dt mcp config` is the safest bet.
- Ensure DEVONthink 4 is running. The server communicates with it via AppleScript.

### Permissions
- macOS may ask for permission for `Terminal`, `Node`, or `Claude` to control `DEVONthink`. Click "OK".

### Debugging
You can test the server manually in your terminal (it speaks JSON-RPC over stdin):
```bash
dt mcp run
```
(It will wait for input. This confirms it starts correctly.)

## Tools Reference

The server exposes the following tools to the AI:

| Tool | Description |
| :--- | :--- |
| `search_records` | Search for records using full-text or metadata. |
| `explore_devonthink` | List databases, current selection, group contents, or reveal items. |
| `manage_record` | Create, update, move, trash, or convert records. |
| `get_record_properties` | Fetch detailed metadata for a specific record UUID. |
| `get_record_content` | Read text/markdown content of a record. |
| `get_related_records` | Find backlinks, wiki links, similar items, or classify by data/tags. |
| `organize_record` | Perform OCR, rename, and tag a record intelligently. |
| `summarize_record` | Generate and save an AI summary of a record. |
| `queue_tasks` | Add multiple tasks to the execution queue (batch processing). |
| `execute_queue` | Run pending tasks in the queue (with optimization). |
| `get_queue_status` | Check the status of the task queue. |
| `verify_queue` | Perform a deep existence check of all resources in the queue. |
| `repair_queue` | Use AI to fix and restructure an invalid or failed queue. |
