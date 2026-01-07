# DEVONthink Search Cheatsheet (dt CLI + MCP)

This CLI forwards your query string directly to DEVONthink's search engine.
Use DEVONthink search syntax for full-text + metadata queries.

## Basics

- Case-insensitive search
- Phrases: use quotes, e.g. "project plan"
- Wildcards: `?` = any single char, `*` = any sequence
- Boolean: `AND`, `OR`, `NOT` (use parentheses to group)
- Proximity: `NEAR`, `BEFORE`, `AFTER`

## Search Prefixes (metadata filters)

Search prefixes target metadata fields. A few common examples:

- `rating:2` or `rating:3-5`
- `created:2024-06-15`
- `created:>2 weeks`
- `flag:unflagged`
- `tags:Funny`
- `kind:rtf`
- `size:<=20 MB`

DEVONthink supports many more prefixes and operators. See the DEVONthink
appendix for the complete list.

## Operators

Use operators with prefixes to compare or define ranges:

- `=` (equal), `!=` (not equal)
- `>` `>=` `<` `<=` (greater/less than)
- Range: `rating:3-5`

## Time Period Examples

- Records created in the last 2 weeks:
  `created:>2 weeks`
- Modified since a date:
  `modified:>=2024-01-01`
- Created within a range:
  `created:2024-01-01-2024-03-31`

## CLI Examples

```bash
# Simple text search
DT=dt
$DT search query "project plan"

# Time window + tag
$DT search query 'created:>2 weeks AND tags:client'

# Time window via first-class flags (auto-builds query)
$DT search query 'client' --created-after "2 weeks" --modified-before "2024-12-31"

# Type filter (recordType) with a normal query
$DT search query 'created:>=2024-01-01 AND tags:research' --type markdown

# Scope
$DT search query 'tags:Funny' -d "My Database" -g "GROUP-UUID" --exclude-subgroups

# Create a markdown record (content via -c)
$DT create record -n "My Note" -d "Inbox" -c "# Note"
```

## CLI Time Flags

- `--created-after <value>`
- `--created-before <value>`
- `--modified-after <value>`
- `--modified-before <value>`
- `--added-after <value>`
- `--added-before <value>`

Values can be absolute dates (e.g. `2024-01-01`) or relative expressions
(e.g. `2 weeks`) supported by DEVONthink.

## MCP Example

```json
{
  "tool": "search_records",
  "query": "tags:client",
  "createdAfter": "2 weeks",
  "database": "My Database",
  "limit": 20
}
```

## Smart Groups

Smart groups store a saved query. DEVONthink uses:

- **Search group**: the scope group to search within
- **Search predicates**: the query string (same syntax as CLI searches)

You can use full boolean logic (including parentheses) in predicates.

```bash
dt create record -n "SG Tag Adult" -T "smart group" -d "Test_Database" --query 'tags:adult'
dt create record -n "SG Complex" -T "smart group" -d "Test_Database" --query '(tags:adult OR tags:review) AND kind:pdf'
```

### Smart Group Management (CLI)

```bash
# List smart groups in root
dt smartgroup list -d "Test_Database"

# Create/update/delete smart groups
dt smartgroup create -n "SG Tag Adult" -d "Test_Database" --query "tags:adult"
dt smartgroup update "SG Tag Adult" -d "Test_Database" --query "tags:adult AND kind:pdf"
dt smartgroup delete "SG Tag Adult" -d "Test_Database"

# Operate on smart group items
dt smartgroup items "SG Tag Adult" -d "Test_Database" --quiet
dt smartgroup delete-items "SG Tag Adult" -d "Test_Database"
dt smartgroup modify-items "SG Tag Adult" -d "Test_Database" --add-tag review
```

## Notes

- CLI options like `--database`, `--group`, `--exclude-subgroups`, and
  `--comparison` scope the search in addition to the query string.
- The query string is passed as-is to DEVONthink, so you can combine
  full-text, boolean logic, prefixes, and ranges in one expression.
- If you want only date filters, use a wildcard base query, e.g. `*`.

---

# Create Record UX Notes

- `dt create record` defaults to markdown (omit `-T` for markdown).
- `dt create note` is an alias for `dt create record`.
- `dt create markdown <url>` is for web clipping (URL -> Markdown), not record creation.
- Stdin for content uses `-c -` (no `--stdin` flag yet).
- `--database` is optional when `--group` is a UUID; required when `--group` is a path.

Example (stdin content):

```bash
echo "# Note" | dt create record -n "My Note" -d "Inbox" -c -
```
