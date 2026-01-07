# Configuration Directory Reference

The `dt` CLI stores configuration, cache, and state files in `~/.config/dt/`. This directory is created automatically on first use.

## Directory Structure

```
~/.config/dt/
├── databases.yaml      # Database metadata cache
├── state.yaml          # Session state + history
├── queue.yaml          # Active task queue
├── queue.lock          # Lock file for queue operations
├── tag-rules.yaml      # Global tag normalization rules
└── databases/          # Per-database configuration
    ├── inbox.yaml
    ├── my-research.yaml
    └── ...
```

## Environment Override

Set `DT_CONFIG_DIR` to use a custom location:

```bash
export DT_CONFIG_DIR=/path/to/custom/config
```

---

## File Reference

### `databases.yaml`

**Purpose:** Caches database metadata to avoid repeated JXA calls.

**TTL:** 1 hour (3600 seconds) by default

**Structure:**

```yaml
version: 1
lastUpdated: "2025-01-06T12:00:00.000Z"
ttl: 3600
databases:
  - uuid: "3DAB969D-B963-4056-ABE5-4990E2243F59"
    name: "Inbox"
    path: "/Users/you/Databases/Inbox.dtBase2"
    recordCount: 1523
    tagCount: 89
```

**Managed by:** `src/cache.js`

**Related commands:**
- `dt list databases` - Reads from cache, refreshes if stale
- `dt status --refresh` - Forces cache invalidation

---

### `state.yaml`

**Purpose:** Tracks session history and recently accessed items for context-aware operations and undo support.

**Ring buffer limits:**
- Recent databases: 10
- Recent groups: 20
- Recent records: 30
- History entries: 100

**Structure:**

```yaml
version: 1
lastUpdated: "2025-01-06T12:30:00.000Z"

recent:
  databases:
    - uuid: "ABC123"
      name: "Research"
      path: "/path/to/db"
      accessedAt: "2025-01-06T12:30:00.000Z"
      accessCount: 42

  groups:
    - uuid: "DEF456"
      name: "Projects/Active"
      path: "/Projects/Active"
      database: "Research"
      databaseUuid: "ABC123"
      accessedAt: "2025-01-06T12:25:00.000Z"

  records:
    - uuid: "GHI789"
      name: "Meeting Notes"
      type: "markdown"
      database: "Research"
      databaseUuid: "ABC123"
      accessedAt: "2025-01-06T12:20:00.000Z"

history:
  - id: "h_1704556200000_a1b2c"
    action: "move"
    timestamp: "2025-01-06T12:10:00.000Z"
    params:
      uuid: "JKL012"
      destination: "/Archive"
    result:
      success: true
      uuid: "JKL012"
    reversible: true
    reverseAction:
      action: "move"
      params:
        uuid: "JKL012"
        destination: "/Projects/Active"
```

**Managed by:** `src/state.js`

**Used for:**
- AI repair context (recent items help resolve ambiguous references)
- Future undo functionality
- Session continuity across CLI invocations

---

### `queue.yaml`

**Purpose:** Stores pending batch operations for atomic execution with dependency tracking.

**Structure:**

```yaml
version: 1
id: "q_1704556200000"
createdAt: "2025-01-06T12:00:00.000Z"
status: "pending"  # pending | executing | completed | failed

options:
  mode: "sequential"       # sequential | parallel (future)
  stopOnError: true        # Halt on first failure
  rollbackOnError: false   # Revert completed tasks on failure (future)
  validateBeforeExecute: true
  verbose: false

tasks:
  - id: 1
    action: "create"
    status: "pending"      # pending | completed | failed | skipped
    params:
      type: "markdown"
      name: "New Document"
      database: "Inbox"
    dependsOn: []
    result: null
    error: null
    addedAt: "2025-01-06T12:00:00.000Z"

  - id: 2
    action: "move"
    status: "pending"
    params:
      uuid: "$1.uuid"      # Variable reference to task 1 result
      destination: "/Archive"
    dependsOn: [1]
    result: null
    error: null
    addedAt: "2025-01-06T12:00:00.000Z"

summary:
  total: 2
  pending: 2
  completed: 0
  failed: 0

executionLog: []
```

**Managed by:** `src/queue.js`

**Related commands:**
- `dt queue add <action>` - Add tasks
- `dt queue status` - View queue state
- `dt queue execute` - Run pending tasks
- `dt queue verify` - Validate resources exist
- `dt queue repair` - AI-powered fix suggestions
- `dt queue clear` - Remove completed/failed tasks

**Supported actions:**
| Action | Required Params |
|--------|-----------------|
| `create` | `type`, `name` |
| `delete` | `uuid` |
| `move` | `uuid`, `destination` |
| `modify` | `uuid` |
| `replicate` | `uuid`, `destination` |
| `duplicate` | `uuid`, `destination` |
| `tag.add` | `uuids`, `tags` |
| `tag.remove` | `uuids`, `tags` |
| `tag.set` | `uuids`, `tags` |
| `tag.merge` | `target`, `sources` |
| `tag.rename` | `from`, `to` |
| `tag.delete` | `tag` or `tags` |
| `link` | `source`, `target` |
| `unlink` | `source`, `target` |
| `convert` | `uuid`, `format` |
| `organize` | `uuid` |
| `summarize` | `uuid` |
| `chat` | `prompt` or `promptRecord` |

---

### `queue.lock`

**Purpose:** Prevents concurrent queue modifications. Contains PID of the process holding the lock.

**Behavior:**
- Created when acquiring lock (retries up to 10 times with 100ms delay)
- Deleted when lock is released
- If stale (owning process died), safe to delete manually

---

### `tag-rules.yaml`

**Purpose:** Global tag normalization rules applied to all databases.

**Structure:**

```yaml
version: 1

case:
  strategy: lowercase  # lowercase | uppercase | titlecase | preserve | preserve_first

merges:
  - target: "machine-learning"
    sources: ["ML", "ml", "MachineLearning"]

renames:
  - from: "oldname"
    to: "newname"

deletions:
  - "temp"
  - "test"

patterns:
  - match: "^\\s+"      # Leading whitespace
    action: strip       # strip | trim | delete
  - match: "^_"         # Underscore prefix
    action: delete

blocklist:
  - "todo"
  - "fixme"

preserve:
  - "API"               # Never modify these tags
  - "iOS"
```

**Managed by:** `src/rules-loader.js`

**Related commands:**
- `dt tags normalize -d "DB"` - Dry-run normalization
- `dt tags normalize -d "DB" --apply` - Execute changes
- `dt tags config` - Show config file paths

---

### `databases/<db-slug>.yaml`

**Purpose:** Database-specific tag rules that override/extend global rules.

**Naming:** Database name is slugified (lowercase, spaces to hyphens, alphanumeric only)
- "My Research" → `my-research.yaml`
- "Hypnosis & NLP" → `hypnosis-nlp.yaml`

**Structure:** Same as `tag-rules.yaml`

**Merge behavior:**
1. Global rules load first
2. Database-specific rules merge on top:
   - `case.strategy` - Overrides
   - `merges` - Appends (deduped by target)
   - `renames` - Appends (deduped by from)
   - `deletions` - Appends (deduped)
   - `blocklist` - Appends (deduped)
   - `patterns` - Appends
   - `preserve` - Appends (deduped)

**Special directive:**
```yaml
extends: none  # Start fresh, ignore global rules
```

---

## Config Hierarchy

Rules are loaded in priority order (later overrides earlier):

1. **Global rules** (`~/.config/dt/tag-rules.yaml`)
2. **Database-specific rules** (`~/.config/dt/databases/<slug>.yaml`)
3. **Explicit file** (`-r /path/to/rules.yaml`)

Use `--no-global` to skip global rules entirely.

---

## Backup & Sync

The config directory can be:
- Backed up with your dotfiles
- Symlinked to a synced location (e.g., iCloud, Dropbox)
- Part of your PAI infrastructure

```bash
# Example: Symlink to external drive
ln -s /Volumes/Xarismata/.config/dt ~/.config/dt
```

---

## Troubleshooting

**Cache issues:**
```bash
# Force refresh database cache
dt list databases --refresh

# Clear all cache
rm ~/.config/dt/databases.yaml
```

**Queue stuck:**
```bash
# Check for stale lock
cat ~/.config/dt/queue.lock

# Remove stale lock (only if process is dead)
rm ~/.config/dt/queue.lock

# Clear entire queue
dt queue clear --scope all
```

**Rules not applying:**
```bash
# Show which files are loaded
dt tags config -d "Database Name"

# Validate rules file syntax
cat ~/.config/dt/tag-rules.yaml | python -c "import sys,yaml; yaml.safe_load(sys.stdin)"
```
