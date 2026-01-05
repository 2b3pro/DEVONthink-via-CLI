#!/usr/bin/env osascript -l JavaScript
// Reveal a record or its parent in DEVONthink
// Usage: osascript -l JavaScript revealRecord.js <uuid> [target] [mode]
//
// Arguments:
//   uuid   - Record UUID (required)
//   target - "self" (default) or "parent"
//   mode   - "window" (default), "tab", or "reveal" (in-place navigation)
//
// Examples:
//   osascript -l JavaScript revealRecord.js "ABC123"                    # record in new window
//   osascript -l JavaScript revealRecord.js "ABC123" parent             # parent folder in new window
//   osascript -l JavaScript revealRecord.js "ABC123" self tab           # record in new tab
//   osascript -l JavaScript revealRecord.js "ABC123" parent tab         # parent folder in new tab
//   osascript -l JavaScript revealRecord.js "ABC123" self reveal        # navigate to record in frontmost window
//   osascript -l JavaScript revealRecord.js "ABC123" parent reveal      # navigate to parent in frontmost window
//
// NOTE: Use locationGroup() not parent() to access containing folder in JXA
// NOTE: "reveal" mode sets the window's root property to navigate in-place

ObjC.import("Foundation");

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

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

const uuid = getArg(4, null);
const target = getArg(5, "self");
const mode = getArg(6, "window");

if (!uuid) {
  JSON.stringify({
    success: false,
    error: "Usage: revealRecord.js <uuid> [self|parent] [window|tab|reveal]"
  });
} else {
  const app = Application("DEVONthink");
  const record = app.getRecordWithUuid(extractUuid(uuid));

  if (!record) {
    JSON.stringify({ success: false, error: "Record not found: " + uuid });
  } else {
    let targetRecord;
    let targetType;

    if (target === "parent") {
      targetRecord = record.locationGroup();
      targetType = "parent";
      if (!targetRecord) {
        JSON.stringify({ success: false, error: "No parent group found" });
      }
    } else {
      targetRecord = record;
      targetType = "self";
    }

    if (targetRecord) {
      if (mode === "tab") {
        app.openTabFor({ record: targetRecord });
      } else if (mode === "reveal") {
        // Navigate in-place by setting the frontmost window's root
        const windows = app.thinkWindows();
        if (windows.length === 0) {
          // No window open, fall back to opening a new one
          app.openWindowFor({ record: targetRecord });
        } else {
          const frontWindow = windows[0];
          // For groups, set as root directly; for documents, navigate to parent and select
          const recordType = targetRecord.type();
          if (recordType === "group" || recordType === "smart group" || recordType === "tag") {
            frontWindow.root = targetRecord;
          } else {
            // For documents, navigate to parent folder and select the document
            const parentGroup = targetRecord.locationGroup();
            if (parentGroup) {
              frontWindow.root = parentGroup;
            }
            // Select the record in the window
            app.selectedRecords = [targetRecord];
          }
        }
      } else {
        app.openWindowFor({ record: targetRecord });
      }

      JSON.stringify({
        success: true,
        target: targetType,
        mode: mode,
        revealed: {
          name: targetRecord.name(),
          uuid: targetRecord.uuid(),
          location: targetRecord.location(),
          database: targetRecord.database().name(),
          recordType: targetRecord.recordType()
        }
      }, null, 2);
    }
  }
}
