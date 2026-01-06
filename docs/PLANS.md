---
status: active
keywords: [roadmap, planning, features, future]
---

# DEVONthink CLI: The "AI-OS" Evolution
*Turning DEVONthink into the Long-Term Memory for AI Agents*

As of 2026-01-05 16:09

## Executive Summary
This roadmap transforms `dt` from a simple command-line utility into a **comprehensive AI Operating System interface** for DEVONthink. By exposing the semantic and structural relationships within your database to LLMs, we enable a new class of "Agentic Workflows" where your knowledge base becomes an active participant in your thinking process.

---

## Phase 1: The Navigator (Immediate Value) v1.X
**Goal:** Enable both human users and AI agents to traverse the "Knowledge Graph" of your database, not just search for keywords.

### 1. `dt get related`
Exposes the connective tissue of your database.
- **Incoming Links:** Which documents cite this one? (Backlinks)
- **Outgoing Links:** What does this document cite?
- **Similar Records:** What does DEVONthink's AI think is semantically related? ("See Also")

**Usage:**
```bash
dt get related <uuid> --type incoming
dt get related <uuid> --type similar --limit 5
```

### 2. `dt graph`
Visualizes the neighborhood of a record.
- **Formats:** JSON (for agents), Mermaid (for rendering), DOT (for Graphviz).
- **Depth:** Configurable traversal depth (e.g., immediate neighbors vs. 2 steps away).

**Usage:**
```bash
# Generate a visual map of a concept
dt graph <uuid> --depth 1 --format mermaid > graph.mmd
```

---

## Phase 2: The Connector (The "Extraordinary" Leap) v2.X
**Goal:** Zero-friction integration with Claude Desktop, Cursor, and other MCP-compliant agents.

### 1. `dt mcp` (Model Context Protocol Server)
Implements a compliant MCP server that runs locally. This allows Claude Desktop to "mount" your DEVONthink databases as if they were local folders, but with semantic superpowers.

**Exposed Tools:**
- `devonthink_search`: Full-text and semantic search.
- `devonthink_read`: Read content of any record.
- `devonthink_related`: Traverse links.
- `devonthink_append`: Add quick notes/logs without breaking flow.

**Exposed Resources:**
- `devonthink://<database>/<uuid>`: Direct read access to records as resources.

**Why this is huge:**
You can ask Claude: *"Based on my notes about 'Neural Networks' in DEVONthink, what are the key gaps in my understanding?"* — and it will actually look, read, and traverse your real data.

---

## Phase 3: The Synthesizer (Context Optimization)
**Goal:** Prepare high-quality, dense context for external LLMs (ChatGPT, simple scripts) without hitting token limits.

### 1. `dt pack`
Bundles a record and its "context halo" (related records) into a single, optimized prompt payload.
- **Smart Pruning:** Removes irrelevant metadata.
- **Token Estimation:** Warns if the context exceeds standard windows.
- **Formats:** XML (Claude-optimized), Markdown.

**Usage:**
```bash
# "Pack this project and its 5 most relevant related docs for Claude"
dt pack <project-uuid> --include-related 5 --format xml | pbcopy
```

### 2. `dt summarize --recursive`
Recursively summarizes a group or folder structure into a single "Master Sheet".
- Ideal for "catching up" on a project or generating a newsletter from a week of links.

---

## Phase 4: The Agent (Autonomous Research)
**Goal:** Active knowledge generation.

### 1. `dt agent research`
A recursive loop that acts like a human researcher.
1.  **Search** for a topic.
2.  **Read** the top 5 results.
3.  **Identify** missing info or interesting links.
4.  **Traverse** (`dt get related`) to find connections.
5.  **Synthesize** a new "Research Report" Markdown note in your Inbox.

**Usage:**
```bash
dt agent research "Impact of Transformers on NLP" --depth 2 --save-to "Research/AI"
```

---

## Implementation Strategy

### Step 1: Foundation (Today)
- Implement `dt get related` (JXA: `app.compare`, `record.incomingReferences`).
- Implement `dt graph` (JXA + Node link formatting).

### Step 2: Server (Next)
- Add `@modelcontextprotocol/sdk` dependency.
- Create `src/mcp/server.js`.
- Map `dt` commands to MCP tools.

### Step 3: Intelligence
- Implement `dt pack` and `dt agent` logic using the `src/commands/` structure.

---

## Recommendation
Start with **Phase 1 (Navigator)**. It provides immediate utility for you via the CLI and lays the necessary API foundation (JXA scripts) that the **MCP Server (Phase 2)** will ultimately wrap.