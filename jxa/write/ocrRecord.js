#!/usr/bin/env osascript -l JavaScript
// Perform OCR on a DEVONthink record
// Usage: osascript -l JavaScript ocrRecord.js '<json>'
// JSON format: {"uuid":"...", "type":"pdf|rtf|word|...", "to":"destination-group-uuid"}
// Required: uuid
// Optional: to (default: same group), type (default: pdf)
//
// Returns: { success: true, uuid: "new-uuid", ... }

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({ success: false, error: "Missing arguments" });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const uuid = extractUuid(params.uuid);
    
    if (!uuid) throw new Error("Missing UUID");

    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(uuid);

    if (!record) throw new Error("Record not found: " + uuid);

    // Options for OCR
    // type: "PDF document", "RTF", "Word document", "webarchive", "paginated PDF", "text"
    // We map simple names to AppleScript types
    const typeMap = {
        "pdf": "PDF document",
        "pdf-paginated": "paginated PDF",
        "rtf": "RTF",
        "word": "Word document",
        "webarchive": "webarchive",
        "text": "text"
    };
    
    const ocrType = typeMap[params.type || "pdf"] || "PDF document";
    
    // OCR command: ocr file ... or ocr record ...
    // JXA: app.ocr({ file: ..., ... }) or app.ocr({ record: ..., ... })
    // The dictionary says "ocr file/record"
    
    const options = {
        record: record,
        type: ocrType
    };
    
    // If destination is specified
    if (params.to) {
        const dest = app.getRecordWithUuid(extractUuid(params.to));
        if (dest) options["in"] = dest;
    } else {
        // Default to same location? 
        // Usually OCR creates a new record. If we don't specify 'in', it might go to Inbox or same group.
        // Let's specify the current group to be safe, unless we want to replace?
        // Actually, let's leave it to DT default, which is usually 'same group'.
        options["in"] = record.parent();
    }
    
    // Perform OCR
    const result = app.ocr(options);
    
    if (!result) {
        throw new Error("OCR failed (returned null)");
    }
    
    JSON.stringify({
      success: true,
      originalUuid: uuid,
      newUuid: result.uuid(),
      name: result.name(),
      type: result.recordType(),
      wordCount: result.wordCount()
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
