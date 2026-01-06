#!/usr/bin/env osascript -l JavaScript
// Merge tags using DEVONthink's native merge API
// Usage: mergeTags.js '{"database": "...", "target": "tagName", "sources": ["tag1", "tag2"]}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({ success: false, error: 'Usage: mergeTags.js \'{"database": "...", "target": "...", "sources": [...]}\'' });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const app = Application("DEVONthink");

    if (!params.target) throw new Error("Target tag is required");
    if (!params.sources || params.sources.length === 0) throw new Error("At least one source tag is required");

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

    // Find target tag group
    const targetTag = tagGroups.find(t => t.name() === params.target);
    if (!targetTag) throw new Error("Target tag not found: " + params.target);

    // Find source tag groups
    const sourceTags = [];
    const notFound = [];
    for (const sourceName of params.sources) {
      const sourceTag = tagGroups.find(t => t.name() === sourceName);
      if (sourceTag) {
        sourceTags.push(sourceTag);
      } else {
        notFound.push(sourceName);
      }
    }

    if (sourceTags.length === 0) {
      throw new Error("No source tags found. Missing: " + notFound.join(", "));
    }

    // Dry run mode - just report what would happen
    if (params.dryRun) {
      const sourceInfo = sourceTags.map(t => ({
        name: t.name(),
        recordCount: t.children().length
      }));

      JSON.stringify({
        success: true,
        dryRun: true,
        target: params.target,
        sources: sourceInfo,
        notFound: notFound,
        totalRecordsAffected: sourceInfo.reduce((sum, s) => sum + s.recordCount, 0)
      });
    } else {
      // Perform the merge - target must be first in the array
      // DEVONthink keeps the first tag and merges others into it
      const mergeList = [targetTag, ...sourceTags];
      const result = app.merge({ records: mergeList });

      JSON.stringify({
        success: true,
        merged: true,
        target: params.target,
        sourcesMerged: sourceTags.map(t => t.name()),
        notFound: notFound.length > 0 ? notFound : undefined,
        survivingTag: result ? result.name() : params.target
      });
    }
  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
