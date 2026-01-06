#!/usr/bin/env osascript -l JavaScript
// List all tags in a database with usage counts
// Usage: listTags.js '{"database": "...", "minCount": 1, "sort": "alpha|count"}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({ success: false, error: 'Usage: listTags.js \'{"database": "..."}\'' });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const app = Application("DEVONthink");

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

    // Collect all tags with counts
    const tagCounts = {};
    const records = db.contents();
    const totalRecords = records.length;

    for (let i = 0; i < totalRecords; i++) {
      try {
        const tags = records[i].tags();
        if (tags && tags.length > 0) {
          for (const tag of tags) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        }
      } catch (e) {
        // Skip records that error (e.g., smart groups)
      }
    }

    // Convert to array
    let tags = Object.entries(tagCounts).map(([tag, count]) => ({ tag, count }));

    // Filter by minimum count
    const minCount = params.minCount || 1;
    if (minCount > 1) {
      tags = tags.filter(t => t.count >= minCount);
    }

    // Sort
    const sort = params.sort || 'alpha';
    if (sort === 'count') {
      tags.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    } else {
      tags.sort((a, b) => a.tag.toLowerCase().localeCompare(b.tag.toLowerCase()));
    }

    JSON.stringify({
      success: true,
      database: db.name(),
      databaseUuid: db.uuid(),
      totalRecords: totalRecords,
      totalTags: tags.length,
      totalTagInstances: Object.values(tagCounts).reduce((a, b) => a + b, 0),
      tags: tags
    });
  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
