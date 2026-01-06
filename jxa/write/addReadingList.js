#!/usr/bin/env osascript -l JavaScript
// Add a record or URL to DEVONthink's reading list
// Usage: osascript -l JavaScript addReadingList.js '<json>'
// JSON format: {"uuid":"...","url":"...","title":"..."}
// Required: either uuid OR url
// Optional: title (for URL mode)
//
// Examples:
//   osascript -l JavaScript addReadingList.js '{"uuid":"ABC123-DEF456"}'
//   osascript -l JavaScript addReadingList.js '{"url":"https://example.com/article"}'
//   osascript -l JavaScript addReadingList.js '{"url":"https://example.com/article","title":"Great Article"}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: addReadingList.js \'{"uuid":"..."}\' or \'{"url":"...","title":"..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { uuid, url, title } = params;

    if (!uuid && !url) {
      throw new Error("Missing required field: either uuid or url must be provided");
    }

    const app = Application("DEVONthink");
    let success = false;
    const result = {
      success: false
    };

    if (uuid) {
      // Add record to reading list
      const record = app.getRecordWithUuid(extractUuid(uuid));
      if (!record) {
        throw new Error("Record not found: " + uuid);
      }

      success = app.addReadingList({ record: record });
      result.uuid = uuid;
      result.name = record.name();
      result.mode = "record";
    } else {
      // Add URL to reading list
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        throw new Error("Invalid URL: must start with http:// or https://");
      }

      const options = { URL: url };
      if (title && title.length > 0) {
        options.title = title;
      }

      success = app.addReadingList(options);
      result.url = url;
      result.title = title || null;
      result.mode = "url";
    }

    result.success = success;
    JSON.stringify(result, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
