#!/usr/bin/env osascript -l JavaScript
// Verify existence of DEVONthink resources (Records, Paths, Databases)
// Usage: osascript -l JavaScript verifyResources.js 'JSON'
// Input JSON: { 
//   "uuids": ["uuid1", ...], 
//   "paths": [{"database": "dbName", "path": "/path/to/group"}, ...],
//   "databases": ["dbName1", ...] 
// }

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({ success: false, error: "Usage: verifyResources.js JSON" });
} else {
  try {
    const request = JSON.parse(jsonArg);
    const app = Application("DEVONthink");
    
    const results = {
      uuids: {},
      paths: {},
      databases: {}
    };

    // 1. Verify Databases
    if (request.databases) {
      const allDbs = app.databases();
      const dbNames = allDbs.map(d => d.name());
      const dbUuids = allDbs.map(d => d.uuid());
      
      request.databases.forEach(dbRef => {
        // Case-insensitive match? DEVONthink names usually unique.
        // Simple check first
        const exists = dbNames.includes(dbRef) || dbUuids.includes(dbRef);
        results.databases[dbRef] = exists;
      });
    }

    // 2. Verify UUIDs
    if (request.uuids) {
      request.uuids.forEach(uuid => {
        // Only verify if strictly looks like UUID to avoid junk
        if (!uuid) return;
        const cleanUuid = extractUuid(uuid);
        const record = app.getRecordWithUuid(cleanUuid);
        results.uuids[uuid] = !!record;
      });
    }

    // 3. Verify Paths
    if (request.paths) {
      request.paths.forEach(item => {
        const { database, path } = item;
        const key = `${database}::${path}`;
        
        try {
          // Resolve Database
          let db;
          if (database) {
             if (isUuid(database)) {
               const r = app.getRecordWithUuid(extractUuid(database));
               db = r ? r.database() : null;
             } else {
               db = app.databases.byName(database);
             }
          } else {
             db = app.currentDatabase();
          }

          if (!db) {
            results.paths[key] = { exists: false, error: "Database not found" };
            return;
          }

          // Resolve Group
          // Manual path navigation to avoid throwing error immediately
          let current = db.root();
          const parts = path.split('/').filter(p => p.length > 0);
          let valid = true;
          
          for (const part of parts) {
            const child = current.children.byName(part);
            // byName returns object specifier, verify existence
            // In JXA, checking .name() or .id() triggers the fetch
            try {
               // Optimization: use whose?
               // found = current.children.whose({name: part})[0]
               // But standard array find is often safer if list small.
               // Let's use `byName(part)` which works if unique. 
               // If missing, JXA throws on access or returns null?
               // byName returns reference. Accessing property checks it.
               if (!child.exists()) {
                 valid = false;
                 break;
               }
               current = child;
            } catch (e) {
               valid = false; 
               break;
            }
          }
          
          results.paths[key] = { exists: valid };

        } catch (e) {
          results.paths[key] = { exists: false, error: e.message };
        }
      });
    }

    JSON.stringify({ success: true, results: results });

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
