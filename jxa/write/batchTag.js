#!/usr/bin/env osascript -l JavaScript
// Batch tag multiple DEVONthink records
// Usage: osascript -l JavaScript batchTag.js '[{"uuid": "...", "tags": ["t1"], "operation": "add"}]'
// operations: 'add' (default), 'remove', 'set'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({ success: false, error: "Usage: batchTag.js JSON_ARRAY" });
} else {
  try {
    const items = JSON.parse(jsonArg);
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Input must be a non-empty array of objects");
    }

    const app = Application("DEVONthink");
    const results = [];
    const errors = [];

    for (const item of items) {
      const { uuid, tags, operation = "add" } = item;
      
      try {
        if (!uuid || !Array.isArray(tags)) {
          throw new Error("Missing uuid or tags array");
        }

        const record = app.getRecordWithUuid(extractUuid(uuid));
        if (!record) {
          errors.push({ uuid: uuid, error: "Record not found" });
          continue;
        }

        const currentTags = record.tags();
        let newTags = [];

        if (operation === "set") {
          newTags = tags;
        } else if (operation === "add") {
          // Union
          const set = new Set([...currentTags, ...tags]);
          newTags = Array.from(set);
        } else if (operation === "remove") {
          // Difference
          const toRemove = new Set(tags);
          newTags = currentTags.filter(t => !toRemove.has(t));
        } else {
          throw new Error("Invalid operation: " + operation);
        }

        // Only update if changed
        // (Primitive array comparison)
        const sortedCurrent = [...currentTags].sort().join("|");
        const sortedNew = [...newTags].sort().join("|");

        if (sortedCurrent !== sortedNew) {
           record.tags = newTags;
           results.push({ uuid: record.uuid(), status: "updated", tags: newTags });
        } else {
           results.push({ uuid: record.uuid(), status: "unchanged" });
        }

      } catch (e) {
        errors.push({ uuid: uuid, error: e.message });
      }
    }

    JSON.stringify({
      success: errors.length === 0,
      tagged: results,
      errors: errors.length > 0 ? errors : undefined,
      count: results.length
    });

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
