---
title: dt CLI Quick Reference (LLM-optimized)
version: 2.2.14
updated: 2026-01-12
---

# dt CLI Quick Reference (LLM-optimized)

## Conventions
- `<uuid>` accepts raw UUID or `x-devonthink-item://UUID` URLs
- `-` as value = read from stdin (one UUID/line or content)
- Repeatable opts: `-t tag1 -t tag2` (NOT `-t tag1,tag2`)
- Paths: leading `/` optional (`/Archive` = `Archive`)
- When `-g <uuid>`, database auto-derived (omit `-d`)

## Gotchas
| Wrong | Right | Why |
|-------|-------|-----|
| `-t "tag1,tag2"` | `-t tag1 -t tag2` | Tags are repeatable flags, not comma-separated |
| `--add-tag "a,b"` | `--add-tag a --add-tag b` | Same for modify tags |
| `dt create -c "text"` | `dt create record -c "text"` | `create` needs subcommand (`record`, `bookmark`, etc.) |
| `dt search "query"` | `dt search q "query"` | `search` needs subcommand (`q`, `tags`, `file`, etc.) |
| `dt get UUID` | `dt get props UUID` | `get` needs subcommand (`props`, `preview`, `related`) |
| `dt list "DB"` | `dt list group "DB"` | `list` needs subcommand (`databases`, `group`, `inbox`) |
| `echo "x" \| dt create -c` | `echo "x" \| dt create record -c -` | stdin requires explicit `-` marker |
| `-d Research Notes` | `-d "Research Notes"` | Quote database names with spaces |
| `--database` | `-d` | Use short form; `--database` works but verbose |
| Ignoring `.success` | Check `jq '.success'` | Always verify success before using results |

## Core Commands

### Search
```bash
dt search q "<query>" [-d db] [-l limit] [-t type] [--created-after date] [--modified-before date]
dt search tags <tag...> [-a|--any] [-d db]  # AND by default, --any for OR
dt search file|path|url|comment|hash "<term>"
```
Query syntax: `name:term`, `tags:term`, `kind:type`, `content:term`, `AND/OR/NOT`, `*` wildcard

### Get
```bash
dt get props <uuid> [--fields "uuid,name,tags,location"]
dt get preview <uuid> [-l chars]           # plain text content
dt get related <uuid> [-t incoming|outgoing|similar|all] [--by-data] [--by-tags]
dt get selection                           # currently selected in DT
dt get metadata <uuid> "<field>"           # custom metadata
```

### List
```bash
dt list databases|dbs
dt list group [db|uuid] [path] [-D depth]  # depth: 1=direct, -1=all
dt list inbox
dt list tag "<tag>" [-d db]
dt tree [-d db] [path] [--depth n] [--counts] [--smart-groups] [--exclude-system]
```

### Create
```bash
dt create record -n "<name>" -T <type> -d "<db>" [-g path] [-c content|-] [-f file] [-t tag]...
dt create bookmark "<url>" -d "<db>" [-n name]
dt create markdown|pdf|web "<url>" -d "<db>"
dt create image "<prompt>" -d "<db>"
```
Types: `markdown`, `txt`, `rtf`, `bookmark`, `html`, `group`, `smart group`

### Modify (metadata)
```bash
dt modify <uuid...>|- [-n name] [-c comment] [--add-tag t]... [--remove-tag t]... [--set-tags t1 t2]
         [--label 0-7] [--rating 0-5] [--flag|--no-flag] [--aliases "a,b"]
         [--url url] [--unread|--no-unread] [--meta key=value]... [-m dest]
```

### Update (content)
```bash
dt update <uuid> -c "<content>"|- [-m setting|inserting|appending]
dt update <uuid> -f <file>
```

### Import/Index
```bash
dt import "<file>" -d "<db>" [-g path] [-n name] [-t tag]... [--ocr] [--ocr-type pdf|rtf|text|markdown|docx]
         [--transcribe] [--language code] [--timestamps]
dt index "<path>" -d "<db>" [-g path]
dt download markdown|md "<url>" -d "<db>" [-g path] [-n name] [--readability]
```

### Move/Copy/Delete
```bash
dt move <uuid...>|- -t "<dest>" [-d db] [-f from-uuid]
dt duplicate|dup <uuid...> --to "<dest>" -d "<db>"
dt replicate <uuid> --to <group-uuid>...
dt delete <uuid...>|-
```

### Organize
```bash
dt organize <uuid...>|- [--auto] [--ocr] [--rename] [--tag] [--summarize] [--prompt uuid]
dt summarize|sum <uuid...> [--print] [--prompt uuid] [--native] [--type annotations|content|mentions]
dt transcribe|tr <uuid> [-l lang] [--timestamps] [-s|--save] [-u|--update-record] [-a|--ai-cleanup]
```

### Tags
```bash
dt tags list -d "<db>" [-s alpha|count] [-m min-count]
dt tags analyze -d "<db>"
dt tags merge -t "<target>" -s "<source>"... -d "<db>" [--dry-run]
dt tags rename --from "<old>" --to "<new>" -d "<db>"
dt tags delete "<tag>" -d "<db>"
dt tags normalize -d "<db>" [--auto] [-r rules.yaml] [--apply]
```

### Chat
```bash
dt chat ask "[prompt]" [-r uuid]... [-U url] [-P prompt-uuid] [-e chatgpt|claude|gemini|ollama]
           [-m model] [-T temp] [-u cheapest|auto|best] [--role text] [-f text|json|html|message|raw]
dt chat models|caps
```

### Other
```bash
dt reveal|open <uuid> [--mode tab|window|reveal] [--parent]
dt convert <uuid> -t <format> [-g dest]
dt link <uuid1> <uuid2> | dt link <uuid> [--wiki] [--see-also] [--no-chat] [--no-classification]
dt unlink <uuid1> <uuid2>
```
Convert formats: `simple`, `plain`, `text`, `rich`, `rtf`, `note`, `formatted`, `html`, `markdown`, `pdf`, `pdf-annotated`, `webarchive`, `bookmark`

### Queue (batch ops)
```bash
dt queue add create --name "<n>" --type <t> --database "<db>" [--group path] [--content text] [--tags t1,t2]
dt queue add move --uuid <u> --destination "<path>"
dt queue add tag.add|tag.remove|tag.set --uuids "u1,u2" --tags "t1,t2"
dt queue add tag.merge --target "<t>" --sources "s1,s2" --database "<db>"
dt queue add tag.rename --from "<old>" --to "<new>" --database "<db>"
dt queue add tag.delete --tag "<t>" --database "<db>"
dt queue add chat --prompt "<p>" --records "uuid" [--engine e]
dt queue execute [--dry-run] [--verbose]
dt queue status|list|verify
dt queue repair [--apply]
dt queue clear --scope completed|failed|all
dt queue load <file.yaml|json>
```

## Output Flags (all commands)
- `--json` compact JSON
- `--pretty` formatted JSON
- `-q, --quiet` minimal (UUIDs only)

## Output Schemas (for jq chaining)

```bash
# Search results
{ success, results: [{ uuid, name, recordType, database, location, tags }], totalCount }
dt search q "x" --json | jq -r '.results[].uuid'

# Record props
{ success, uuid, name, recordType, database, location, path, tags, creationDate, modificationDate, ... }
dt get props UUID --json | jq -r '.tags[]'

# Preview
{ success, uuid, name, plainText }
dt get preview UUID --json | jq -r '.plainText'

# Related
{ success, uuid, incoming: [...], outgoing: [...], similar: [...] }
dt get related UUID --json | jq -r '.incoming[].uuid'

# List group
{ success, items: [{ uuid, name, recordType, itemCount?, level }] }
dt list group UUID --json | jq -r '.items[] | select(.recordType=="group") | .uuid'

# Create/modify/move/delete
{ success, uuid, name, location, database }
dt create record -n "X" -T markdown -d "DB" --json | jq -r '.uuid'

# Tags list
{ success, tags: [{ name, count }] }
dt tags list -d "DB" --json | jq -r '.tags[].name'

# Chat
{ success, response, model?, usage?: { input, output } }
dt chat ask "X" --json | jq -r '.response'

# Queue status
{ success, stats: { pending, completed, failed }, tasks: [...] }
```

## Common Patterns
```bash
# Stdin UUIDs
dt search q "topic" -q | dt modify - --add-tag processed

# Batch from selection
dt get selection -q | dt move - -t "/Archive" -d "DB"

# Queue for batching
dt modify UUID --add-tag x --queue  # adds to queue instead of executing
```
