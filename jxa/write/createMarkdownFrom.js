#!/usr/bin/env osascript -l JavaScript
// Create a Markdown document from a web URL
// Usage: osascript -l JavaScript createMarkdownFrom.js '<json>'
// JSON format: {"url":"...","name":"...","database":"...","groupPath":"...","readability":true,"agent":"...","referrer":"..."}
// Required: url
// Optional: name, database, groupPath, readability, agent, referrer
//
// Examples:
//   osascript -l JavaScript createMarkdownFrom.js '{"url":"https://example.com/article"}'
//   osascript -l JavaScript createMarkdownFrom.js '{"url":"https://example.com","name":"My Article","database":"Inbox","readability":true}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: createMarkdownFrom.js \'{"url":"https://..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { url, name, database: databaseRef, groupPath, readability, agent, referrer, tags } = params;

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

    if (readability === true) {
      options.readability = true;
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

    // Create Markdown from URL
    const record = app.createMarkdownFrom(url, options);

    if (!record) {
      throw new Error("Failed to create Markdown from URL");
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
