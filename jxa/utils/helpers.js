// DEVONthink JXA Helper Functions
// Include these at the top of any script that needs record lookup

/**
 * Extract UUID from x-devonthink-item:// URL or return raw UUID
 * @param {string} str - String that may be a UUID or x-devonthink-item:// URL
 * @returns {string|null} - Extracted UUID or null if invalid
 */
function extractUuid(str) {
  if (!str) return null;
  // Check for x-devonthink-item:// URL
  const urlMatch = str.match(/^x-devonthink-item:\/\/([A-F0-9-]+)$/i);
  if (urlMatch) return urlMatch[1];
  // Return as-is if it looks like a UUID
  if (!str.includes("/") && /^[A-F0-9-]{8,}$/i.test(str) && str.includes("-")) {
    return str;
  }
  return str; // Return as-is, let DEVONthink handle validation
}

/**
 * Detect if a string looks like a DEVONthink UUID or item URL
 * UUIDs are alphanumeric with hyphens, no slashes
 */
function isUuid(str) {
  if (!str || typeof str !== "string") return false;
  // Handle x-devonthink-item:// URLs
  if (str.startsWith("x-devonthink-item://")) return true;
  if (str.includes("/")) return false;
  // DEVONthink UUIDs: alphanumeric with hyphens
  return /^[A-F0-9-]{8,}$/i.test(str) && str.includes("-");
}

function lookupByUuid(theApp, uuid) {
  if (!uuid) return null;
  try {
    // Extract UUID from x-devonthink-item:// URL if present
    const cleanUuid = extractUuid(uuid);
    return theApp.getRecordWithUuid(cleanUuid);
  } catch (e) {
    return null;
  }
}

function lookupById(theApp, id) {
  if (!id || typeof id !== "number") return null;
  try {
    return theApp.getRecordWithId(id);
  } catch (e) {
    return null;
  }
}

function lookupByPath(theApp, path, database) {
  if (!path) return null;
  try {
    const pathComponents = path.split("/").filter(p => p.length > 0);
    if (!database) return null;
    if (pathComponents.length === 0) return database.root();

    let current = database.root();
    for (const component of pathComponents) {
      const children = current.children();
      const found = children.find(c => c.name() === component);
      if (!found) return null;
      current = found;
    }
    return current;
  } catch (e) {
    return null;
  }
}

function lookupByName(theApp, name, database) {
  if (!name || !database) return null;
  try {
    const searchResults = theApp.search(name, { in: database });
    if (!searchResults || searchResults.length === 0) return null;
    const matches = searchResults.filter(r => r.name() === name);
    return matches.length > 0 ? matches[0] : null;
  } catch (e) {
    return null;
  }
}

function getRecord(theApp, options) {
  if (!options) return { record: null, error: "No options provided" };

  let record = null;
  let error = null;

  // Try UUID first (most reliable)
  if (options.uuid) {
    record = lookupByUuid(theApp, options.uuid);
    if (record) return { record: record, method: "uuid" };
    error = "UUID not found: " + options.uuid;
  }

  // Try ID next
  if (options.id) {
    record = lookupById(theApp, options.id);
    if (record) return { record: record, method: "id" };
    if (!error) error = "ID not found: " + options.id;
  }

  // Try path
  if (options.path) {
    record = lookupByPath(theApp, options.path, options.database);
    if (record) return { record: record, method: "path" };
    if (!error) error = "Path not found: " + options.path;
  }

  // Try name search as fallback
  if (options.name && options.database) {
    record = lookupByName(theApp, options.name, options.database);
    if (record) return { record: record, method: "name" };
    if (!error) error = "Name not found: " + options.name;
  }

  return { record: null, error: error || "No valid lookup parameters" };
}

/**
 * Get database by name or UUID (auto-detected)
 */
function getDatabase(theApp, ref) {
  if (!ref) return theApp.currentDatabase();

  // Try UUID first if it looks like one
  if (isUuid(ref)) {
    const record = lookupByUuid(theApp, ref);
    if (record) return record.database();
    throw new Error("Database not found with UUID: " + ref);
  }

  // Otherwise lookup by name
  const databases = theApp.databases();
  const found = databases.find(db => db.name() === ref);
  if (!found) throw new Error("Database not found: " + ref);
  return found;
}

/**
 * Resolve a group by path or UUID (auto-detected)
 * @param {Application} theApp - DEVONthink app
 * @param {string} ref - Group path or UUID
 * @param {Database} database - Database to search in (for paths)
 * @param {boolean} createIfMissing - Create missing path components
 * @returns {Record} - The resolved group record
 */
function resolveGroup(theApp, ref, database, createIfMissing) {
  if (!ref || ref === "/") {
    return database.root();
  }

  // Try UUID first if it looks like one
  if (isUuid(ref)) {
    const group = lookupByUuid(theApp, ref);
    if (!group) throw new Error("Group not found with UUID: " + ref);
    if (!isGroup(group)) throw new Error("UUID does not point to a group");
    return group;
  }

  // Navigate path
  let current = database.root();
  const parts = ref.split("/").filter(p => p.length > 0);

  for (const part of parts) {
    const children = current.children();
    const found = children.find(c => c.name() === part);
    if (!found) {
      if (createIfMissing) {
        const newGroup = theApp.createRecordWith({ name: part, type: "group" }, { in: current });
        current = newGroup;
      } else {
        throw new Error("Group not found: " + part);
      }
    } else {
      current = found;
    }
  }

  return current;
}

function isGroup(record) {
  if (!record) return false;
  const type = record.recordType();
  return type === "group" || type === "smart group";
}
