#!/usr/bin/env osascript -l JavaScript
// Create a new DEVONthink record
// Usage: osascript -l JavaScript createRecord.js '<json>'
// JSON format: {"name":"Title","type":"markdown","database":"Inbox","groupPath":"/","content":"...","url":"...","tags":["tag1"]}
//
// Dependencies (injected by runner):
// - getArg(index, default)
// - isUuid(str)
// - extractUuid(str)
// - getDatabase(app, ref)
// - resolveGroup(app, ref, db)

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: createRecord.js \'{\"name\":\"...\",\"type\":\"...\",\"database\":\"...\"}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { name, type, database: databaseRef, groupPath, content, url, tags, query } = params;

    if (!name) throw new Error("Missing required field: name");
    if (!type) throw new Error("Missing required field: type");

    const app = Application("DEVONthink");

    // Resolve destination group and database
    let db;
    let destination;

    if (groupPath && isUuid(groupPath)) {
      // Group UUID provided - get database from the group itself
      destination = app.getRecordWithUuid(extractUuid(groupPath));
      if (!destination) throw new Error("Group not found with UUID: " + groupPath);
      const groupType = destination.recordType();
      if (groupType !== "group" && groupType !== "smart group") {
        throw new Error("UUID does not point to a group: " + groupType);
      }
      db = destination.database();
    } else {
      // Need database for path resolution
      if (!databaseRef) throw new Error("Missing required field: database (required when groupPath is not a UUID)");
      db = getDatabase(app, databaseRef);
      destination = resolveGroup(app, groupPath || "/", db);
    }

    // Create record properties
    const createProps = {
      name: name,
      type: type
    };

    if (content) createProps.content = content;
    if (url) createProps.URL = url;

    // Validate type
    const validTypes = ["markdown", "txt", "rtf", "bookmark", "html", "group", "smart group"];
    if (!validTypes.includes(type)) {
      throw new Error("Unknown type: " + type + ". Valid: " + validTypes.join(", "));
    }

    // Bookmark requires URL
    if (type === "bookmark" && !url) {
      throw new Error("URL required for bookmark type");
    }

    // Smart Group requires query
    if (type === "smart group") {
      if (!query) throw new Error("Query required for smart group type");
      createProps.searchQuery = query;
    }

    // Create record
    const record = app.createRecordWith(createProps, { in: destination });

    if (!record) throw new Error("Failed to create record");

    // Apply tags if specified
    if (tags && Array.isArray(tags) && tags.length > 0) {
      record.tags = tags;
    }

    JSON.stringify({
      success: true,
      uuid: record.uuid(),
      name: record.name(),
      location: record.location(),
      database: db.name(),
      recordType: record.recordType()
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}