# CLAUDE.md

This file provides guidance for Claude Code when working in this repository.

## Project Overview

DEVONthink MCP (`dt`) is a Node.js command-line and Model Context Protocol interface for DEVONthink 4 (DT, or DT4) on macOS. It wraps JXA (JavaScript for Automation) scripts to interact with DEVONthink via AppleScript.

## Build & Run Commands

```bash
# Install dependencies
npm install

# Link globally (makes 'dt' available everywhere)
npm link

# Run tests (requires DEVONthink running with "Test_Database" open) - Run targetted tests, unless entire suite is necessary
npm test

# Run with verbose output
npm test -- --test-reporter=spec

# Run single command directly
node bin/dt.js <command>
```

## Architecture

Two-layer architecture:
1. **Node.js CLI Layer** (`src/`, `bin/`) - Commander.js-based CLI that handles argument parsing, validation, and output formatting
2. **JXA Script Layer** (`jxa/`) - JavaScript for Automation scripts executed via `osascript`

### Directory Structure

```
bin/dt.js              # Entry point
src/
  index.js             # Commander program setup, registers all commands
  jxa-runner.js        # Executes JXA via osascript, parses JSON responses
  mcp-server.js        # MCP server implementation
  output.js            # Output formatting (JSON, quiet mode)
  utils.js             # Shared utilities (UUID detection, JXA code generation)
  rules-loader.js      # Tag normalization rules engine (YAML config)
  commands/            # One file per command
jxa/
  read/                # Read-only operations (search, get, list, tags)
  write/               # Mutating operations (create, modify, delete, import, tags)
  utils/               # Utility scripts (isRunning, revealRecord)
docs/
  PLANS.md             # Development roadmap
  SPEC-*.md            # Feature specifications
test/
  helpers.js           # Test utilities
  fixtures/            # Test data files (YAML rules, etc.)
  *.test.js            # Test files
~/.config/dt/          # User config directory (created at runtime)
  tag-rules.yaml       # Global tag normalization rules
  databases/           # Per-database config overrides
```

### Command Pattern

Each command follows this structure:

```javascript
// src/commands/example.js
import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerExampleCommand(program) {
  program
    .command('example <arg>')
    .description('Description here')
    .option('-d, --database <name>', 'Target database')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON')
    .option('-q, --quiet', 'Minimal output')
    .option('-P, --prompt-record <uuid>', 'UUID of a record to use as a prompt')
    .action(async (arg, options) => {
      try {
        await requireDevonthink();
        const result = await runJxa('read', 'scriptName', [JSON.stringify({ arg, ...options })]);
        print(result, options);
        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
```

### JXA Script Pattern

JXA scripts receive JSON arguments and return JSON responses:

```javascript
// jxa/read/example.js
ObjC.import("Foundation");

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({ success: false, error: 'Usage: example.js \'{"arg":"..."}\'' });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const app = Application("DEVONthink");
    // ... do work ...
    JSON.stringify({ success: true, result: "..." });
  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
```

## Key Patterns

### UUID Detection

UUIDs can be raw (`ABC123-DEF456`) or item URLs (`x-devonthink-item://ABC123-DEF456`):

```javascript
import { isUuid, extractUuid } from '../utils.js';

if (isUuid(ref)) {
  const uuid = extractUuid(ref);  // strips URL prefix if present
}
```

### Database + Group Resolution

When `-g` is a UUID, database can be derived from the group. Use the shared helper:

```javascript
import { jxaResolveDatabaseAndGroup } from '../utils.js';

// In JXA template - generates code that:
// - If groupRef is UUID: gets group by UUID, derives database
// - If groupRef is path: requires dbRef, navigates path
const code = jxaResolveDatabaseAndGroup('db', 'destination', dbRef, groupRef, true);
```

### Repeatable Options (Tags)

```javascript
function collectTags(value, previous) {
  return previous.concat([value]);
}

program
  .option('-t, --tag <tag>', 'Add tag (repeatable)', collectTags, [])
```

### JXA String Escaping

Always escape strings for JXA templates:

```javascript
import { escapeString } from '../utils.js';

const jxa = `record.name = "${escapeString(name)}";`;
```

### Stdin Support

Commands can accept content or UUIDs from stdin using `-` as a marker:

```javascript
import { readStdin, readUuidsFromStdin, isStdinMarker } from '../utils.js';

// For content (create, update)
if (isStdinMarker(options.content)) {
  const content = await readStdin();
}

// For UUID lists (move, delete, batch)
if (uuids.length === 1 && isStdinMarker(uuids[0])) {
  const uuids = await readUuidsFromStdin();  // parses one UUID per line
}
```

Stdin utilities in `utils.js`:
- `readStdin()` - Read all stdin content as trimmed string
- `readUuidsFromStdin()` - Read UUIDs from stdin (one per line, supports `x-devonthink-item://` URLs)
- `isStdinMarker(value)` - Check if value is `-`

## JXA/AppleScript Translation

DEVONthink's AppleScript commands translate to JXA:

| AppleScript | JXA |
|-------------|-----|
| `import path` | `app.importPath(path, {to: group})` |
| `ocr {file: f}` | `app.ocr({file: f, to: group})` |
| `transcribe record` | `app.transcribe({record: record, ...options})` |
| `get chat response for message` | `app.getChatResponseForMessage(prompt, {record: record})` |
| `create record with {name: n}` | `app.createRecordWith({name: n}, {in: group})` |
| `get record with uuid` | `app.getRecordWithUuid(uuid)` |
| `merge records` | `app.merge({records: [records]})` |
| `get tag groups` | `database.tagGroups()` |
| `consolidate tags` | `app.consolidate({tags: [tag1, tag2]})` |

### Consulting the Scripting Dictionary

JXA and AppleScript syntax can be picky. When uncertain about method names, parameters, or enumerations, consult DEVONthink's scripting dictionary:

```bash
# Search for a specific command or property
sdef /Applications/DEVONthink.app 2>/dev/null | grep -A 20 "transcribe"
sdef /Applications/DEVONthink.app 2>/dev/null | grep -A 20 "import"

# View full dictionary
sdef /Applications/DEVONthink.app 2>/dev/null | less
```

The sdef output shows AppleScript syntax. Remember to translate to JXA conventions (camelCase method names, object parameters instead of labeled arguments).

## Common Operations

### Adding a New Command

1. Create `src/commands/newcmd.js` with `registerNewcmdCommand(program)` function
2. Create corresponding JXA script in `jxa/read/` or `jxa/write/`
3. Import and register in `src/index.js`
4. Add to shell completions in `src/index.js` if needed
5. **Write unit tests** in `test/commands.test.js` (required before finalizing) - Test granularly, unless running all the tests are vital
6. **Run `npm test`** to verify all tests pass

### Debugging JXA

Set DEBUG env to see generated scripts:

```bash
DEBUG=1 node bin/dt.js import file.pdf -d "Test"
```

## Testing

**Before finalizing any command or feature, always write and run unit tests.** Unless necessary, do targeted tests, so we're not running the whole suite.

Tests require DEVONthink running with "Test_Database" open (UUID: `3DAB969D-B963-4056-ABE5-4990E2243F59`).

Current test count: **103 tests** (as of v2.1.1)

### Running Tests

```bash
# Run all tests
npm test

# Run with verbose output
npm test -- --test-reporter=spec
```

### Writing Tests

Tests go in `test/commands.test.js` using Node.js native test runner:

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  runCommand,
  createTestRecord,
  createTestGroup,
  deleteTestRecord,
  getRecordProps,
  recordExists,
  cleanupTestRecords,
  uniqueName,
  TEST_DATABASE
} from './helpers.js';

// Track records for cleanup
const createdRecords = [];

describe('my-command', () => {
  let testRecordUuid;

  before(async () => {
    testRecordUuid = await createTestRecord({
      name: uniqueName('MyTest'),
      type: 'markdown',
      content: 'Test content'
    });
    createdRecords.push(testRecordUuid);
  });

  after(async () => {
    await cleanupTestRecords(createdRecords);
  });

  it('should do something', async () => {
    const result = await runCommand(['my-command', testRecordUuid]);
    assert.strictEqual(result.success, true);
  });

  it('should fail gracefully on invalid input', async () => {
    const result = await runCommand(['my-command', 'INVALID'], { expectFailure: true });
    assert.strictEqual(result.success, false);
  });
});
```

### Test Helpers

| Helper | Purpose |
|--------|---------|
| `runCommand(args, opts)` | Execute CLI command, returns parsed JSON |
| `runCommandWithStdin(args, stdinInput, opts)` | Execute command with stdin input |
| `createTestRecord({name, type, content, group, tags})` | Create record, returns UUID |
| `createTestGroup(name, parent)` | Create group, returns UUID |
| `deleteTestRecord(uuid)` | Move record to trash |
| `getRecordProps(uuid)` | Get record properties directly |
| `recordExists(uuid)` | Check if record exists |
| `cleanupTestRecords(uuids)` | Batch delete for cleanup |
| `uniqueName(prefix)` | Generate unique test name with timestamp |

### Test Patterns

1. **Always clean up** - Track created records and delete in `after()` hook
2. **Use unique names** - Prevent conflicts with `uniqueName()` helper
3. **Test both success and failure** - Use `{ expectFailure: true }` option
4. **Test edge cases** - Invalid UUIDs, missing databases, empty inputs

## MCP Server

The MCP server (`src/mcp-server.js`) exposes DEVONthink functionality via the Model Context Protocol for AI assistants like Claude.

### Running the MCP Server

```bash
# Direct
node bin/dt.js mcp run

# Via Claude Desktop config
dt mcp config  # Shows config to add to Claude Desktop
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `search_records` | Full-text and metadata search |
| `get_record_properties` | Get record metadata |
| `get_record_content` | Get plain text/markdown content |
| `get_related_records` | Find backlinks, wiki links, similar records |
| `explore_devonthink` | Navigate databases, selection, groups |
| `list_group_contents` | List contents of a group |
| `organize_record` | AI-powered OCR, rename, tag, summarize |
| `summarize_record` | Generate AI summary |
| `manage_record` | Create, update, move, trash, convert records |

### MCP Resources

- `devonthink://inbox` - Global Inbox contents
- `devonthink://selection` - Currently selected records
- `devonthink://<dbname>/smartgroups` - Smart groups in database

## Tag Management

The `dt tags` command provides comprehensive tag operations with a rules-based normalization engine.

### Tag Commands

```bash
# List all tags in a database
dt tags list -d "Database Name"
dt tags list -d "Database" --sort alpha --min-count 5

# Analyze tag problems (case variants, malformed, low-use)
dt tags analyze -d "Database"

# Merge tags (consolidate sources into target)
dt tags merge --target "correct-tag" --sources "Wrong,WRONG" -d "Database"

# Rename a tag
dt tags rename --from "old-name" --to "new-name" -d "Database"

# Delete a tag
dt tags delete --tag "unwanted-tag" -d "Database"

# Normalize with rules (dry-run by default)
dt tags normalize -d "Database" --auto          # Auto-generate rules
dt tags normalize -d "Database" -r rules.yaml   # Use rules file
dt tags normalize -d "Database" --apply         # Execute changes

# Show config paths
dt tags config -d "Database"
```

### Tag Rules File Format

Rules are loaded from a hierarchy: global → database-specific → explicit file.

```yaml
# ~/.config/dt/tag-rules.yaml (global)
# ~/.config/dt/databases/<db-slug>.yaml (per-database)

version: 1

case:
  strategy: lowercase  # lowercase | uppercase | titlecase | preserve | preserve_first

merges:
  - target: "correct-tag"
    sources: ["Wrong-Tag", "wrong_tag"]

renames:
  - from: "old-name"
    to: "new-name"

deletions:
  - "tag-to-delete"
  - "another-unwanted"

patterns:
  - match: "^\\s+"      # Regex pattern
    action: strip       # strip | trim | delete

blocklist:
  - "temp"
  - "test"

preserve:
  - "DontTouchThis"     # Tags to never modify
```

### Rules Loader (`src/rules-loader.js`)

```javascript
import { loadRules, planChanges } from '../rules-loader.js';

// Load rules from config hierarchy
const rules = await loadRules({
  database: 'My Database',  // For database-specific rules
  rulesFile: 'custom.yaml', // Override with explicit file
  noGlobal: false           // Skip global rules if true
});

// Plan changes without executing
const { changes, summary } = planChanges(tags, rules);
// changes: [{ action: 'merge'|'rename'|'delete', ... }]
// summary: { merges: N, renames: N, deletes: N, totalAffectedRecords: N }
```

## Task Queue & Batch Operations

The Queue System (`dt queue`) enables atomic batch operations, minimizing JXA overhead and managing large tasks effectively.

### Queue Commands

```bash
# Add tasks to queue
dt queue add create --name "Doc 1" --type markdown --database "Inbox"
dt queue add move --uuid "UUID" --destination "/Archive"
dt queue add tag.add --uuids "U1,U2" --tags "t1,t2"

# View status
dt queue status
dt queue list

# Verification & AI Repair
dt queue verify             # Deep check against DEVONthink
dt queue repair             # Consult AI for fixes
dt queue repair --apply     # Apply AI fixes

# Execute pending tasks (with automatic batch optimization)
dt queue execute
dt queue execute --dry-run
dt queue execute --verbose

# Manage
dt queue clear --scope completed
dt queue load tasks.json    # Load bulk tasks from file
```

### Queue Features

1.  **Look-Ahead Optimization**: Consecutive compatible tasks (e.g., 50 `move` operations) are bundled into a single JXA call (`batchMove.js`), reducing execution time significantly.
2.  **Dependencies**: Tasks can reference results of previous tasks using `$N.uuid` syntax.
    ```yaml
    - id: 1
      action: create
      params: { name: "Folder" }
    - id: 2
      action: move
      params: { uuid: "old-doc", destination: "$1.uuid" } # Moves to new Folder
    ```
3.  **Persistence**: Queue state is saved to `~/.config/dt/queue.yaml`.
4.  **Session Tracking**: Access history is logged to `~/.config/dt/state.yaml`.

### Queue JXA Scripts (`jxa/write/batch*.js`)

Specialized scripts handle batched operations:
- `batchMove.js`: Moves multiple records to (potentially different) destinations.
- `batchTag.js`: Adds, removes, or sets tags for multiple records.
- `batchUpdate.js`: Updates properties (name, comment, label, etc.) for multiple records.
- `batchDelete.js`: Deletes multiple records.

## Conventions

- Commands output JSON by default (pretty-printed)
- `--json` for compact, `--pretty` for formatted, `-q/--quiet` for minimal
- All write commands should return `{ success: true, uuid: "...", ... }`
- Group paths can have optional leading slash: `/path/to/group` or `path/to/group`
- Database is optional when group is specified by UUID (derived from group)
- Use `-t/--tag` as repeatable option for adding tags
- Config files use YAML format in `~/.config/dt/`
- Use the helper function to prepare the UUIDs as sometimes user may provide it in the form of a `x-devonthink-item://` URL
- Applescript/JXA dictionary is here - refer to it often as it will save you time: `sdef /Applications/DEVONthink.app`

## Updates

- After any changes, appropriately manage versioning and update the following:
  - `docs/CLI-REFERENCE.md` and `README.md`
  - `/Volumes/Xarismata/.config/pai/Infrastructure/DevonThink/cli-reference.md`