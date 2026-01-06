#!/usr/bin/env osascript -l JavaScript
// Delete tags from DEVONthink
// Usage: deleteTags.js '{"database": "...", "tags": ["tag1", "tag2"]}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({ success: false, error: 'Usage: deleteTags.js \'{"database": "...", "tags": [...]}\'' });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const app = Application("DEVONthink");

    if (!params.tags || params.tags.length === 0) throw new Error("At least one tag is required");

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

    // Find tags to delete
    const toDelete = [];
    const notFound = [];
    for (const tagName of params.tags) {
      const tag = tagGroups.find(t => t.name() === tagName);
      if (tag) {
        toDelete.push({
          name: tag.name(),
          uuid: tag.uuid(),
          recordCount: tag.children().length,
          ref: tag
        });
      } else {
        notFound.push(tagName);
      }
    }

    if (toDelete.length === 0) {
      throw new Error("No tags found to delete. Missing: " + notFound.join(", "));
    }

    // Dry run mode
    if (params.dryRun) {
      JSON.stringify({
        success: true,
        dryRun: true,
        tagsToDelete: toDelete.map(t => ({ name: t.name, recordCount: t.recordCount })),
        notFound: notFound.length > 0 ? notFound : undefined,
        totalRecordsAffected: toDelete.reduce((sum, t) => sum + t.recordCount, 0)
      });
    } else {
      // Delete the tags
      const deleted = [];
      const errors = [];

      for (const tagInfo of toDelete) {
        try {
          app.delete({ record: tagInfo.ref });
          deleted.push({ name: tagInfo.name, recordCount: tagInfo.recordCount });
        } catch (e) {
          errors.push({ name: tagInfo.name, error: e.message });
        }
      }

      JSON.stringify({
        success: errors.length === 0,
        deleted: deleted,
        errors: errors.length > 0 ? errors : undefined,
        notFound: notFound.length > 0 ? notFound : undefined,
        totalDeleted: deleted.length,
        totalRecordsAffected: deleted.reduce((sum, t) => sum + t.recordCount, 0)
      });
    }
  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
