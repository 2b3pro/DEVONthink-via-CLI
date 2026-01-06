#!/usr/bin/env osascript -l JavaScript
// Get related records (incoming links, outgoing links, AI-suggested similar, or classification-based)
// Usage: osascript -l JavaScript getRelated.js '<json>'
// JSON format: {"uuid":"...", "type":"incoming|outgoing|similar|byData|byTags|all", "limit":10, "database":"..."}
// Returns: { success: true, relations: [ { uuid, name, type, ... } ] }

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({ success: false, error: "Missing arguments" });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const uuid = extractUuid(params.uuid);
    const type = params.type || "all";
    const limit = params.limit || 50;
    const databaseRef = params.database || null;

    if (!uuid) throw new Error("Missing UUID");

    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(uuid);

    if (!record) throw new Error("Record not found: " + uuid);

    // Get optional database for scoping classify
    let targetDb = null;
    if (databaseRef) {
      targetDb = getDatabase(app, databaseRef);
    }

    let results = [];

    // Helper to format record
    const format = (rec, relationType, score) => ({
      uuid: rec.uuid(),
      name: rec.name(),
      database: rec.database().name(),
      location: rec.location(),
      relation: relationType, // incoming, outgoing, similar, byData, byTags
      score: score || null,
      path: rec.path()
    });

    // 1. Incoming References (Backlinks)
    if (type === "incoming" || type === "all") {
      const incoming = record.incomingReferences();
      // incomingReferences() returns a list of records
      for (let i = 0; i < incoming.length; i++) {
        results.push(format(incoming[i], "incoming"));
      }
    }

    // 2. Outgoing References (Wiki Links / Citations)
    if (type === "outgoing" || type === "all") {
      const outgoing = record.outgoingReferences();
      for (let i = 0; i < outgoing.length; i++) {
        results.push(format(outgoing[i], "outgoing"));
      }
    }

    // 3. Similar Records (AI "See Also")
    if (type === "similar" || type === "all") {
      // app.compare(record) returns a list of records sorted by relevance
      const similar = app.compare(record);
      // Determine how many to take
      const count = similar.length;
      // We don't get a raw score easily from JXA compare(), usually just the list ordered by score.
      // We can mock a rank score or just leave it null.
      for (let i = 0; i < count; i++) {
        // Exclude the record itself if it appears
        if (similar[i].uuid() !== record.uuid()) {
           results.push(format(similar[i], "similar", (count - i) / count)); // Mock normalized score
        }
      }
    }

    // 4. Classification by Data (text & metadata comparison)
    if (type === "byData") {
      const classifyOpts = { record: record, comparison: "data comparison" };
      if (targetDb) classifyOpts.in = targetDb;
      const proposals = app.classify(classifyOpts);
      const count = proposals.length;
      for (let i = 0; i < count; i++) {
        if (proposals[i].uuid() !== record.uuid()) {
          results.push(format(proposals[i], "byData", (count - i) / count));
        }
      }
    }

    // 5. Classification by Tags
    if (type === "byTags") {
      const classifyOpts = { record: record, comparison: "tags comparison" };
      if (targetDb) classifyOpts.in = targetDb;
      const proposals = app.classify(classifyOpts);
      const count = proposals.length;
      for (let i = 0; i < count; i++) {
        if (proposals[i].uuid() !== record.uuid()) {
          results.push(format(proposals[i], "byTags", (count - i) / count));
        }
      }
    }

    // Deduplicate if "all" (a record could be both linked and similar)
    if (type === "all") {
        const seen = new Set();
        results = results.filter(r => {
            const key = r.uuid + r.relation;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // Apply limit per category or overall? 
    // If specific type is requested, limit applies to it.
    // If "all", maybe limit total? Let's limit total for safety.
    if (results.length > limit) {
        results = results.slice(0, limit);
    }

    JSON.stringify({
      success: true,
      source: {
        uuid: record.uuid(),
        name: record.name()
      },
      relations: results,
      count: results.length
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
