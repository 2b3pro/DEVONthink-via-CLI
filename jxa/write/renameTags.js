#!/usr/bin/env osascript -l JavaScript
// Rename a tag in DEVONthink
// Usage: renameTags.js '{"database": "...", "from": "oldName", "to": "newName"}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({ success: false, error: 'Usage: renameTags.js \'{"database": "...", "from": "...", "to": "..."}\'' });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const app = Application("DEVONthink");

    if (!params.from) throw new Error("Source tag name (from) is required");
    if (!params.to) throw new Error("Target tag name (to) is required");

    // Get database
    let db;
    if (params.database) {
      if (isUuid(params.database)) {
        db = app.getDatabaseWithUuid(extractUuid(params.database));
      } else {
        const databases = app.databases();
        db = databases.find(d => d.name() === params.database);
      }
      if (!db) throw new Error("Database not found: " + params.database);
    } else {
      db = app.currentDatabase();
      if (!db) throw new Error("No database specified and no current database");
    }

    // Get all tag groups
    const tagGroups = db.tagGroups();

    // Find the tag to rename
    const tag = tagGroups.find(t => t.name() === params.from);
    if (!tag) throw new Error("Tag not found: " + params.from);

    // Check if target name already exists
    const existingTarget = tagGroups.find(t => t.name() === params.to);
    if (existingTarget) {
      throw new Error("A tag with the name '" + params.to + "' already exists. Use 'dt tags merge' to combine tags.");
    }

    // Dry run mode
    if (params.dryRun) {
      JSON.stringify({
        success: true,
        dryRun: true,
        from: params.from,
        to: params.to,
        recordCount: tag.children().length
      });
    } else {
      // Rename the tag
      const oldName = tag.name();
      const recordCount = tag.children().length;
      tag.name = params.to;

      JSON.stringify({
        success: true,
        renamed: true,
        from: oldName,
        to: tag.name(),
        recordCount: recordCount
      });
    }
  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
