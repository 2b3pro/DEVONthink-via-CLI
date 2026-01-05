#!/usr/bin/env osascript -l JavaScript
// Resolve or create a group by database (name or UUID) and path
// Usage: osascript -l JavaScript resolveOrCreateGroup.js '<json>'
// JSON format: {"database":"...", "path":"/path/to/group"}
// database can be name or UUID (auto-detected)
//
// Returns: {"success":true, "uuid":"...", "created":true/false, "path":"..."}
//
// Examples:
//   osascript -l JavaScript resolveOrCreateGroup.js '{"database":"Hypnosis NLP","path":"/Authors A—Z/L/LAST, First"}'
//   osascript -l JavaScript resolveOrCreateGroup.js '{"database":"A1B2-C3D4-...","path":"/Topics A—Z/A/AI Research"}'

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

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: resolveOrCreateGroup.js \'{"database":"...","path":"..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { database, path } = params;

    if (!database) throw new Error("Missing required field: database");
    if (!path) throw new Error("Missing required field: path");

    const app = Application("DEVONthink");

    // Find the database by name or UUID
    const targetDb = getDatabase(app, database);

    // Parse the path into components
    const pathParts = path.split("/").filter(p => p.length > 0);

    if (pathParts.length === 0) {
      // Return the database root
      const root = targetDb.root();
      JSON.stringify({
        success: true,
        uuid: root.uuid(),
        name: root.name(),
        path: "/",
        created: false
      });
    } else {
      // Navigate/create path
      let currentGroup = targetDb.root();
      let created = false;
      const createdParts = [];

      // Helper: normalize string for comparison
      function normalize(str) {
        return str.toUpperCase().trim().replace(/\s+/g, ' ');
      }

      // Helper: extract lastname from "LASTNAME, Firstname" format
      function getLastname(str) {
        const comma = str.indexOf(',');
        return comma > 0 ? str.substring(0, comma).trim().toUpperCase() : str.trim().toUpperCase();
      }

      // Helper: check if name looks like an author (contains comma)
      function isAuthorName(str) {
        return str.includes(',');
      }

      // Helper: get first word for topic matching
      function getFirstWord(str) {
        return str.split(/[\s,\-&]+/)[0].toUpperCase();
      }

      // Helper: find matching group with fuzzy logic
      // Prefers regular groups over smart groups (can't file into smart groups)
      function findMatchingGroup(children, targetName, isLeaf) {
        const targetNorm = normalize(targetName);
        const targetLastname = getLastname(targetName);
        const targetFirstWord = getFirstWord(targetName);
        const targetIsAuthor = isAuthorName(targetName);

        // Track matches separately for groups vs smart groups
        let exactGroup = null;
        let exactSmart = null;
        let caseGroup = null;
        let caseSmart = null;
        let lastnameGroup = null;
        let lastnameSmart = null;
        let firstWordGroup = null;
        let firstWordSmart = null;

        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const childType = child.recordType();
          const isGroup = (childType === "group");
          const isSmart = (childType === "smart group");
          if (!isGroup && !isSmart) continue;

          const childName = child.name();
          const childNorm = normalize(childName);

          // Exact match
          if (childName === targetName) {
            if (isGroup) { exactGroup = child; break; }
            else if (!exactSmart) { exactSmart = child; }
            continue;
          }

          // Case-insensitive match
          if (childNorm === targetNorm) {
            if (isGroup && !caseGroup) { caseGroup = child; }
            else if (isSmart && !caseSmart) { caseSmart = child; }
            continue;
          }

          // For leaf nodes, apply fuzzy matching
          if (isLeaf) {
            if (targetIsAuthor) {
              // Author matching: same lastname
              const childLastname = getLastname(childName);
              if (childLastname === targetLastname) {
                if (isGroup && !lastnameGroup) { lastnameGroup = child; }
                else if (isSmart && !lastnameSmart) { lastnameSmart = child; }
              }
            } else {
              // Topic matching: same first word
              const childFirstWord = getFirstWord(childName);
              if (childFirstWord === targetFirstWord && childFirstWord.length > 2) {
                if (isGroup && !firstWordGroup) { firstWordGroup = child; }
                else if (isSmart && !firstWordSmart) { firstWordSmart = child; }
              }
            }
          }
        }

        // Prefer regular groups over smart groups at each match level
        return exactGroup || exactSmart ||
               caseGroup || caseSmart ||
               lastnameGroup || lastnameSmart ||
               firstWordGroup || firstWordSmart ||
               null;
      }

      for (let partIdx = 0; partIdx < pathParts.length; partIdx++) {
        const part = pathParts[partIdx];
        const isLeaf = (partIdx === pathParts.length - 1);

        // Look for existing group with fuzzy matching
        const children = currentGroup.children();
        const found = findMatchingGroup(children, part, isLeaf);

        if (found) {
          currentGroup = found;
          // Track if we used a fuzzy match (name differs from requested)
          if (found.name() !== part) {
            createdParts.push(`(matched: ${found.name()})`);
          }
        } else {
          // Create the group
          const newGroup = app.createRecordWith({
            name: part,
            type: "group"
          }, { in: currentGroup });

          currentGroup = newGroup;
          created = true;
          createdParts.push(part);
        }
      }

      JSON.stringify({
        success: true,
        uuid: currentGroup.uuid(),
        name: currentGroup.name(),
        path: "/" + pathParts.join("/"),
        databaseName: database,
        created: created,
        createdParts: createdParts.length > 0 ? createdParts : undefined
      }, null, 2);
    }

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
