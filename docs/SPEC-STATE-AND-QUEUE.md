---
status: implemented
keywords: [specification, state, queue, design, architecture, verification, ai-repair]
---

# State Management & Task Queue System

> Documentation for persistent state, session tracking, and the batch task queue system for DEVONthink CLI and MCP server.

## Overview

The `dt` system utilizes three interconnected state layers stored in `~/.config/dt/`:

1. **Database Cache** - Cached metadata for open databases (reduces JXA overhead)
2. **Session State** - Recent access tracking and action history
3. **Task Queue** - Batch operations with validation, verification, and AI-powered repair.

---

## 1. Database Cache (`databases.yaml`)

Caches name, UUID, and path of all open databases.
- **TTL**: 3600 seconds (1 hour).
- **Refresh**: Triggered by `dt status` or `dt list databases --refresh`.
- **Purpose**: Eliminates redundant AppleScript calls for static metadata.

---

## 2. Session State (`state.yaml`)

Tracks user activity to provide context for the CLI and AI agents.

### Ring Buffers
- **Recent Databases**: Last 10 accessed.
- **Recent Groups**: Last 20 accessed.
- **Recent Records**: Last 30 accessed.

### Action History
Logs the last 100 write operations, including parameters and results. This serves as an audit trail and provides context for AI-powered troubleshooting.

---

## 3. Task Queue (`queue.yaml`)

The Task Queue enables atomic, optimized batch processing.

### Execution Lifecycle

1. **Addition**: Tasks added via `dt queue add` or `queue_tasks` tool.
2. **Validation**: Local schema and dependency check (`dt queue validate`).
3. **Verification**: Remote existence check against DEVONthink (`dt queue verify`).
4. **Repair (Optional)**: AI-powered restructuring if verification fails (`dt queue repair`).
5. **Execution**: Sequential execution with Look-Ahead Bundling.

### Look-Ahead Optimization
The executor bundles contiguous compatible tasks (e.g., multiple `move` or `tag` actions) into single JXA script calls (`batchMove.js`, `batchTag.js`, etc.), reducing execution time by up to 90%.

### Variable Resolution
Tasks can reference results from previous tasks using `$N.field` syntax:
- `$1.uuid`: UUID from task 1.
- `$2.result.path`: Deep field access.
- `$1.uuids`: Array expansion.

---

## 4. Verification & AI Repair

### Programmatic Verification
`dt queue verify` performs a "Deep Check" by querying DEVONthink to ensure:
- All source UUIDs exist.
- All target Database names/UUIDs are valid.
- All destination Group paths exist.

### AI-Powered Repair
`dt queue repair` consults DEVONthink's AI when a queue is invalid. 
- **Context Awareness**: The AI receives the task list, verification errors, and **Recent Session Context** (from `state.yaml`).
- **Intelligence**: It can fix typos in paths, suggest creating missing folders, or reorder tasks to satisfy dependencies.
- **Application**: Proposed fixes can be previewed or applied automatically with `--apply`.

---

## 5. File Structure

```
~/.config/dt/
├── databases.yaml      # Database cache
├── state.yaml          # Session state + history
├── queue.yaml          # Active task queue
├── queue.lock          # Write-lock for concurrency safety
└── tag-rules.yaml      # Tag normalization rules
```