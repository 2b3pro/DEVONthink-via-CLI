---
status: implemented
keywords: [specification, tags, normalization, rules, taxonomy]
---

# Spec: Tag Normalization (`dt tags`)

**Status:** Draft
**Author:** Nova + Ian
**Date:** 2026-01-05
**Prerequisite for:** Phase 3 (`dt pack --by-tags`)

---

## Problem Statement

DEVONthink databases accumulate tag entropy over time:
- Manual tagging inconsistencies (case, spelling variants)
- ML-generated image recognition tags (random objects, scenes)
- Scanner/OCR processing artifacts
- Generic document-type tags that add no semantic value

Example from "Hypnosis NLP" database: **660 unique tags** across 3,244 records, including:
- Case variants: `hypnosis` / `Hypnosis`, `self-love` / `Self-love` / `Self-Love`
- Synonyms: `bow tie` / `bow-tie` / `bowtie`
- ML artifacts: `hockey puck`, `jeweler's loupe`, `Japanese landscape`
- Processing junk: `CamScanner`, `converted-to-pdf`, `Watermark`

This makes `--by-tags` classification useless until cleaned up.

---

## Command Structure

```
dt tags <subcommand> [options]

Subcommands:
  list        List all tags in a database
  analyze     Find problems (variants, duplicates, junk)
  normalize   Apply normalization rules (batch)
  merge       Merge multiple tags into one
  rename      Rename a single tag
  delete      Remove tag(s) from all records
```

---

## Subcommand Specifications

### 1. `dt tags list`

List all unique tags with usage counts.

```bash
dt tags list -d "Hypnosis NLP"
dt tags list -d "Hypnosis NLP" --sort count    # most used first
dt tags list -d "Hypnosis NLP" --sort alpha    # alphabetical (default)
dt tags list -d "Hypnosis NLP" --min-count 5   # only tags used 5+ times
dt tags list -d "Hypnosis NLP" --format csv    # for spreadsheet analysis
```

**Output (default):**
```json
{
  "success": true,
  "database": "Hypnosis NLP",
  "totalTags": 660,
  "totalRecords": 3244,
  "tags": [
    { "tag": "hypnosis", "count": 842 },
    { "tag": "NLP", "count": 312 },
    ...
  ]
}
```

---

### 2. `dt tags analyze`

Detect problems and suggest fixes. This is the intelligence layer.

```bash
dt tags analyze -d "Hypnosis NLP"
dt tags analyze -d "Hypnosis NLP" --category case      # only case variants
dt tags analyze -d "Hypnosis NLP" --category synonyms  # only synonym clusters
dt tags analyze -d "Hypnosis NLP" --export rules.yaml  # export as rules file
```

**Problem Categories:**

| Category | Detection Method | Example |
|----------|-----------------|---------|
| `case` | Case-insensitive grouping | `hypnosis`, `Hypnosis` |
| `synonyms` | Edit distance + word variants | `bow tie`, `bow-tie`, `bowtie` |
| `malformed` | Regex patterns | `: tDCS`, leading/trailing spaces |
| `ml-artifacts` | Blocklist + heuristics | `hockey puck`, `oscilloscope` |
| `processing` | Known scanner/OCR tags | `CamScanner`, `OCR`, `Watermark` |
| `generic` | Common document-type words | `book`, `article`, `report` |
| `low-usage` | Count threshold | Tags used only once |

**Output:**
```json
{
  "success": true,
  "database": "Hypnosis NLP",
  "problems": {
    "case": [
      {
        "canonical": "hypnosis",
        "variants": ["Hypnosis"],
        "totalRecords": 892,
        "suggestion": "merge_to_lowercase"
      }
    ],
    "synonyms": [
      {
        "cluster": ["bow tie", "bow-tie", "bowtie"],
        "totalRecords": 12,
        "suggestion": "merge_to_first"
      }
    ],
    "malformed": [
      { "tag": ": tDCS", "issue": "leading_colon", "suggestion": "tDCS" }
    ],
    "ml-artifacts": [
      { "tag": "hockey puck", "confidence": 0.95, "suggestion": "delete" },
      { "tag": "Japanese landscape", "confidence": 0.87, "suggestion": "delete" }
    ],
    "processing": [
      { "tag": "CamScanner", "suggestion": "delete_or_move_to_metadata" }
    ],
    "low-usage": [
      { "tag": "Avery", "count": 1, "suggestion": "review" }
    ]
  },
  "summary": {
    "totalProblems": 127,
    "byCategory": {
      "case": 45,
      "synonyms": 23,
      "malformed": 3,
      "ml-artifacts": 38,
      "processing": 6,
      "low-usage": 12
    }
  }
}
```

---

### 3. `dt tags normalize`

Apply normalization rules in batch. **Always dry-run by default.**

```bash
# Auto-fix safe problems (case, malformed)
dt tags normalize -d "Hypnosis NLP" --auto

# Preview changes (default behavior)
dt tags normalize -d "Hypnosis NLP" --auto --dry-run

# Actually apply changes
dt tags normalize -d "Hypnosis NLP" --auto --apply

# Use custom rules file
dt tags normalize -d "Hypnosis NLP" --rules rules.yaml --apply

# Aggressive mode (includes ML artifacts, low-usage)
dt tags normalize -d "Hypnosis NLP" --auto --aggressive --apply
```

**Rules File Format (YAML):**
```yaml
# rules.yaml
version: 1
database: "Hypnosis NLP"  # optional, for validation

rules:
  # Case normalization
  - type: case
    strategy: lowercase  # or: uppercase, titlecase, preserve_first

  # Explicit merges
  - type: merge
    target: "hypnotherapy"
    sources: ["Hypnotherapy", "hypno-therapy", "hypno therapy"]

  # Synonym clusters (auto-detected, user-approved)
  - type: merge
    target: "bowtie"
    sources: ["bow tie", "bow-tie"]

  # Deletions
  - type: delete
    tags:
      - "hockey puck"
      - "jeweler's loupe"
      - "CamScanner"
      - "Watermark"

  # Pattern-based deletion
  - type: delete_pattern
    patterns:
      - "^: "           # leading colon+space
      - "^Scanner"      # scanner artifacts

  # Rename with pattern
  - type: rename
    from: "article"
    to: "type:article"

  # Blocklist (never allow these tags)
  - type: blocklist
    tags: ["No", "other", "site"]
```

**Dry-run Output:**
```json
{
  "success": true,
  "dryRun": true,
  "changes": [
    {
      "action": "merge",
      "target": "hypnosis",
      "sources": ["Hypnosis"],
      "affectedRecords": 156
    },
    {
      "action": "delete",
      "tag": "hockey puck",
      "affectedRecords": 3
    },
    {
      "action": "rename",
      "from": ": tDCS",
      "to": "tDCS",
      "affectedRecords": 7
    }
  ],
  "summary": {
    "merges": 45,
    "deletes": 52,
    "renames": 3,
    "totalAffectedRecords": 847
  }
}
```

---

### 4. `dt tags merge`

Merge specific tags interactively.

```bash
# Merge variants into canonical form
dt tags merge -d "Hypnosis NLP" --target "hypnosis" --sources "Hypnosis"

# Merge multiple sources
dt tags merge -d "Hypnosis NLP" \
  --target "bowtie" \
  --sources "bow tie" "bow-tie" "bow-tie"

# Dry-run first
dt tags merge -d "Hypnosis NLP" --target "NLP" --sources "nlp" "Nlp" --dry-run
```

---

### 5. `dt tags rename`

Rename a single tag across all records.

```bash
dt tags rename -d "Hypnosis NLP" --from "article" --to "type:article"
dt tags rename -d "Hypnosis NLP" --from ": tDCS" --to "tDCS"
```

---

### 6. `dt tags delete`

Remove tags entirely.

```bash
# Delete specific tags
dt tags delete -d "Hypnosis NLP" --tags "hockey puck" "CamScanner"

# Delete by pattern
dt tags delete -d "Hypnosis NLP" --pattern "^Scanner"

# Delete low-usage tags (interactive confirmation)
dt tags delete -d "Hypnosis NLP" --low-usage 1 --interactive

# Nuke ML artifacts (uses built-in blocklist)
dt tags delete -d "Hypnosis NLP" --ml-artifacts --apply
```

---

## ML Artifact Detection

Built-in heuristics for identifying auto-generated image tags:

### Blocklist Categories

```yaml
# Built-in blocklist (src/data/ml-tag-blocklist.yaml)
physical_objects:
  - hockey puck
  - puck
  - loupe
  - jeweler's loupe
  - oscilloscope
  - magnetic compass
  - ruler
  - scoreboard

clothing_items:
  - bow tie
  - bow-tie
  - bowtie
  - Windsor tie

locations_generic:
  - airport terminal
  - runway
  - art gallery
  - art studio
  - bridge
  - gas station
  - hospital
  - motel
  - eating house
  - eating place
  - eatery

nature_scenes:
  - cherry blossoms
  - Japanese landscape
  - stream
  - staircase

clocks:
  - analog clock
  - digital clock
  - wall clock

scanner_artifacts:
  - CamScanner
  - Scanner
  - OCR
  - converted-to-pdf
  - Watermark
  - dust cover
  - dust jacket
  - dust wrapper
  - book jacket
```

### Heuristic Detection

For tags not in blocklist, use heuristics:
1. **Noun phrase detection**: Multi-word tags that are concrete nouns (likely image detection)
2. **Low semantic relevance**: Tags that don't co-occur with domain-specific tags
3. **Temporal clustering**: Tags that appeared in bulk (ML batch processing)

---

## Safety Features

### 1. Dry-Run Default
All destructive operations require `--apply` flag. Default is preview mode.

### 2. Backup Recommendation
```bash
# Before major normalization
dt tags normalize -d "Hypnosis NLP" --auto --apply
# Warns: "Recommended: Create a database backup before proceeding. Continue? [y/N]"
```

### 3. Undo Log
```bash
# Creates undo log at ~/.dt/tag-changes/2026-01-05-hypnosis-nlp.json
dt tags normalize -d "Hypnosis NLP" --auto --apply

# Revert last operation
dt tags undo -d "Hypnosis NLP"
```

### 4. Interactive Mode
```bash
dt tags normalize -d "Hypnosis NLP" --interactive
# Prompts for each change: "Merge 'Hypnosis' into 'hypnosis'? (156 records) [y/N/all/skip]"
```

---

## Implementation Notes

### JXA Tag Operations

```javascript
// Get all tags for a record
record.tags()  // returns array of strings

// Set tags (replaces all)
record.tags = ["tag1", "tag2"]

// Add a tag
const current = record.tags();
record.tags = [...current, "newTag"];

// Remove a tag
record.tags = record.tags().filter(t => t !== "oldTag");

// Batch: Find all records with a tag
const records = app.search("tags:oldTag", { in: database });

// === TAG GROUP OPERATIONS ===
// Tags in DEVONthink are stored as special "tag groups"

// Get all tag groups in a database
const tagGroups = database.tagGroups();  // returns array of tag group records

// Find a specific tag group
const tagGroup = tagGroups.find(t => t.name() === "myTag");

// MERGE TAGS (built-in DEVONthink command!)
// Merges source tags into target - reassigns all tagged records, deletes sources
const sourceTags = [tagGroup1, tagGroup2];  // tag groups to merge away
const targetTag = tagGroup3;                 // tag that absorbs the others

// The first tag in the array becomes the surviving tag
// The `in:` parameter specifies destination parent (usually omit for tags)
app.merge({records: [targetTag, ...sourceTags]});

// After merge:
// - All records tagged with sourceTags now have targetTag
// - Source tag groups are deleted
// - Target tag survives with combined records

// RENAME TAG (via record properties)
tagGroup.name = "newTagName";

// DELETE TAG (removes tag group, unassigns from all records)
app.delete(tagGroup);
```

### Performance Considerations

- **Batch operations**: Collect all affected records first, then batch update
- **Progress reporting**: For large databases, emit progress events
- **Transaction-like behavior**: Track changes, allow rollback on error

---

## Workflow Example

```bash
# 1. See what you're dealing with
dt tags list -d "Hypnosis NLP" --sort count

# 2. Analyze problems
dt tags analyze -d "Hypnosis NLP" --export rules.yaml

# 3. Review and edit rules.yaml (remove false positives)
code rules.yaml

# 4. Preview changes
dt tags normalize -d "Hypnosis NLP" --rules rules.yaml

# 5. Apply (after backup)
dt tags normalize -d "Hypnosis NLP" --rules rules.yaml --apply

# 6. Verify
dt tags analyze -d "Hypnosis NLP"  # Should show fewer problems
```

---

## Success Metrics

After normalization, "Hypnosis NLP" should go from:
- **660 unique tags** → ~150-200 meaningful tags
- **45 case variant clusters** → 0
- **52 ML artifacts** → 0
- **`dt get related --by-tags`** → Actually useful results

---

## Global vs Database-Specific Rules

Tag rules should be **consistent across all databases** by default, with optional per-database overrides.

### Configuration Hierarchy

```
~/.config/dt/
├── tag-rules.yaml          # Global rules (apply to ALL databases)
├── ml-blocklist.yaml       # Global ML artifact blocklist
└── databases/
    ├── hypnosis-nlp.yaml   # Database-specific overrides
    └── inbox.yaml          # Database-specific overrides
```

### Global Rules File (`~/.config/dt/tag-rules.yaml`)

```yaml
# ~/.config/dt/tag-rules.yaml
version: 1

# Case normalization strategy (applies globally)
case:
  strategy: lowercase  # lowercase | uppercase | titlecase | preserve

# Global tag taxonomy - canonical forms
taxonomy:
  # Domain-agnostic categories
  document_types:
    canonical: "type:{tag}"  # Namespace document types
    tags: [book, article, report, manual, guide, thesis, dissertation, monograph]

  processing_status:
    canonical: "status:{tag}"
    tags: [review, extract, summarize, archive]

# Global merges (synonyms that should be consistent everywhere)
merges:
  - target: "neurolinguistic programming"
    sources: ["NLP", "nlp", "Neuro-Linguistic Programming", "neuro-linguistic programming", "Neuro Linguistic Programming"]

  - target: "behavior change"
    sources: ["Behavior Change", "behavioral change", "behaviour change"]

# Global blocklist (always delete these)
blocklist:
  # Scanner/processing artifacts
  - CamScanner
  - Scanner
  - OCR
  - converted-to-pdf
  - Watermark
  - dust cover
  - dust jacket
  - dust wrapper
  - book jacket

  # Noise
  - "No"
  - other
  - site
  - web site
  - website
  - internet site

# Global patterns to fix
patterns:
  - match: "^: "      # Leading colon+space
    action: strip
  - match: "^\s+"    # Leading whitespace
    action: trim
  - match: "\s+$"    # Trailing whitespace
    action: trim

# ML artifact detection (global)
ml_artifacts:
  enabled: true
  confidence_threshold: 0.85
  # Additional blocklist beyond built-in
  custom_blocklist:
    - hockey puck
    - jeweler's loupe
    - oscilloscope
  
# ...
```

### Database-Specific Overrides (`~/.config/dt/databases/<db-slug>.yaml`)

```yaml
# ~/.config/dt/databases/hypnosis-nlp.yaml
version: 1
database: "Hypnosis NLP"  # Must match database name

# Inherit global rules
extends: global  # or: "none" to start fresh

# Domain-specific taxonomy
taxonomy:
  techniques:
    canonical: "technique:{tag}"
    tags: [anchoring, reframing, deepening, induction]

  modalities:
    tags: [hypnosis, hypnotherapy, NLP, meditation, trance]

# Domain-specific merges
merges:
  - target: "Milton Erickson"
    sources: ["Milton Model", "Ericksonian", "ericksonian techniques"]

  - target: "trance"
    sources: ["Trance", "trance phenomena"]

# Preserve these tags (don't delete even if matched by global rules)
preserve:
  - "NLP"  # Override global merge to "neurolinguistic programming"

# Additional blocklist for this database
blocklist:
  - "@Gemini"  # AI chat artifact
```

### Rule Resolution Order

1. **Global rules** (`~/.config/dt/tag-rules.yaml`) apply first
2. **Database overrides** apply on top:
   - `preserve` prevents global deletes/merges
   - `merges` adds to (or overrides) global merges
   - `blocklist` extends global blocklist
   - `taxonomy` extends global taxonomy

### CLI Integration

```bash
# Use global rules only
dt tags normalize -d "Hypnosis NLP" --apply

# Use global + database-specific rules (auto-detected by db name)
dt tags normalize -d "Hypnosis NLP" --apply
# Automatically loads ~/.config/dt/databases/hypnosis-nlp.yaml if exists

# Explicit rules file (overrides all)
dt tags normalize -d "Hypnosis NLP" --rules custom.yaml --apply

# Skip global rules entirely
dt tags normalize -d "Hypnosis NLP" --no-global --rules local.yaml --apply

# Initialize global config from analyze results
dt tags analyze -d "Hypnosis NLP" --init-global
# Creates ~/.config/dt/tag-rules.yaml with detected patterns
```

### Sharing Rules Across Machines

The `~/.config/dt/` directory can be:
- Symlinked to Dropbox/iCloud
- Version controlled in a dotfiles repo
- Part of your PAI infrastructure (`/Volumes/Xarismata/.config/dt/`)

```bash
# Link to PAI config location
ln -s /Volumes/Xarismata/.config/dt ~/.config/dt
```

---

## Implementation: Programmatic vs AI-Assisted

The core normalization engine is **100% programmatic** — no LLM calls required. AI is an optional enhancement for bootstrapping rules.

### Programmatic Core (No AI)

| Feature | Implementation |
|---------|---------------|
| Case normalization | `String.toLowerCase()` / `toUpperCase()` |
| Malformed fixes | Regex: `^:\s`, `^\s+`, `\s+$` |
| Case variant detection | Case-insensitive grouping |
| Punctuation variants | Normalize then compare: `bow-tie` → `bowtie` |
| Typo detection | Levenshtein distance < 2 (`fast-levenshtein`) |
| Plural/singular | Porter stemmer or simple rules (`s$`, `ies$`) |
| Blocklist matching | Static list + regex patterns |
| Low-usage detection | `count < threshold` |
| Co-occurrence analysis | Tag pairs that appear together → likely related |

### AI-Assisted (Optional)

Only used when explicitly requested:

```bash
# AI helps bootstrap initial rules file
dt tags analyze -d "Hypnosis NLP" --init-global --ai

# AI suggests canonical form for ambiguous clusters
dt tags analyze -d "Hypnosis NLP" --ai-suggest
```

**AI-assisted features:**
- **Smart canonical selection**: When multiple variants exist, AI picks the most "professional" form
- **Domain relevance scoring**: "Is `hockey puck` relevant to a hypnosis database?"
- **Synonym expansion**: Suggest merges beyond edit-distance (e.g., `CIA` ↔ `intelligence agency`)
- **Rules file generation**: Natural language → YAML rules

**Implementation**: Uses DEVONthink's built-in AI (`app.summarize`) or shells out to Claude via `dt chat` if available.

### Why This Split?

1. **Speed**: Programmatic ops process 10,000 tags in seconds; AI calls add latency
2. **Offline**: Works without internet/API keys
3. **Predictable**: Deterministic results, no hallucinated merges
4. **AI as accelerator**: One-time bootstrap, then pure rules

---

## Dependencies

- **Required**: None (pure JXA + Node)
- **Optional**: `fast-levenshtein` for typo detection
- **Optional**: `natural` for Porter stemmer (or inline simple rules)
- **Optional**: AI integration for `--ai` flag features

---

## Milestones

1. **v1**: `dt tags list` + `dt tags analyze` (read-only discovery)
2. **v2**: `dt tags merge` + `dt tags rename` + `dt tags delete` (single operations)
3. **v3**: `dt tags normalize` with rules engine (batch operations)
4. **v4**: ML artifact detection heuristics + undo system