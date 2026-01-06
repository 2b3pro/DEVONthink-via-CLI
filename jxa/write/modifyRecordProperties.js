#!/usr/bin/env osascript -l JavaScript
// Modify properties of a DEVONthink record (rename, tags, move)
// Usage: osascript -l JavaScript modifyRecordProperties.js '<json>'
// JSON format: {"uuid":"...","newName":"...","tagsAdd":[],"tagsRemove":[],"tagsReplace":[],"destGroupUuid":"...","comment":"...","customMetadata":{}}
//
// Dependencies (injected by runner):
// - getArg, isUuid, extractUuid, resolveGroup

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: "Usage: modifyRecordProperties.js '{\"uuid\":\"...\",\"newName\":\"...\"}'"
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