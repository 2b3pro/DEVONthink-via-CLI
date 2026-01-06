#!/usr/bin/env osascript -l JavaScript
// Create a PDF document from a web URL
// Usage: osascript -l JavaScript createPdfFrom.js '<json>'
// JSON format: {"url":"...","name":"...","database":"...","groupPath":"...","pagination":true,"readability":false,"width":800,"agent":"...","referrer":"..."}
// Required: url
// Optional: name, database, groupPath, pagination, readability, width, agent, referrer
//
// Examples:
//   osascript -l JavaScript createPdfFrom.js '{"url":"https://example.com/article"}'
//   osascript -l JavaScript createPdfFrom.js '{"url":"https://example.com","name":"Article","database":"Inbox","pagination":true}'
//   osascript -l JavaScript createPdfFrom.js '{"url":"https://example.com","width":1200,"readability":true}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: createPdfFrom.js \'{"url":"https://..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { url, name, database: databaseRef, groupPath, pagination, readability, width, agent, referrer, tags } = params;

    if (!url) throw new Error("Missing required field: url");
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("Invalid URL: must start with http:// or https://");
    }

    const app = Application("DEVONthink");

    // Build options
    const options = {};

    if (name && name.length > 0) {
      options.name = name;
    }

    if (pagination === true) {
      options.pagination = true;
    }

    if (readability === true) {
      options.readability = true;
    }

    if (width && typeof width === "number" && width > 0) {
      options.width = width;
    }

    if (agent && agent.length > 0) {
      options.agent = agent;
    }

    if (referrer && referrer.length > 0) {
      options.referrer = referrer;
    }

    // Set destination if specified
    if (groupPath && isUuid(groupPath)) {
      // Group UUID provided - resolve directly
      const destination = app.getRecordWithUuid(extractUuid(groupPath));
      if (!destination) throw new Error("Group not found with UUID: " + groupPath);
      const groupType = destination.recordType();
      if (groupType !== "group" && groupType !== "smart group") {
        throw new Error("UUID does not point to a group: " + groupType);
      }
      options.in = destination;
    } else if (databaseRef && databaseRef.length > 0) {
      // Database + optional path
      const db = getDatabase(app, databaseRef);
      const destination = resolveGroup(app, groupPath || "/", db);
      options.in = destination;
    }

    // Create PDF from URL
    const record = app.createPdfDocumentFrom(url, options);

    if (!record) {
      throw new Error("Failed to create PDF from URL");
    }

    // Apply tags if specified
    if (tags && Array.isArray(tags) && tags.length > 0) {
      record.tags = tags;
    }

    JSON.stringify({
      success: true,
      uuid: record.uuid(),
      name: record.name(),
      location: record.location(),
      database: record.database().name(),
      recordType: record.recordType(),
      sourceUrl: url
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
