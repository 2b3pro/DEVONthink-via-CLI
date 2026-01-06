#!/usr/bin/env osascript -l JavaScript
// Batch update properties of multiple DEVONthink records
// Usage: osascript -l JavaScript batchUpdate.js '[{"uuid": "...", "properties": {"name": "..."}}, ...]'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({ success: false, error: "Usage: batchUpdate.js JSON_ARRAY" });
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
      const { uuid, properties } = item;
      
      try {
        if (!uuid || !properties) {
          throw new Error("Missing uuid or properties object");
        }

        const record = app.getRecordWithUuid(extractUuid(uuid));
        if (!record) {
          errors.push({ uuid: uuid, error: "Record not found" });
          continue;
        }

        const changes = [];

        // Apply updates
        // String/Simple Props
        if (properties.name !== undefined) { record.name = properties.name; changes.push("name"); }
        if (properties.comment !== undefined) { record.comment = properties.comment; changes.push("comment"); }
        if (properties.url !== undefined) { record.url = properties.url; changes.push("url"); }
        if (properties.source !== undefined) { record.source = properties.source; changes.push("source"); }
        
        // Numbers/Enums
        if (properties.label !== undefined) { record.label = properties.label; changes.push("label"); }
        if (properties.rating !== undefined) { record.rating = properties.rating; changes.push("rating"); }
        
        // Booleans
        if (properties.unread !== undefined) { record.unread = properties.unread; changes.push("unread"); }
        if (properties.flagged !== undefined) { record.state = properties.flagged; changes.push("flagged"); } // state=true/false is flagged
        if (properties.locked !== undefined) { record.locking = properties.locked; changes.push("locked"); }
        
        // Aliases (comma string or list)
        if (properties.aliases !== undefined) { 
            record.aliases = Array.isArray(properties.aliases) ? properties.aliases.join(", ") : properties.aliases;
            changes.push("aliases");
        }

        // Custom Metadata
        if (properties.customMetaData) {
            const existing = record.customMetaData() || {};
            const merged = Object.assign({}, existing, properties.customMetaData);
            record.customMetaData = merged;
            changes.push("customMetaData");
        }

        results.push({ 
            uuid: record.uuid(), 
            status: "updated", 
            changes: changes 
        });

      } catch (e) {
        errors.push({ uuid: uuid, error: e.message });
      }
    }

    JSON.stringify({
      success: errors.length === 0,
      updated: results,
      errors: errors.length > 0 ? errors : undefined,
      count: results.length
    });

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
