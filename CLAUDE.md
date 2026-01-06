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

# Run tests (requires DEVONthink running with "Test_Database" open)
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
  output.js            # Output formatting (JSON, quiet mode)
  utils.js             # Shared utilities (UUID detection, JXA code generation)
  commands/            # One file per command
jxa/
  read/                # Read-only operations (search, get, list)
  write/               # Mutating operations (create, modify, delete, import)
  utils/               # Utility scripts (isRunning, revealRecord)
test/
  helpers.js           # Test utilities
  *.test.js            # Test files
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
5. **Write unit tests** in `test/commands.test.js` (required before finalizing)
6. **Run `npm test`** to verify all tests pass

### Debugging JXA

Set DEBUG env to see generated scripts:

```bash
DEBUG=1 node bin/dt.js import file.pdf -d "Test"
```

## Testing

**Before finalizing any command or feature, always write and run unit tests.**

Tests require DEVONthink running with "Test_Database" open (UUID: `3DAB969D-B963-4056-ABE5-4990E2243F59`).

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

## Conventions

- Commands output JSON by default (pretty-printed)
- `--json` for compact, `--pretty` for formatted, `-q/--quiet` for minimal
- All write commands should return `{ success: true, uuid: "...", ... }`
- Group paths can have optional leading slash: `/path/to/group` or `path/to/group`
- Database is optional when group is specified by UUID (derived from group)
- Use `-t/--tag` as repeatable option for adding tags
