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

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

// Detect if string looks like a UUID
function isUuid(str) {
  if (!str || typeof str !== "string" || str.includes("/")) return false;
  return /^[A-F0-9-]{8,}$/i.test(str) && str.includes("-");
}

// Resolve database by name or UUID
function getDatabase(theApp, ref) {
  if (!ref) return null;
  if (isUuid(ref)) {
    const record = theApp.getRecordWithUuid(ref);
    if (record) return record.database();
    throw new Error("Database not found with UUID: " + ref);
  }
  const databases = theApp.databases();
  const found = databases.find(db => db.name() === ref);
  if (!found) throw new Error("Database not found: " + ref);
  return found;
}

// Resolve group by path or UUID
function resolveGroup(theApp, ref, database) {
  if (!ref || ref === "/") return database.root();
  if (isUuid(ref)) {
    const group = theApp.getRecordWithUuid(ref);
    if (!group) throw new Error("Group not found with UUID: " + ref);
    return group;
  }
  let current = database.root();
  const parts = ref.split("/").filter(p => p.length > 0);
  for (const part of parts) {
    const children = current.children();
    const found = children.find(c => c.name() === part);
    if (!found) throw new Error("Group not found: " + part);
    current = found;
  }
  return current;
}

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
    if (databaseRef && databaseRef.length > 0) {
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
