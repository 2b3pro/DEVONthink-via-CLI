#!/usr/bin/env osascript -l JavaScript
// List items in Inbox pending classification
// Usage: osascript -l JavaScript listInbox.js [limit] [folder] [maxChars]
// Examples:
//   osascript -l JavaScript listInbox.js                    # List 50 items, no preview
//   osascript -l JavaScript listInbox.js 20                 # List 20 items, no preview
//   osascript -l JavaScript listInbox.js 20 "_TO BE FILED"  # List 20 from folder
//   osascript -l JavaScript listInbox.js 10 "/" 3000        # List 10 with 3000-char previews

ObjC.import("Foundation");

const limit = parseInt(getArg(4, "50"), 10);
const folderName = getArg(5, "_TO BE FILED");
const maxChars = parseInt(getArg(6, "0"), 10) || 0;
const includePreview = maxChars > 0;

try {
  const app = Application("DEVONthink");

  // Find the Inbox database
  const databases = app.databases();
  const inbox = databases.find(d => d.name() === "Inbox");
  if (!inbox) throw new Error("Inbox database not found");

  // Find the target folder
  let targetFolder = inbox.root();
  if (folderName && folderName !== "/") {
    const children = inbox.root().children();
    const folder = children.find(c => c.name() === folderName);
    if (folder) {
      targetFolder = folder;
    }
  }

  // Get all children, filter to documents only (not groups)
  const children = targetFolder.children();
  const documents = children.filter(c => {
    const type = c.recordType();
    return type !== "group" && type !== "smart group";
  });

  // Sort by addition date (newest first) and limit
  const sorted = documents.sort((a, b) => {
    const dateA = a.additionDate() ? a.additionDate().getTime() : 0;
    const dateB = b.additionDate() ? b.additionDate().getTime() : 0;
    return dateB - dateA;
  });

  const limited = sorted.slice(0, limit);

  const items = [];
  const needsOCR = [];

  for (const c of limited) {
    const uuid = c.uuid();
    const name = c.name();
    const recordType = c.recordType();
    const path = c.path();
    const additionDate = c.additionDate() ? c.additionDate().toString() : null;
    const size = c.size();

    const item = {
      uuid: uuid,
      name: name,
      recordType: recordType,
      path: path,
      additionDate: additionDate,
      size: size
    };

    if (includePreview) {
      const plainText = c.plainText() || "";
      const totalLength = plainText.length;
      const tags = c.tags();

      // Check if OCR is needed
      if (totalLength === 0 && mightNeedOCR(recordType)) {
        item.preview = "";
        item.totalLength = 0;
        item.needsOCR = true;
        item.tags = tags;
        needsOCR.push({ uuid: uuid, name: name, recordType: recordType, path: path });
      } else {
        const truncated = totalLength > maxChars;
        item.preview = truncated ? plainText.substring(0, maxChars) : plainText;
        item.totalLength = totalLength;
        item.truncated = truncated;
        item.needsOCR = false;
        item.tags = tags;
      }
    } else {
      item.hasContent = c.plainText() && c.plainText().length > 0;
    }

    items.push(item);
  }

  const result = {
    success: true,
    folder: targetFolder.name(),
    database: "Inbox",
    totalCount: documents.length,
    returned: items.length,
    items: items
  };

  if (includePreview) {
    result.maxChars = maxChars;
    result.needsOCRCount = needsOCR.length;
    result.needsOCR = needsOCR;
  }

  JSON.stringify(result, null, 2);

} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
