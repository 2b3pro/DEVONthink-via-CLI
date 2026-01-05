#!/usr/bin/env osascript -l JavaScript
// Create a new DEVONthink record
// Usage: osascript -l JavaScript createRecord.js '<json>'
// JSON format: {"name":"Title","type":"markdown","database":"Inbox","groupPath":"/","content":"...","url":"...","tags":["tag1"]}
// Required: name, type, database (name or UUID) - database optional if groupPath is a UUID
// Optional: groupPath (path or UUID, default "/"), content, url (for bookmarks), tags
// Types: markdown, txt, rtf, bookmark, html, group
//
// Examples:
//   osascript -l JavaScript createRecord.js '{"name":"My Note","type":"markdown","database":"Inbox","content":"# Hello"}'
//   osascript -l JavaScript createRecord.js '{"name":"Link","type":"bookmark","database":"A1B2-C3D4-...","url":"https://example.com"}'
//   osascript -l JavaScript createRecord.js '{"name":"New Folder","type":"group","database":"IAS Personal","groupPath":"/Projects"}'

ObjC.import("Foundation");

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

// Detect if string looks like a UUID or DEVONthink URL (alphanumeric with hyphens, no slashes)
function isUuid(str) {
  if (!str || typeof str !== "string") return false;
  if (str.startsWith("x-devonthink-item://")) return true;
  if (str.includes("/")) return false;
  return /^[A-F0-9-]{8,}$/i.test(str) && str.includes("-");
}

// Extract UUID from x-devonthink-item:// URL or return raw UUID
function extractUuid(str) {
  if (!str) return null;
  const urlMatch = str.match(/^x-devonthink-item:\/\/([A-F0-9-]+)$/i);
  if (urlMatch) return urlMatch[1];
  if (isUuid(str)) return str;
  return str; // Return as-is, let DEVONthink handle validation
}

// Resolve database by name or UUID
function getDatabase(theApp, ref) {
  if (!ref) return theApp.currentDatabase();
  if (isUuid(ref)) {
    const record = theApp.getRecordWithUuid(extractUuid(ref));
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
    const group = theApp.getRecordWithUuid(extractUuid(ref));
    if (!group) throw new Error("Group not found with UUID: " + ref);
    const type = group.recordType();
    if (type !== "group" && type !== "smart group") {
      throw new Error("UUID does not point to a group: " + type);
    }
    return group;
  }
  // Navigate path
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
    error: 'Usage: createRecord.js \'{"name":"...","type":"...","database":"..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { name, type, database: databaseRef, groupPath, content, url, tags } = params;

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
    const validTypes = ["markdown", "txt", "rtf", "bookmark", "html", "group"];
    if (!validTypes.includes(type)) {
      throw new Error("Unknown type: " + type + ". Valid: " + validTypes.join(", "));
    }

    // Bookmark requires URL
    if (type === "bookmark" && !url) {
      throw new Error("URL required for bookmark type");
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
