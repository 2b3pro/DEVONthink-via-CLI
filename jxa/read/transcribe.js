#!/usr/bin/env osascript -l JavaScript
// Transcribe speech, text or notes from a DEVONthink record
// Usage: osascript -l JavaScript transcribe.js '<json>'
// JSON format: {"uuid":"...","language":"en","timestamps":true,"aiCleanup":false,"aiPrompt":"...","save":false,"database":"...","groupPath":"...","docName":"...","updateRecord":false}
// Required: uuid
// Optional: language (ISO code like 'en', 'de'), timestamps (boolean), aiCleanup (boolean), aiPrompt (string)
// Save options: save (boolean), database (name/UUID), groupPath (path/UUID), docName (string)
// Update options: updateRecord (boolean) - saves transcription to original record's plain text (makes it searchable)
//
// Supported record types: audio, video with audio track, PDF, image
//
// Examples:
//   osascript -l JavaScript transcribe.js '{"uuid":"ABC123-DEF456"}'
//   osascript -l JavaScript transcribe.js '{"uuid":"ABC123","language":"en"}'
//   osascript -l JavaScript transcribe.js '{"uuid":"ABC123","language":"de","timestamps":true}'
//   osascript -l JavaScript transcribe.js '{"uuid":"ABC123","aiCleanup":true}'
//   osascript -l JavaScript transcribe.js '{"uuid":"ABC123","aiCleanup":true,"aiPrompt":"Format as bullet points"}'
//   osascript -l JavaScript transcribe.js '{"uuid":"ABC123","updateRecord":true}'

ObjC.import("Foundation");

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

// Detect if string looks like a UUID (alphanumeric with hyphens, no slashes)
function isUuid(str) {
  if (!str || typeof str !== "string" || str.includes("/")) return false;
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
    const record = theApp.getRecordWithUuid(ref);
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
    const group = theApp.getRecordWithUuid(ref);
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
    error: 'Usage: transcribe.js \'{"uuid":"..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { uuid: rawUuid, language, timestamps, aiCleanup, aiPrompt, includeRaw, save, database, groupPath, docName, tags, updateRecord } = params;

    if (!rawUuid) throw new Error("Missing required field: uuid");

    const uuid = extractUuid(rawUuid);
    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(uuid);

    if (!record) throw new Error("Record not found: " + uuid);

    // Build transcription options - 'record' is a named parameter, not part of method name
    const transcribeOptions = { record: record };

    if (language && language.length > 0) {
      transcribeOptions.language = language;
    }

    // timestamps defaults to true unless explicitly set to false
    if (timestamps === false) {
      transcribeOptions.timestamps = false;
    } else if (timestamps === true) {
      transcribeOptions.timestamps = true;
    }

    // Perform transcription: transcribe record <record> [language "xx"] [with/without timestamps]
    const transcription = app.transcribe(transcribeOptions);

    if (!transcription) {
      JSON.stringify({
        success: false,
        uuid: uuid,
        name: record.name(),
        error: "Transcription failed or returned no content"
      }, null, 2);
    } else {
      // Optionally clean up transcription using AI
      let finalTranscription = transcription;
      let aiResponse = null;

      if (aiCleanup === true) {
        const prompt = aiPrompt || "Clean up this transcription. Fix grammar, punctuation, and formatting while preserving the original meaning. Remove filler words and false starts.";
        const fullPrompt = prompt + "\n\n" + transcription;

        // Use DEVONthink's AI chat: getChatResponseForMessage(prompt, {record: record})
        aiResponse = app.getChatResponseForMessage(fullPrompt, { record: record });

        if (aiResponse && aiResponse.length > 0) {
          finalTranscription = aiResponse;
        }
      }

      const result = {
        success: true,
        uuid: uuid,
        name: record.name(),
        recordType: record.recordType(),
        language: language || "default",
        timestamps: timestamps !== undefined ? timestamps : "default",
        transcription: finalTranscription
      };

      // Include raw transcription if AI cleanup was used (unless includeRaw is false)
      if (aiCleanup === true) {
        result.aiCleanup = true;
        result.aiPrompt = aiPrompt || "default";
        if (includeRaw !== false) {
          result.rawTranscription = transcription;
        }
      }

      // Optionally save transcription as a markdown document
      if (save === true) {
        const sourceDb = record.database();
        let targetDb;
        let targetGroup;

        // Determine destination group and database
        if (groupPath) {
          const groupUuid = extractUuid(groupPath);
          if (isUuid(groupUuid)) {
            // Group UUID provided - get database from the group itself
            targetGroup = app.getRecordWithUuid(groupUuid);
            if (!targetGroup) throw new Error("Group not found with UUID: " + groupUuid);
            const groupType = targetGroup.recordType();
            if (groupType !== "group" && groupType !== "smart group") {
              throw new Error("UUID does not point to a group: " + groupType);
            }
            targetDb = targetGroup.database();
          } else {
            // Group path provided - need database context
            targetDb = database ? getDatabase(app, database) : sourceDb;
            targetGroup = resolveGroup(app, groupPath, targetDb);
          }
        } else {
          // No group specified - use source record's parent
          targetDb = database ? getDatabase(app, database) : sourceDb;
          const parents = record.parents();
          targetGroup = parents && parents.length > 0 ? parents[0] : targetDb.root();
        }

        // Determine document name (default to "Original Name - Transcription")
        const targetName = docName || (record.name() + " - Transcription");

        // Create markdown document with transcription
        const createProps = {
          name: targetName,
          type: "markdown",
          content: finalTranscription
        };

        const savedRecord = app.createRecordWith(createProps, { in: targetGroup });

        if (!savedRecord) throw new Error("Failed to save transcription document");

        // Apply tags if specified
        if (tags && Array.isArray(tags) && tags.length > 0) {
          savedRecord.tags = tags;
        }

        // Add saved document info to result
        result.saved = {
          uuid: savedRecord.uuid(),
          name: savedRecord.name(),
          location: savedRecord.location(),
          database: targetDb.name()
        };
      }

      // Optionally update the original record's plain text (makes it searchable)
      if (updateRecord === true) {
        record.plainText = finalTranscription;
        result.updatedRecord = {
          uuid: uuid,
          name: record.name(),
          plainTextUpdated: true
        };
      }

      JSON.stringify(result, null, 2);
    }

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
