#!/usr/bin/env osascript -l JavaScript
// Execute batch classification for multiple DEVONthink records
// Usage: osascript -l JavaScript batchClassify.js '<json-array>'
//
// JSON array format:
// [
//   {
//     "uuid": "ABC123",                    // Required: record to classify
//     "database": "Hypnosis NLP",          // Required: target database
//     "groupPath": "/Authors A—Z/E/EWIN",  // Required: destination path
//     "createGroup": true,                 // Optional: create path if missing
//     "newName": "Title | Author | Year",  // Optional: rename document
//     "tags": ["tag1", "tag2"],            // Optional: replace all tags
//     "comment": "Summary text",           // Optional: set comment field
//     "customMetadata": {"key": "value"},  // Optional: set custom metadata
//     "replicateTo": "/Topics A—Z/H/Hyp"   // Optional: replicate to topic path
//   }
// ]

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: "Usage: batchClassify.js '<json-array>'"
  });
} else {
  try {
    const items = JSON.parse(jsonArg);
    if (!Array.isArray(items)) throw new Error("Input must be a JSON array");

    const app = Application("DEVONthink");
    const results = [];
    const errors = [];

    for (const item of items) {
      try {
        const { uuid, database, groupPath, createGroup, newName, tags, comment, customMetadata, replicateTo } = item;

        if (!uuid) throw new Error("Missing required field: uuid");
        if (!database) throw new Error("Missing required field: database");
        if (!groupPath) throw new Error("Missing required field: groupPath");

        const record = app.getRecordWithUuid(extractUuid(uuid));
        if (!record) throw new Error("Record not found: " + uuid);

        const operations = [];

        // 1. Find or create destination group
        const destGroup = getOrCreateGroup(app, database, groupPath, createGroup !== false);
        operations.push("found/created destination");

        // 2. Rename if specified
        if (newName) {
          record.name = newName;
          operations.push("renamed");
        }

        // 3. Apply tags if specified
        if (tags && Array.isArray(tags)) {
          record.tags = tags;
          operations.push("tagged");
        }

        // 4. Set comment if specified
        if (comment) {
          record.comment = comment;
          operations.push("comment set");
        }

        // 5. Set custom metadata if specified
        if (customMetadata && typeof customMetadata === "object") {
          const existing = record.customMetaData() || {};
          record.customMetaData = Object.assign({}, existing, customMetadata);
          operations.push("metadata set");
        }

        // 6. Move to destination
        const moved = app.move({ record: record, to: destGroup });
        operations.push("moved");

        // 7. Create replicate if specified (auto-create path if needed)
        let replicateResult = null;
        if (replicateTo) {
          try {
            const replicateGroup = getOrCreateGroup(app, database, replicateTo, true);
            app.replicate({ record: moved, to: replicateGroup });
            operations.push("replicated");
            replicateResult = replicateTo;
          } catch (repError) {
            // Don't fail the whole classification if replicate fails
            operations.push("replicate failed: " + repError.message);
          }
        }

        results.push({
          uuid: uuid,
          status: "success",
          name: moved.name(),
          location: moved.location(),
          database: moved.database().name(),
          operations: operations,
          replicateTo: replicateResult
        });

      } catch (e) {
        errors.push({
          uuid: item.uuid || "unknown",
          status: "error",
          error: e.message
        });
      }
    }

    JSON.stringify({
      success: true,
      processed: items.length,
      succeeded: results.length,
      failed: errors.length,
      results: results,
      errors: errors
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
