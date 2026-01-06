#!/usr/bin/env osascript -l JavaScript
// Link or Unlink DEVONthink records
// Usage: osascript -l JavaScript linkRecords.js '<json>'
// JSON format: 
// { 
//   "sourceUuid": "...", 
//   "targetUuid": "...", 
//   "mode": "link" | "unlink",
//   "wiki": true|false,
//   "seeAlso": true|false,
//   "classification": true|false,
//   "search": true|false,
//   "chat": true|false
// }

ObjC.import("Foundation");

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

function isUuid(str) {
  if (!str || typeof str !== "string") return false;
  if (str.startsWith("x-devonthink-item://")) return true;
  if (str.includes("/")) return false;
  return /^[A-F0-9-]{8,}$/i.test(str) && str.includes("-");
}

function extractUuid(str) {
  if (!str) return null;
  const urlMatch = str.match(/^x-devonthink-item:\/\/([A-F0-9-]+)$/i);
  if (urlMatch) return urlMatch[1];
  if (isUuid(str)) return str;
  return str;
}

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({ success: false, error: "Missing arguments" });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const mode = params.mode || "link";
    const sourceUuid = extractUuid(params.sourceUuid);
    const targetUuid = extractUuid(params.targetUuid);

    if (!sourceUuid) throw new Error("Missing source UUID");

    const app = Application("DEVONthink");
    const source = app.getRecordWithUuid(sourceUuid);
    if (!source) throw new Error("Source record not found: " + sourceUuid);

    const result = { success: true, uuid: sourceUuid, mode: mode };

    // 1. Manage Exclusion Flags
    // If targetUuid is NOT provided, we are toggling flags on the source record
    // If targetUuid IS provided, we might still toggle flags if specified
    
    // Helper to set boolean flags (inverting them because the properties are "exclude from...")
    const setExclusion = (prop, value) => {
        if (value !== undefined && value !== null) {
            // value true means "Enable" (set exclude to false)
            // value false means "Disable" (set exclude to true)
            source[prop] = !value;
            result[prop] = !value;
        }
    };

    if (params.wiki !== undefined) setExclusion("excludeFromWikiLinking", params.wiki);
    if (params.seeAlso !== undefined) setExclusion("excludeFromSeeAlso", params.seeAlso);
    if (params.classification !== undefined) setExclusion("excludeFromClassification", params.classification);
    if (params.search !== undefined) setExclusion("excludeFromSearch", params.search);
    if (params.chat !== undefined) setExclusion("excludeFromChat", params.chat);

    // Default behavior for link/unlink if no specific flags provided and no target
    if (!targetUuid && params.wiki === undefined && params.seeAlso === undefined) {
        const flagValue = (mode === "link"); // link -> enable (exclude=false), unlink -> disable (exclude=true)
        source.excludeFromWikiLinking = !flagValue;
        source.excludeFromSeeAlso = !flagValue;
        result.excludeFromWikiLinking = !flagValue;
        result.excludeFromSeeAlso = !flagValue;
    }

    // 2. Manage Text Links
    if (targetUuid) {
        const target = app.getRecordWithUuid(targetUuid);
        if (!target) throw new Error("Target record not found: " + targetUuid);

        const targetUrl = "x-devonthink-item://" + targetUuid;
        const targetName = target.name();
        const linkMarkdown = `[${targetName}](${targetUrl})`;
        
        const type = source.recordType();
        const canHaveText = ["markdown", "rtf", "rich text", "text", "plain text"].includes(type.toLowerCase());

        if (canHaveText) {
            let text = source.plainText();
            if (mode === "link") {
                // Check if link already exists
                if (!text.includes(targetUrl)) {
                    source.plainText = text + "\n\n" + linkMarkdown;
                    result.linkAdded = true;
                } else {
                    result.linkAdded = false;
                    result.message = "Link already exists";
                }
            } else {
                // Unlink: remove lines containing the link
                const lines = text.split("\n");
                const newLines = lines.filter(line => !line.includes(targetUrl));
                if (lines.length !== newLines.length) {
                    source.plainText = newLines.join("\n");
                    result.linkRemoved = true;
                } else {
                    result.linkRemoved = false;
                    result.message = "Link not found in text";
                }
            }
        } else {
            result.warning = "Source record type does not support text links: " + type;
        }
        result.targetUuid = targetUuid;
    }

    JSON.stringify(result, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
