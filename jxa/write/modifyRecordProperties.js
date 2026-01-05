#!/usr/bin/env osascript -l JavaScript
// Modify properties of a DEVONthink record (rename, tags, move)
// Usage: osascript -l JavaScript modifyRecordProperties.js '<json>'
// JSON format: {"uuid":"...","newName":"...","tagsAdd":[],"tagsRemove":[],"tagsReplace":[],"destGroupUuid":"...","comment":"...","customMetadata":{}}
// Required: uuid
// Optional: newName, tagsAdd, tagsRemove, tagsReplace, destGroupUuid (path or UUID), comment, customMetadata
//
// Examples:
//   osascript -l JavaScript modifyRecordProperties.js '{"uuid":"ABC123","newName":"New Title"}'
//   osascript -l JavaScript modifyRecordProperties.js '{"uuid":"ABC123","tagsAdd":["important","review"]}'
//   osascript -l JavaScript modifyRecordProperties.js '{"uuid":"ABC123","tagsReplace":["only","these","tags"]}'
//   osascript -l JavaScript modifyRecordProperties.js '{"uuid":"ABC123","destGroupUuid":"DEF456"}'
//   osascript -l JavaScript modifyRecordProperties.js '{"uuid":"ABC123","destGroupUuid":"/Path/To/Group"}'

ObjC.import("Foundation");

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

// Detect if string looks like a UUID or x-devonthink-item:// URL
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

// Resolve group by path or UUID
function resolveGroup(theApp, ref, database) {
  if (!ref) return null;
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
    if (!found) throw new Error("Group not found in path: " + part);
    current = found;
  }
  return current;
}

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: modifyRecordProperties.js \'{"uuid":"...","newName":"..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { uuid, newName, tagsAdd, tagsRemove, tagsReplace, destGroupUuid, comment, customMetadata } = params;

    if (!uuid) throw new Error("Missing required field: uuid");

    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(extractUuid(uuid));

    if (!record) throw new Error("Record not found: " + uuid);

    const result = {
      success: true,
      uuid: uuid,
      operations: {}
    };

    // RENAME
    if (newName) {
      result.previousName = record.name();
      record.name = newName;
      result.newName = newName;
      result.operations.renamed = true;
    }

    // TAGS
    if (tagsReplace || tagsAdd || tagsRemove) {
      const previousTags = record.tags() || [];
      result.previousTags = previousTags;

      let newTags;
      if (tagsReplace) {
        newTags = [...tagsReplace];
      } else {
        newTags = [...previousTags];
      }

      if (tagsAdd) {
        for (const tag of tagsAdd) {
          if (!newTags.includes(tag)) newTags.push(tag);
        }
      }

      if (tagsRemove) {
        newTags = newTags.filter(t => !tagsRemove.includes(t));
      }

      record.tags = newTags;
      result.newTags = newTags;
      result.operations.tagsModified = true;
    }

    // COMMENT
    if (comment !== undefined) {
      result.previousComment = record.comment() || "";
      record.comment = comment;
      result.newComment = comment;
      result.operations.commentModified = true;
    }

    // CUSTOM METADATA
    if (customMetadata && typeof customMetadata === "object") {
      const existing = record.customMetaData() || {};
      const merged = Object.assign({}, existing, customMetadata);
      record.customMetaData = merged;
      result.customMetadata = merged;
      result.operations.customMetadataModified = true;
    }

    // MOVE (destGroupUuid can be UUID or path)
    if (destGroupUuid) {
      result.previousLocation = record.location();
      // Get the record's database for path resolution
      const recordDb = record.database();
      const destGroup = resolveGroup(app, destGroupUuid, recordDb);
      const moved = app.move({ record: record, to: destGroup });
      result.newLocation = moved.location();
      result.operations.moved = true;
    }

    JSON.stringify(result, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
