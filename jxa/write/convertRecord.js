#!/usr/bin/env osascript -l JavaScript
// Convert a DEVONthink record to another format
// Usage: osascript -l JavaScript convertRecord.js '<json>'
// JSON format: {"uuid":"...","to":"...","destGroupUuid":"..."}
// Required: uuid
// Optional: to (format), destGroupUuid (destination group path or UUID)
//
// Formats: simple, rich, note, html, markdown, pdf, pdf-annotated, pdf-no-annotations, pdf-single, webarchive, bookmark
//
// Examples:
//   osascript -l JavaScript convertRecord.js '{"uuid":"ABC123"}'
//   osascript -l JavaScript convertRecord.js '{"uuid":"ABC123","to":"markdown"}'
//   osascript -l JavaScript convertRecord.js '{"uuid":"ABC123","to":"pdf","destGroupUuid":"/Exports"}'

ObjC.import("Foundation");

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

// Detect if string looks like a UUID or DEVONthink URL
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

// Map user-friendly format names to DEVONthink convert types
function getConvertType(format) {
  const mapping = {
    "simple": "simple",
    "plain": "simple",
    "text": "simple",
    "rich": "rich",
    "rtf": "rich",
    "note": "note",
    "formatted": "note",
    "html": "HTML",
    "markdown": "markdown",
    "md": "markdown",
    "pdf": "PDF document",
    "pdf-annotated": "PDF with annotations burnt in",
    "pdf-no-annotations": "PDF without annotations",
    "pdf-single": "single page PDF document",
    "webarchive": "webarchive",
    "bookmark": "bookmark"
  };

  const key = format.toLowerCase();
  if (!mapping[key]) {
    throw new Error("Unknown format: " + format + ". Valid: simple, rich, note, html, markdown, pdf, pdf-annotated, pdf-no-annotations, pdf-single, webarchive, bookmark");
  }
  return mapping[key];
}

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: convertRecord.js \'{"uuid":"...","to":"markdown"}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { uuid, to, destGroupUuid } = params;

    if (!uuid) throw new Error("Missing required field: uuid");

    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(extractUuid(uuid));

    if (!record) throw new Error("Record not found: " + uuid);

    // Build convert options
    const convertOptions = {
      record: record
    };

    // Set format (default: simple/plain text)
    if (to && to.length > 0) {
      convertOptions.to = getConvertType(to);
    }

    // Set destination group if specified
    if (destGroupUuid && destGroupUuid.length > 0) {
      const recordDb = record.database();
      const destGroup = resolveGroup(app, destGroupUuid, recordDb);
      if (destGroup) {
        convertOptions.in = destGroup;
      }
    }

    // Perform conversion
    const converted = app.convert(convertOptions);

    if (!converted) {
      throw new Error("Conversion failed");
    }

    JSON.stringify({
      success: true,
      originalUuid: uuid,
      originalName: record.name(),
      convertedUuid: converted.uuid(),
      convertedName: converted.name(),
      convertedType: converted.recordType(),
      convertedLocation: converted.location(),
      format: to || "simple"
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
