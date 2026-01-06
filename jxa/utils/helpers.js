// DEVONthink JXA Shared Helper Functions
// This file is prepended to scripts by the JXA runner.

/**
 * Get command line argument safely
 * Handles both shebang usage (args start at 4) and osascript -e usage (args start after --)
 * @param {number} index - The absolute index expected by legacy scripts (4 = first user arg)
 * @param {any} defaultValue - Default value if missing
 * @returns {string|any} - The argument value
 */
function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  
  // Look for "--" separator used by runJxa
  let separatorIndex = -1;
  for (let i = 0; i < args.count; i++) {
    if (ObjC.unwrap(args.objectAtIndex(i)) === "--") {
      separatorIndex = i;
      break;
    }
  }

  let realIndex = index;
  if (separatorIndex !== -1) {
    // Adjust index relative to "--"
    // The caller expects 4 to be the first argument.
    // In -e mode, (separatorIndex + 1) is the first argument.
    // So we map: 4 -> separatorIndex + 1
    //            5 -> separatorIndex + 2
    //            i -> separatorIndex + 1 + (i - 4)
    realIndex = separatorIndex + 1 + (index - 4);
  }

  if (args.count <= realIndex) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(realIndex));
  return arg && arg.length > 0 ? arg : defaultValue;
}

/**
 * Detect if string looks like a UUID or x-devonthink-item:// URL
 */
function isUuid(str) {
  if (!str || typeof str !== "string") return false;
  if (str.startsWith("x-devonthink-item://")) return true;
  if (str.includes("/")) return false;
  return /^[A-F0-9-]{8,}$/i.test(str) && str.includes("-");
}

/**
 * Extract UUID from x-devonthink-item:// URL or return raw UUID
 * Handles optional query parameters in URL.
 */
function extractUuid(str) {
  if (!str) return null;
  const urlMatch = str.match(/^x-devonthink-item:\/\/([A-F0-9-]+)(?:\?.*)?$/i);
  if (urlMatch) return urlMatch[1];
  if (isUuid(str)) return str;
  return str;
}

/**
 * Get database by name or UUID
 */
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

/**
 * Resolve group by path or UUID
 */
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