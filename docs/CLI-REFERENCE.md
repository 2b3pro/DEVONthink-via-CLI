---
title: DEVONthink CLI Reference
version: 2.2.13
updated: 2026-01-11
description: CLI for DEVONthink 4. Search, import, organize, tag, transcribe, chat, and batch operations.
---

# DEVONthink CLI Reference (v2.2.13)

> CLI and MCP interface for DEVONthink 4. Search records, import files, organize content, manage tags, transcribe media, AI chat, and batch operations.

## When to Use

| Context | Use | Why |
|---------|-----|-----|
| **PAI/Claude Code** | MCP tools (`mcp__devonthink__*`) | Direct calls, structured JSON, parallel execution |
| **Terminal / Scripts** | This CLI | Scriptable, works outside PAI |

**Inside Claude Code (or other AI coder):** Prefer `search_records`, `get_record_content`, `manage_record`, `organize_record`, etc.
**This reference:** For manual terminal use, shell scripts, and external automation.

---

Note: If you make changes to the actual script at `/Volumes/Xarismata/Projects/CLI_Tools/devonthink-cli/`, update this reference.
- Currently `dt` is linked via `npm link` from the project

## Quick Comparison: `search` vs `get`

| Feature | `dt search` | `dt get` |
|---------|-------------|----------|
| **Purpose** | Find records by query/tags/metadata | Get specific record info |
| **Output** | List of matching records | Single record details |
| **Use case** | Discovery, filtering | Reading props, content, related |

## Basic Usage

```bash
# Search for records
dt search q "machine learning" -d "Research"

# Get record properties
dt get props ABCD-1234

# Get record content (plain text)
dt get preview ABCD-1234

# Import a file
dt import "/path/to/file.pdf" -d "Research" -g "/Papers"

# Create a record
dt create record -n "Note Title" -T markdown -d "Inbox" -c "# Content"

# Modify record metadata
dt modify ABCD-1234 --add-tag urgent --comment "Review soon"

# Move a record
dt move ABCD-1234 --to "/Archive" -d "Research"

# Organize intelligently (OCR, rename, tag, summarize)
dt organize ABCD-1234 --auto

# List databases
dt list databases
```

## Commands

### Search Commands

#### `dt search query` — Full-text Search

| Option | Purpose | Default |
|--------|---------|---------|
| `<query>` | Search query (DEVONthink syntax) | |
| `-d, --database <name>` | Search within database | all |
| `-g, --group <uuid>` | Search within group | |
| `-l, --limit <n>` | Maximum results | 50 |
| `-t, --type <type>` | Filter by type (markdown, pdf, etc.) | |
| `-c, --comparison <mode>` | Search mode: fuzzy, "no case", "no umlauts", related | |
| `--created-after <date>` | Filter by creation date | |
| `--created-before <date>` | Filter by creation date | |
| `--modified-after <date>` | Filter by modification date | |
| `--modified-before <date>` | Filter by modification date | |
| `--exclude-subgroups` | Do not search in subgroups | |
| `--json` | Raw JSON output | |
| `-q, --quiet` | Only output UUIDs | |

```bash
# Basic search
dt search q "project plan"
dt search q "machine learning" -d "Research"

# Date filtering (supports relative dates like "2 weeks")
dt search q "client" --created-after "2 weeks"
dt search q "report" --modified-before "2024-12-31"

# Type filtering
dt search q "architecture" --type pdf

# Advanced query syntax
dt search q "tags:urgent AND kind:pdf"
dt search q "name:report* NOT tags:draft"
```

**Query Syntax Tips:**
- `name:term` - Search in name only
- `tags:term` - Search by tag
- `kind:type` - Filter by kind (pdf, markdown, etc.)
- `content:term` - Search content only
- `AND`, `OR`, `NOT` - Boolean operators
- `*` - Wildcard

#### `dt search tags` — Search by Tags

| Option | Purpose | Default |
|--------|---------|---------|
| `<tag...>` | Tags to search for | |
| `-a, --any` | Match any tag (OR logic) | match all (AND) |
| `-d, --database <name>` | Search within database | all |
| `-q, --quiet` | Only output UUIDs | |

```bash
# Find records with specific tags
dt search tags urgent client
dt search tags "to-review" "2024" --any -d "Research"
```

#### Other Search Subcommands

```bash
# Search by filename
dt search file "report.pdf"

# Search by path
dt search path "/Research/Papers"

# Search by URL
dt search url "https://example.com"

# Search by comment
dt search comment "review"

# Search by content hash
dt search hash "abc123..."
```

---

### Get Commands

#### `dt get props` — Get Record Properties

| Option | Purpose | Default |
|--------|---------|---------|
| `<uuid>` | Record UUID | |
| `--fields <fields>` | Comma-separated properties to return | all |
| `--json` | Raw JSON output | |
| `-q, --quiet` | Only output UUID | |

```bash
# Get all properties
dt get props ABCD-1234

# Get specific fields
dt get props ABCD-1234 --fields "uuid,name,tags,location"

# Accept x-devonthink-item:// URLs
dt get props x-devonthink-item://ABCD-1234
```

**Available Fields:**
`uuid`, `name`, `filename`, `path`, `location`, `database`, `recordType`, `kind`, `mimeType`, `tags`, `comment`, `rating`, `label`, `flag`, `unread`, `locked`, `indexed`, `creationDate`, `modificationDate`, `additionDate`, `size`, `wordCount`, `pageCount`, `duration`, `width`, `height`

#### `dt get preview` — Get Plain Text Content

| Option | Purpose | Default |
|--------|---------|---------|
| `<uuid>` | Record UUID | |
| `-l, --length <chars>` | Maximum characters | 3000 |
| `-q, --quiet` | Only output text | |

```bash
dt get preview ABCD-1234
dt get preview ABCD-1234 -l 500 --quiet
```

#### `dt get related` — Get Related Records

| Option | Purpose | Default |
|--------|---------|---------|
| `<uuid>` | Record UUID | |
| `-t, --type <type>` | Relation type: incoming, outgoing, similar, all | all |
| `--by-data` | Find related by data comparison | |
| `--by-tags` | Find related by tags | |
| `-d, --database <name>` | Limit classification scope | |
| `-l, --limit <n>` | Limit results | 20 |

```bash
# Get all relations
dt get related ABCD-1234

# Get backlinks (incoming)
dt get related ABCD-1234 --type incoming

# Find similar by content
dt get related ABCD-1234 --by-data -l 10
```

#### `dt get selection` — Get Selected Records

```bash
# Get currently selected records in DEVONthink
dt get selection
dt get selection --quiet  # UUIDs only
```

#### Other Get Subcommands

```bash
# Get word concordance
dt get concordance ABCD-1234

# Get file path
dt get filepath ABCD-1234

# Get database path
dt get dbpath ABCD-1234

# Get custom metadata field
dt get metadata ABCD-1234 "MyField"

# List all custom metadata
dt get metadata-list ABCD-1234
```

---

### List Commands

#### `dt list databases` — List Open Databases

```bash
dt list databases
dt list dbs --json
```

#### `dt list group` — List Group Contents

| Option | Purpose | Default |
|--------|---------|---------|
| `[target]` | Database name or group UUID | |
| `[path]` | Path within database | / |
| `-D, --depth <n>` | Levels to traverse (1=direct, -1=unlimited) | 1 |
| `-q, --quiet` | Only output UUIDs | |

Returns flat array with `level` field indicating nesting depth. Groups include `itemCount` (document count).

```bash
# List by database and path
dt list group "Research" "/Papers/2024"

# List by group UUID
dt list group ABCD-1234

# Recursive listing (2 levels deep)
dt list group ABCD-1234 --depth 2

# Full tree (all levels)
dt list group "Research" "/" --depth -1
```

#### `dt list inbox` — List Inbox Items

```bash
dt list inbox
dt list inbox --json
```

#### `dt list tag` — List Records by Tag

```bash
dt list tag "urgent"
dt list tag "project" -d "Research"
```

#### `dt tree` — Display Folder Hierarchy

Generate a visual tree of the database folder structure. Useful for LLM context injection, auditing, and documentation.

| Option | Purpose | Default |
|--------|---------|---------|
| `[path]` | Start path (subtree) | / |
| `-d, --database <name>` | Target database | current |
| `--depth <n>` | Maximum depth | 10 |
| `--counts` | Include item counts per folder | |
| `--exclude-system` | Exclude system folders (_INBOX, Tags, Trash) | |
| `-s, --smart-groups` | Include smart groups (shown in brackets) | |
| `--json` | JSON output with tree structure | |
| `-q, --quiet` | Only output tree text | |

```bash
# Full tree of current database
dt tree

# Tree of specific database
dt tree -d "Research"

# Subtree from path, limited depth
dt tree "/05—Education" --depth 2

# With item counts
dt tree --counts

# Exclude system folders
dt tree --exclude-system

# Include smart groups (shown in brackets)
dt tree --smart-groups

# JSON output for scripting
dt tree -d "PAI Brain" --json
```

**Output (text):**
```
Research/
├── 01—Health/
│   ├── Projects/
│   └── Reference/ (42)
├── 05—Education/
│   └── Papers/
├── Annotations/
├── (All PDFs)
└── (Recent Items)
```

Smart groups appear in brackets `(Smart Group Name)` when `--smart-groups` is enabled.

**Use cases:**
- Inject folder structure into classification prompts
- Audit folder organization
- Generate folder documentation

---

### Create Commands

#### `dt create record` — Create a New Record

| Option | Purpose | Default |
|--------|---------|---------|
| `-n, --name <title>` | Record name | |
| `-T, --type <type>` | Record type | markdown |
| `-d, --database <name>` | Target database | |
| `-g, --group <path>` | Destination group | / |
| `-c, --content <text>` | Content (use `-` for stdin) | |
| `-f, --file <path>` | Read content from file | |
| `-t, --tag <tag>` | Add tag (repeatable) | |
| `-u, --url <url>` | URL for bookmarks | |
| `--query <query>` | Search query (smart group) | |
| `--queue` | Add to queue instead | |

**Record Types:** `markdown`, `txt`, `rtf`, `bookmark`, `html`, `group`, `smart group`

```bash
# Create markdown document
dt create record -n "Meeting Notes" -T markdown -d "Inbox" -c "# Notes"

# Create from stdin
echo "# My Document" | dt create record -n "Doc" -d "Inbox" -c -

# Create from file
dt create record -n "Report" -d "Research" -f ./report.md

# Create bookmark
dt create record -n "Link" -T bookmark -d "Inbox" -u "https://example.com"

# Create group
dt create record -n "New Folder" -T group -d "Research" -g "/Projects"

# Create smart group
dt create record -n "Urgent PDFs" -T "smart group" -d "Research" --query "tags:urgent AND kind:pdf"
```

#### Other Create Subcommands

```bash
# Create bookmark
dt create bookmark "https://example.com" -d "Inbox" -n "Example Site"

# Create markdown from web page
dt create markdown "https://example.com" -d "Inbox"

# Create PDF from web page
dt create pdf "https://example.com" -d "Inbox"

# Create web archive
dt create web "https://example.com" -d "Inbox"

# Generate AI image
dt create image "A sunset over mountains" -d "Inbox"
```

---

### Modify & Update Commands

#### `dt modify` — Set Record Properties

Set metadata and attributes of record(s). Supports multiple UUIDs and stdin input. Counterpart to `get props`. To modify content, use `update`.

| Option | Purpose | Default |
|--------|---------|---------|
| `<uuid...>` | Record UUID(s), or `-` for stdin | |
| `-n, --name <name>` | Rename record | |
| `-c, --comment <text>` | Set comment | |
| `--add-tag <tag>` | Add tag (repeatable) | |
| `--remove-tag <tag>` | Remove tag (repeatable) | |
| `--set-tags <tags...>` | Replace all tags | |
| `--label <0-7>` | Set label index | |
| `--rating <0-5>` | Set rating | |
| `--flag` / `--no-flag` | Set/clear flagged status | |
| `--aliases <text>` | Set wiki aliases (comma/semicolon separated) | |
| `--url <url>` | Set URL (for bookmark records) | |
| `--unread` / `--no-unread` | Mark as unread/read | |
| `--meta <key=value>` | Set custom metadata (repeatable) | |
| `-m, --move-to <dest>` | Move to destination | |
| `--queue` | Add to queue instead | |

```bash
# Rename
dt modify ABCD-1234 --name "New Title"

# Modify tags
dt modify ABCD-1234 --add-tag urgent --remove-tag draft

# Set comment and metadata
dt modify ABCD-1234 --comment "Review next week" --meta "Project=Alpha"

# Set label, rating, and flag
dt modify ABCD-1234 --label 3 --rating 5 --flag

# Set aliases for wiki linking
dt modify ABCD-1234 --aliases "Project Alpha, PA"

# Mark as read
dt modify ABCD-1234 --no-unread

# Combine operations
dt modify ABCD-1234 --name "Final Report" --add-tag complete --move-to "/Archive"

# Batch modify multiple records
dt modify UUID1 UUID2 UUID3 --flag --add-tag "processed"

# Batch modify via stdin
printf "UUID1\nUUID2\n" | dt modify - --add-tag "batch-tagged"
```

#### `dt update` — Update Record Content

| Option | Purpose | Default |
|--------|---------|---------|
| `<uuid>` | Record UUID | |
| `-c, --content <text>` | New content (use `-` for stdin) | |
| `-f, --file <path>` | Read content from file | |
| `-m, --mode <mode>` | Update mode: setting, inserting, appending | setting |
| `--comments` | Update comment instead of content | |
| `--custom-metadata <field>` | Update custom metadata field | |

```bash
# Replace content
dt update ABCD-1234 -c "New content"

# Update from file
dt update ABCD-1234 -f ./updated.md

# Append to content
dt update ABCD-1234 -c "Additional text" --mode appending

# Update from stdin
cat notes.md | dt update ABCD-1234 -c -
```

---

### Import & Index Commands

#### `dt import` — Import File into DEVONthink

| Option | Purpose | Default |
|--------|---------|---------|
| `<file>` | File path to import | |
| `-d, --database <name>` | Target database | |
| `-g, --to <path>` | Destination group | / |
| `-n, --as <name>` | Custom name | |
| `-t, --tag <tag>` | Add tag (repeatable) | |
| `--comment <text>` | Set comment | |
| `--ocr` | Import with OCR | |
| `--ocr-type <type>` | OCR output: pdf, rtf, text, markdown, docx | |
| `--transcribe` | Transcribe audio/video | |
| `--language <code>` | Transcription language | |
| `--timestamps` | Include timestamps | |
| `--background` | Run OCR in background | |

```bash
# Basic import
dt import "/path/to/file.pdf" -d "Research" -g "/Papers"

# Import with OCR
dt import "/path/to/scan.pdf" -d "Inbox" --ocr --ocr-type markdown

# Import and transcribe audio
dt import "/path/to/recording.m4a" -d "Inbox" --transcribe --language en

# Import with tags
dt import "/path/to/doc.pdf" -d "Research" -t "important" -t "2024"
```

#### `dt index` — Index External File (Reference)

| Option | Purpose | Default |
|--------|---------|---------|
| `<path>` | File or folder path | |
| `-d, --database <name>` | Target database | |
| `-g, --to <path>` | Destination group | / |

```bash
# Index a folder (creates references, not copies)
dt index "/path/to/folder" -d "Research"

# Index single file
dt index "/path/to/file.pdf" -d "Research" -g "/References"
```

#### `dt download markdown` — Create Markdown from Web URL

| Option | Purpose | Default |
|--------|---------|---------|
| `<url>` | Web URL to download | |
| `-d, --database <name>` | Target database | |
| `-g, --to <pathOrUuid>` | Destination group | |
| `-n, --name <name>` | Custom name | |
| `--readability` | Declutter page (reader mode) | |
| `-a, --agent <agent>` | User agent string | |
| `-r, --referrer <url>` | HTTP referrer | |

```bash
# Basic markdown from URL
dt download markdown "https://example.com/article" -d "Research"

# With readability (clean, uncluttered content)
dt download md "https://example.com/article" --readability -d "Inbox"

# Custom name
dt download markdown "https://example.com" -n "My Article" -d "Research" --readability
```

---

### Move, Copy, Delete Commands

#### `dt move` — Move Records

| Option | Purpose | Default |
|--------|---------|---------|
| `<uuid...>` | Record UUIDs (use `-` for stdin) | |
| `-t, --to <dest>` | Destination group (UUID or path) | |
| `-d, --database <name>` | Database for path destination | |
| `-f, --from <uuid>` | Source group (for single instance moves) | |
| `--queue` | Add to queue instead | |

```bash
# Move single record
dt move ABCD-1234 --to "/Archive" -d "Research"

# Move multiple records
dt move UUID1 UUID2 --to "/Archive" -d "Research"

# Move from stdin
printf "UUID1\nUUID2\n" | dt move - --to "/Archive" -d "Research"
```

#### `dt duplicate` — Create Independent Copies

```bash
dt duplicate ABCD-1234 --to "/Archive" -d "Research"
dt dup UUID1 UUID2 --to "/Backup" -d "Research"
```

#### `dt replicate` — Create Replicas

```bash
# Replicate to multiple groups
dt replicate ABCD-1234 --to GROUP-UUID-1 GROUP-UUID-2
```

#### `dt delete` — Move to Trash

| Option | Purpose | Default |
|--------|---------|---------|
| `<uuid...>` | Record UUIDs (use `-` for stdin) | |
| `--queue` | Add to queue instead | |

```bash
dt delete ABCD-1234
printf "UUID1\nUUID2\n" | dt delete -
```

---

### Organization Commands

#### `dt organize` — Intelligent Organization

| Option | Purpose | Default |
|--------|---------|---------|
| `<uuid...>` | Record UUIDs | |
| `--auto` | Enable all features | |
| `--ocr` | Perform OCR if text missing | |
| `--rename` | Rename based on content | |
| `--tag` | Apply AI tags | |
| `--summarize` | Add summary to comments | |
| `--prompt <uuid>` | Custom organization instructions | |
| `--no-confirm` | Skip rename confirmation | |
| `--queue` | Add to queue instead | |

```bash
# Full auto-organization
dt organize ABCD-1234 --auto

# Specific operations
dt organize ABCD-1234 --tag --summarize

# Batch organize from stdin
printf "UUID1\nUUID2\n" | dt tidy - --tag --summarize
```

#### `dt summarize` — Generate Summary

| Option | Purpose | Default |
|--------|---------|---------|
| `<uuid...>` | Record UUIDs | |
| `--print` | Print only, don't save | |
| `--prompt <uuid>` | Custom summarization prompt | |
| `--native` | Use DEVONthink native summarization | |
| `--type <type>` | Native type: annotations, content, mentions | annotations |
| `--queue` | Add to queue instead | |

```bash
# AI summary (saves to comment)
dt summarize ABCD-1234

# Print without saving
dt sum ABCD-1234 --print

# Native annotation summary
dt sum ABCD-1234 --native --type annotations
```

#### `dt transcribe` — Transcribe Audio/Video/Images

| Option | Purpose | Default |
|--------|---------|---------|
| `<uuid>` | Record UUID | |
| `-l, --language <code>` | Language code (en, de, etc.) | |
| `--timestamps` | Include timestamps | |
| `-s, --save` | Save as markdown document | |
| `-u, --update-record` | Save to original record's text | |
| `-a, --ai-cleanup` | Use AI to clean up | |
| `--ai-prompt <prompt>` | Custom AI cleanup prompt | |
| `-t, --tag <tag>` | Tags for saved document | |

```bash
# Basic transcription
dt transcribe ABCD-1234 --language en

# Save as document
dt tr ABCD-1234 --save -d "Inbox"

# With AI cleanup
dt tr ABCD-1234 --ai-cleanup --save
```

---

### Tag Management Commands

#### `dt tags list` — List All Tags

| Option | Purpose | Default |
|--------|---------|---------|
| `-d, --database <name>` | Target database | |
| `-s, --sort <method>` | Sort: alpha, count | alpha |
| `-m, --min-count <n>` | Minimum usage count | |
| `-f, --format <fmt>` | Output: json, csv, plain | json |
| `-q, --quiet` | Tag names only | |

```bash
dt tags list -d "Research"
dt tags list -d "Research" --sort count --min-count 5
```

#### `dt tags analyze` — Analyze Tag Problems

```bash
# Find case variants, malformed, low-use tags
dt tags analyze -d "Research"
```

#### `dt tags merge` — Merge Tags

| Option | Purpose | Default |
|--------|---------|---------|
| `-t, --target <tag>` | Target tag (survives) | |
| `-s, --sources <tags...>` | Source tags to merge | |
| `-d, --database <name>` | Target database | |
| `--dry-run` | Preview without applying | |

```bash
dt tags merge --target "correct" --sources "Wrong" "WRONG" -d "Research"
dt tags merge --target "project" --sources "Project" --dry-run
```

#### `dt tags rename` — Rename Tag

```bash
dt tags rename --from "old-name" --to "new-name" -d "Research"
```

#### `dt tags delete` — Delete Tag

```bash
dt tags delete "unwanted-tag" -d "Research"
```

#### `dt tags normalize` — Batch Normalization

```bash
# Auto-generate rules and preview
dt tags normalize -d "Research" --auto

# Apply rules file
dt tags normalize -d "Research" -r rules.yaml --apply
```

---

### AI Chat Commands

#### `dt chat ask` — Send Chat Message

| Option | Purpose | Default |
|--------|---------|---------|
| `[prompt]` | Chat prompt | |
| `-r, --record <uuid>` | Document context (repeatable, `-` for stdin) | |
| `-U, --url <url>` | Web page/image URL context | |
| `-P, --prompt-record <uuid>` | Use record as prompt | |
| `-e, --engine <engine>` | Engine: chatgpt, claude, gemini, ollama | |
| `-m, --model <model>` | Specific model | |
| `-T, --temperature <temp>` | Creativity 0-2 | |
| `-u, --usage <mode>` | Usage: cheapest, auto, best | |
| `--role <text>` | System role/persona | |
| `--mode <mode>` | Content mode: auto, text, vision | |
| `-f, --format <fmt>` | Response format: text, json, html, message, raw | |
| `--no-thinking` | Disable reasoning | |
| `--no-tools` | Disable tool calls | |

```bash
# Simple question
dt chat ask "What is machine learning?"

# With document context
dt chat ask "Summarize this" -r ABCD-1234

# Multiple documents
dt chat ask "Compare these" -r UUID1 -r UUID2

# Use Claude
dt chat ask "Explain" -r ABCD-1234 --engine claude

# From URL
dt chat ask "Summarize" --url "https://example.com/article"
```

#### `dt chat models` — List Available Models

```bash
dt chat models
```

#### `dt chat capabilities` — Get Model Capabilities

```bash
dt chat caps
```

---

### Queue Commands

The queue system enables batch operations with look-ahead optimization.

#### `dt queue add` — Add Task to Queue

```bash
# Create record
dt queue add create --name "Doc" --type markdown --database "Inbox"

# Move record
dt queue add move --uuid ABCD-1234 --destination "/Archive"

# Tag operations
dt queue add tag.add --uuids "U1,U2" --tags "important"
dt queue add tag.merge --target "Correct" --sources "Wrong" --database "Research"
dt queue add tag.rename --from "old" --to "new" --database "Research"
dt queue add tag.delete --tag "temp" --database "Research"

# Chat
dt queue add chat --prompt "Summarize" --records "ABCD-1234" --engine claude
```

#### `dt queue execute` — Run Pending Tasks

```bash
dt queue execute
dt queue execute --dry-run   # Validate only
dt queue execute --verbose   # Detailed output
```

#### `dt queue status` — Show Queue Status

```bash
dt queue status
```

#### `dt queue list` — List All Tasks

```bash
dt queue list
```

#### `dt queue verify` — Deep Verification

```bash
dt queue verify  # Check resources against DEVONthink
```

#### `dt queue repair` — AI-Assisted Repair

```bash
dt queue repair          # Get suggestions
dt queue repair --apply  # Apply fixes
```

#### `dt queue clear` — Clear Tasks

```bash
dt queue clear --scope completed
dt queue clear --scope failed
dt queue clear --scope all
```

#### `dt queue load` — Load Tasks from File

```bash
dt queue load tasks.yaml
dt queue load tasks.json
```

---

### Other Commands

#### `dt reveal` — Open Record in DEVONthink

```bash
dt reveal ABCD-1234
dt open ABCD-1234 --mode tab
dt reveal ABCD-1234 --parent  # Reveal parent group
```

#### `dt convert` — Convert Record Format

| Option | Purpose | Default |
|--------|---------|---------|
| `<uuid>` | Record UUID | |
| `-t, --to <format>` | Target format | simple |
| `-g, --group <dest>` | Destination group | |

**Formats:** `simple`, `plain`, `text`, `rich`, `rtf`, `note`, `formatted`, `html`, `markdown`, `pdf`, `pdf-annotated`, `pdf-no-annotations`, `webarchive`, `bookmark`

```bash
dt convert ABCD-1234 --to markdown
dt convert ABCD-1234 --to pdf --group "/Exports"
```

#### `dt link` — Link Records or Enable Features

```bash
# Link two records
dt link UUID1 UUID2

# Enable/disable features
dt link UUID1 --wiki --see-also
dt link UUID1 --no-chat --no-classification
```

#### `dt unlink` — Unlink Records

```bash
dt unlink UUID1 UUID2
```

#### `dt mcp` — MCP Server

```bash
# Run MCP server
dt mcp run

# Show Claude Desktop config
dt mcp config
```

---

## JSON Output Schemas

Most commands support `--json` for structured output:

### Search Results

```json
{
  "success": true,
  "results": [
    {
      "uuid": "ABCD-1234",
      "name": "Document Name",
      "recordType": "markdown",
      "database": "Research",
      "location": "/Papers/2024",
      "tags": ["important", "review"]
    }
  ],
  "totalCount": 42
}
```

### Record Properties

```json
{
  "success": true,
  "uuid": "ABCD-1234",
  "name": "Document Name",
  "recordType": "markdown",
  "database": "Research",
  "location": "/Papers/2024",
  "path": "/Papers/2024/Document Name.md",
  "tags": ["important"],
  "creationDate": "2024-01-15T10:30:00Z",
  "modificationDate": "2024-01-20T14:22:00Z"
}
```

### Create/Modify Operations

```json
{
  "success": true,
  "uuid": "ABCD-1234",
  "name": "Document Name",
  "location": "/Papers",
  "database": "Research"
}
```

---

## Common Patterns for PAI

### Context Injection

Pull relevant documents to inform current work:

```bash
# Find documents by topic
dt search q "architecture design" -d "Research" -l 10

# Get specific document content
dt get preview ABCD-1234 -l 5000

# Get related documents
dt get related ABCD-1234 --by-data -l 5
```

### Document Processing Pipeline

```bash
# Import and organize
dt import "/path/to/scan.pdf" -d "Inbox" --ocr
dt organize ABCD-1234 --auto

# Or via queue
dt queue add create --name "Doc" --type markdown --database "Inbox"
dt queue add tag.add --uuids "ABCD-1234" --tags "processed"
dt queue execute
```

### Batch Tag Cleanup

```bash
# Analyze problems
dt tags analyze -d "Research"

# Plan and apply
dt tags normalize -d "Research" --auto
dt tags normalize -d "Research" --apply
```

### AI-Assisted Research

```bash
# Summarize multiple documents
dt chat ask "Compare the key findings" -r UUID1 -r UUID2 -r UUID3

# Summarize with custom prompt
dt summarize ABCD-1234 --prompt PROMPT-UUID
```

---

## Tips

- **UUIDs**: Accept both raw UUID and `x-devonthink-item://` URLs
- **Stdin**: Use `-` to read UUIDs/content from stdin for piping
- **Queue**: Use `--queue` on write operations for batching
- **Quiet mode**: Use `-q` to get only UUIDs for piping
- **JSON output**: Use `--json` when piping to `jq` or other tools
- **Database inference**: When `-g` is a UUID, database can be omitted (derived from group)
- **Date filters**: Support relative dates like "2 weeks", "3 days"
- **MCP vs CLI**: Inside Claude Code, prefer MCP tools for direct JSON access
- **Markdown formatting**: When creating markdown, add backslashes to escape literal characters `\~` to distinguish them from markdown code (`~` = subscript)