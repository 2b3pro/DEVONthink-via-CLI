import { runJxa } from '../src/jxa-runner.js';

async function testResources() {
  console.log("=== Testing Resource Layer Backend ===");

  // 1. List Databases
  console.log("\n1. Listing Databases...");
  const dbs = await runJxa("read", "listDatabases", []);
  if (!dbs.success && Array.isArray(dbs)) { 
      // runJxa returns parsed JSON directly, but wrapper returns {success, error} on failure
      // or the array if success?
      // Wait, listDatabases.js returns raw JSON array.
      // runJxa returns parsed object/array.
      // My listDatabases.js returns JSON array.
      // So dbs is the array.
  }
  
  // Actually runJxa returns whatever JSON.parse returns.
  // But if script fails, runJxa returns {success:false...}.
  
  let targetDbName = "Test_Database";
  let targetDb = null;

  if (Array.isArray(dbs)) {
    console.log(`Found ${dbs.length} databases.`);
    targetDb = dbs.find(d => d.name === targetDbName);
  } else {
    console.log("Error listing databases:", dbs);
    return;
  }

  if (!targetDb) {
    console.error(`Database '${targetDbName}' not found!`);
    return;
  }

  console.log(`Target Database Found: ${targetDb.name} (${targetDb.uuid})`);

  // 2. List Smart Groups
  console.log(`\n2. Listing Smart Groups in '${targetDbName}'...`);
  const smartGroups = await runJxa("read", "listSmartGroups", [targetDbName]);
  
  if (smartGroups.success) {
      console.log(`Found ${smartGroups.count} smart groups.`);
      if (smartGroups.count > 0) {
          const firstSg = smartGroups.smartGroups[0];
          console.log(`Testing with first Smart Group: ${firstSg.name} (${firstSg.uuid})`);
          
          // 3. Read Smart Group Contents
          console.log(`\n3. Reading contents of '${firstSg.name}'...`);
          // Note: using JSON mode for listGroupContents
          const contents = await runJxa("read", "listGroupContents", [JSON.stringify({ groupRef: firstSg.uuid })]);
          
          if (contents.success) {
              console.log(`Success! Found ${contents.itemCount} items.`);
              if (contents.itemCount > 0) {
                  console.log("First item:", contents.items[0].name);
              }
          } else {
              console.error("Failed to read contents:", contents);
          }
      } else {
          console.log("No smart groups to test content reading.");
      }
  } else {
      console.error("Failed to list smart groups:", smartGroups);
  }
}

testResources();
