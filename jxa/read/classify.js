#!/usr/bin/env osascript -l JavaScript
// Get classification proposals for a DEVONthink record
// Usage: osascript -l JavaScript classify.js <uuid> [database] [includeTags]
// database can be name or UUID (auto-detected)
// Examples:
//   osascript -l JavaScript classify.js "27D0D443-4E18-40EF-86EE-6F5E15966FC5"
//   osascript -l JavaScript classify.js "27D0D443-4E18-40EF-86EE-6F5E15966FC5" "IAS Personal"
//   osascript -l JavaScript classify.js "27D0D443-4E18-40EF-86EE-6F5E15966FC5" "A1B2-C3D4-..." "true"

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

// Resolve database by name or UUID
function getDatabase(theApp, ref) {
  if (!ref) return null;
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

const recordUuid = getArg(4, null);
const databaseRef = getArg(5, "");
const includeTags = getArg(6, "false").toLowerCase() === "true";

if (!recordUuid) {
  JSON.stringify({ success: false, error: "Usage: classify.js <uuid> [database] [includeTags]" });
} else {
  try {
    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(extractUuid(recordUuid));

    if (!record) {
      JSON.stringify({ success: false, error: "Record not found: " + recordUuid });
    } else {
      // Build classify options
      const classifyOptions = { record: record };

      // Add database scope if specified (by name or UUID)
      if (databaseRef && databaseRef.length > 0) {
        const db = getDatabase(app, databaseRef);
        if (db) {
          classifyOptions.in = db;
        }
      }

      // Get classification proposals using the classify command
      const proposals = app.classify(classifyOptions);

      if (!proposals || proposals.length === 0) {
        JSON.stringify({
          success: true,
          uuid: recordUuid,
          name: record.name(),
          proposals: [],
          message: "No classification proposals found"
        });
      } else {
        // Map proposals to output format
        const results = proposals.map(p => ({
          uuid: p.uuid(),
          name: p.name(),
          path: p.location(),
          database: p.database().name(),
          recordType: p.recordType()
        }));

        JSON.stringify({
          success: true,
          uuid: recordUuid,
          name: record.name(),
          proposalCount: results.length,
          proposals: results
        }, null, 2);
      }
    }
  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
