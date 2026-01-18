/**
 * OCR Command
 * Perform OCR on files or DEVONthink records
 * @version 1.0.0
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, basename, dirname, extname } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { isUuid, extractUuid, escapeString, jxaResolveDatabaseAndGroup } from '../utils.js';

const execFileAsync = promisify(execFile);

export function registerOcrCommand(program) {
  program
    .command('ocr <source>')
    .description('OCR a file or DEVONthink record. With --output, saves locally without keeping in DEVONthink.')
    .option('-d, --database <nameOrUuid>', 'Target database (for import mode)')
    .option('-g, --to <pathOrUuid>', 'Destination group (path or UUID)', '/')
    .option('-o, --output <path>', 'Save OCR result to local path (does not keep in DEVONthink)')
    .option('--text', 'Extract plain text from OCR and save as .txt (use with --output)')
    .option('-n, --as <name>', 'Custom name for output')
    .option('-t, --tag <tag>', 'Add tag (can be used multiple times)', collectTags, [])
    .option('--comment <text>', 'Set comment on record')
    .option('--type <type>', 'OCR output type (pdf, rtf, text, html, markdown, docx). Inferred from --output extension if not specified')
    .option('--background', 'Run OCR in background (do not wait for completion)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID or path')
    .addHelpText('after', `
Source:
  Can be a local file path or a DEVONthink record UUID.

Output Modes:
  Import mode (default): OCRs and imports into DEVONthink
    dt ocr scan.pdf -d "Archive" -g "/Documents"

  Local mode (--output): OCRs and saves locally, does not keep in DEVONthink
    dt ocr scan.pdf --output ./scanned-ocr.pdf

    With --output, the file is temporarily imported to DEVONthink for OCR,
    then exported and deleted. Use -d to control which database is used
    for temp storage (defaults to Inbox). Use -g to specify a subfolder.

  Text extraction (--text): Extract plain text from OCR
    dt ocr scan.pdf --output ./extracted.txt --text  # Save to file
    dt ocr scan.pdf --text                           # Output to stdout

OCR Types:
  pdf (default), rtf, text, html, markdown, docx

  With --output, type is inferred from extension:
    .pdf → pdf, .rtf → rtf, .txt → text, .html → html, .md → markdown, .docx → docx
  Use --type to override: dt ocr scan.jpg --output notes.txt --type markdown

JSON Output (import mode):
  {
    "success": true,
    "uuid": "string",
    "name": "string",
    "location": "string"
  }

JSON Output (local mode):
  {
    "success": true,
    "outputPath": "string",
    "originalFile": "string",
    "tempDatabase": "string"
  }

Examples:
  # OCR and import to DEVONthink
  dt ocr "/path/to/scan.pdf" -d "Archive"

  # OCR and save locally (not kept in DEVONthink)
  dt ocr "/path/to/scan.pdf" --output "/path/to/output.pdf"

  # OCR to local file, using specific database for temp storage
  dt ocr scan.pdf --output ./out.pdf -d "IAS personal" -g "Downloads"

  # OCR existing DEVONthink record and save locally
  dt ocr ABC123-DEF456 --output ./output.pdf

  # OCR to markdown (inferred from .md extension)
  dt ocr scan.jpg --output ./result.md

  # OCR with explicit type override
  dt ocr scan.jpg --output ./notes.txt --type markdown

  # OCR and extract plain text to file
  dt ocr scan.pdf --output ./extracted.txt --text

  # OCR and output plain text to stdout (for piping)
  dt ocr scan.pdf --text | grep "keyword"
`)
    .action(async (source, options) => {
      try {
        await requireDevonthink();

        const isLocalFile = !isUuid(source);

        if (isLocalFile) {
          // Source is a local file
          const filePath = resolve(source);
          if (!existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
          }

          if (options.output) {
            // Local output mode: OCR -> export/text -> delete temp record
            const result = await ocrFileToLocal(filePath, options);
            print(result, options);
            if (!result.success) process.exit(1);
          } else if (options.text) {
            // Text to stdout mode: OCR -> extract text -> output to stdout
            const result = await ocrFileToStdout(filePath, options);
            if (!result.success) {
              print(result, options);
              process.exit(1);
            }
            // Output text to stdout (not JSON)
            process.stdout.write(result.textContent || '');
          } else {
            // Import mode: OCR and keep in DEVONthink
            if (!options.database && !isUuid(options.to)) {
              throw new Error('Database (-d) is required unless destination group (-g) is a UUID');
            }
            const result = await ocrFileToDevonthink(filePath, options);
            print(result, options);
            if (!result.success) process.exit(1);
          }
        } else {
          // Source is a DEVONthink record UUID
          const uuid = extractUuid(source);

          if (options.output) {
            // Local output mode: convert record -> export/text -> delete converted
            const result = await ocrRecordToLocal(uuid, options);
            print(result, options);
            if (!result.success) process.exit(1);
          } else if (options.text) {
            // Text to stdout mode: OCR -> extract text -> output to stdout
            const result = await ocrRecordToStdout(uuid, options);
            if (!result.success) {
              print(result, options);
              process.exit(1);
            }
            // Output text to stdout (not JSON)
            process.stdout.write(result.textContent || '');
          } else {
            // Convert in place (creates new record alongside original)
            const result = await ocrRecordInPlace(uuid, options);
            print(result, options);
            if (!result.success) process.exit(1);
          }
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}

function collectTags(value, previous) {
  return previous.concat([value]);
}

/**
 * Infer OCR type from output file extension
 */
function inferTypeFromExtension(outputPath) {
  if (!outputPath) return null;

  const ext = extname(outputPath).toLowerCase();
  const extMap = {
    '.pdf': 'pdf',
    '.rtf': 'rtf',
    '.txt': 'text',
    '.html': 'html',
    '.htm': 'html',
    '.md': 'markdown',
    '.markdown': 'markdown',
    '.docx': 'docx'
  };

  return extMap[ext] || null;
}

/**
 * Resolve OCR type: explicit --type > inferred from extension > default (pdf)
 */
function resolveOcrType(options) {
  // Explicit --type takes precedence
  if (options.type) {
    return options.type;
  }

  // Infer from --output extension
  if (options.output) {
    const inferred = inferTypeFromExtension(options.output);
    if (inferred) return inferred;
  }

  // Default to pdf
  return 'pdf';
}

/**
 * OCR a local file and save to local path (temp import -> export -> delete)
 */
async function ocrFileToLocal(filePath, options) {
  const outputPath = resolve(options.output);
  const outputDir = dirname(outputPath);

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const ocrType = mapOcrType(resolveOcrType(options));
  const waitForReply = options.background !== true;
  const dbRef = options.database;
  const destRef = options.to;

  // Build JXA to resolve temp destination
  let tempDestCode;

  // Check if destRef is a UUID (can be used without database)
  if (isUuid(destRef)) {
    const groupUuid = extractUuid(destRef);
    tempDestCode = `
  // Get group by UUID (database derived from group)
  var tempDest = app.getRecordWithUuid("${groupUuid}");
  if (!tempDest) throw new Error("Group not found: ${groupUuid}");
  var db = tempDest.database();`;
  } else if (dbRef) {
    const escapedDbRef = escapeString(dbRef);
    const extractedDbUuid = extractUuid(dbRef);

    let destNavCode;
    if (destRef && destRef !== '/') {
      const cleanPath = destRef.replace(/^\//, '');
      const escapedPath = escapeString(cleanPath);
      destNavCode = `
  // Navigate to specified group
  const pathParts = "${escapedPath}".split("/");
  var tempDest = db.root();
  for (const part of pathParts) {
    if (!part) continue;
    const children = tempDest.children.whose({name: part, type: "group"});
    if (children.length === 0) throw new Error("Group not found: " + part);
    tempDest = children[0];
  }`;
    } else {
      destNavCode = `
  // Try Downloads folder, fall back to root
  const downloadGroups = db.root().children.whose({name: "Downloads", type: "group"});
  var tempDest = downloadGroups.length > 0 ? downloadGroups[0] : db.root();`;
    }

    // Use specified database's Downloads folder (or root if no Downloads)
    tempDestCode = `
  // Find specified database
  const dbs = app.databases.whose({name: "${escapedDbRef}"});
  if (dbs.length === 0) {
    const dbByUuid = app.databases.whose({uuid: "${extractedDbUuid}"});
    if (dbByUuid.length === 0) throw new Error("Database not found: ${escapedDbRef}");
    var db = dbByUuid[0];
  } else {
    var db = dbs[0];
  }
${destNavCode}`;
  } else {
    // Default to Inbox
    tempDestCode = `
  var tempDest = app.incomingGroup();
  var db = { name: function() { return "Inbox"; } };`;
  }

  const extractText = options.text === true;

  // Build output handling code based on mode
  let outputCode;
  if (extractText) {
    outputCode = `
  // Extract plain text content
  const textContent = record.plainText();

  // Delete the temporary record from DEVONthink
  app.delete({record: record});

  JSON.stringify({
    success: true,
    textContent: textContent,
    originalFile: "${escapeString(filePath)}",
    tempDatabase: db.name(),
    tempUuid: recordUuid,
    wordCount: textContent ? textContent.split(/\\s+/).length : 0
  }, null, 2);`;
  } else {
    outputCode = `
  // Export to local path
  const exportedPath = app.export({
    record: record,
    to: "${escapeString(outputPath)}",
    DEVONtech_Storage: false
  });

  // Delete the temporary record from DEVONthink
  app.delete({record: record});

  JSON.stringify({
    success: true,
    outputPath: exportedPath || "${escapeString(outputPath)}",
    originalFile: "${escapeString(filePath)}",
    tempDatabase: db.name(),
    tempUuid: recordUuid
  }, null, 2);`;
  }

  const jxaScript = `
ObjC.import("Foundation");

try {
  const app = Application("DEVONthink");
${tempDestCode}

  const ocrOptions = {
    file: "${escapeString(filePath)}",
    to: tempDest,
    waitingForReply: ${waitForReply}
  };
  ${ocrType ? `ocrOptions.type = "${ocrType}";` : ''}

  const record = app.ocr(ocrOptions);

  if (!record) {
    throw new Error("OCR failed or returned no record");
  }

  const recordUuid = record.uuid();
  const recordPath = record.path();
${outputCode}

} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
`;

  if (process.env.DEBUG) {
    console.error('Generated JXA script:\n' + jxaScript);
  }

  const { stdout } = await execFileAsync(
    'osascript',
    ['-l', 'JavaScript', '-e', jxaScript],
    { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
  );

  const result = JSON.parse(stdout.trim());

  // If text extraction mode, write the text to the output file
  if (extractText && result.success && result.textContent !== undefined) {
    writeFileSync(outputPath, result.textContent || '', 'utf8');
    result.outputPath = outputPath;
    delete result.textContent; // Don't include full text in JSON output
  }

  return result;
}

/**
 * OCR a local file and output text to stdout (temp import -> extract text -> delete)
 */
async function ocrFileToStdout(filePath, options) {
  const ocrType = mapOcrType(resolveOcrType(options));
  const waitForReply = options.background !== true;
  const dbRef = options.database;
  const destRef = options.to;

  // Build JXA to resolve temp destination (same as ocrFileToLocal)
  let tempDestCode;
  if (isUuid(destRef)) {
    const groupUuid = extractUuid(destRef);
    tempDestCode = `
  var tempDest = app.getRecordWithUuid("${groupUuid}");
  if (!tempDest) throw new Error("Group not found: ${groupUuid}");
  var db = tempDest.database();`;
  } else if (dbRef) {
    const escapedDbRef = escapeString(dbRef);
    const extractedDbUuid = extractUuid(dbRef);
    let destNavCode;
    if (destRef && destRef !== '/') {
      const cleanPath = destRef.replace(/^\//, '');
      const escapedPath = escapeString(cleanPath);
      destNavCode = `
  const pathParts = "${escapedPath}".split("/");
  var tempDest = db.root();
  for (const part of pathParts) {
    if (!part) continue;
    const children = tempDest.children.whose({name: part, type: "group"});
    if (children.length === 0) throw new Error("Group not found: " + part);
    tempDest = children[0];
  }`;
    } else {
      destNavCode = `
  const downloadGroups = db.root().children.whose({name: "Downloads", type: "group"});
  var tempDest = downloadGroups.length > 0 ? downloadGroups[0] : db.root();`;
    }
    tempDestCode = `
  const dbs = app.databases.whose({name: "${escapedDbRef}"});
  if (dbs.length === 0) {
    const dbByUuid = app.databases.whose({uuid: "${extractedDbUuid}"});
    if (dbByUuid.length === 0) throw new Error("Database not found: ${escapedDbRef}");
    var db = dbByUuid[0];
  } else {
    var db = dbs[0];
  }
${destNavCode}`;
  } else {
    tempDestCode = `
  var tempDest = app.incomingGroup();
  var db = { name: function() { return "Inbox"; } };`;
  }

  const jxaScript = `
ObjC.import("Foundation");

try {
  const app = Application("DEVONthink");
${tempDestCode}

  const ocrOptions = {
    file: "${escapeString(filePath)}",
    to: tempDest,
    waitingForReply: ${waitForReply}
  };
  ${ocrType ? `ocrOptions.type = "${ocrType}";` : ''}

  const record = app.ocr(ocrOptions);

  if (!record) {
    throw new Error("OCR failed or returned no record");
  }

  const textContent = record.plainText();
  app.delete({record: record});

  JSON.stringify({
    success: true,
    textContent: textContent,
    originalFile: "${escapeString(filePath)}"
  }, null, 2);

} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
`;

  if (process.env.DEBUG) {
    console.error('Generated JXA script:\n' + jxaScript);
  }

  const { stdout } = await execFileAsync(
    'osascript',
    ['-l', 'JavaScript', '-e', jxaScript],
    { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
  );

  return JSON.parse(stdout.trim());
}

/**
 * OCR a local file and import to DEVONthink
 */
async function ocrFileToDevonthink(filePath, options) {
  const dbRef = options.database;
  const destRef = options.to || '/';
  const customName = options.as ? escapeString(options.as) : null;
  const tags = options.tag || [];
  const comment = options.comment ? escapeString(options.comment) : null;
  const ocrType = mapOcrType(resolveOcrType(options));
  const waitForReply = options.background !== true;

  const jxaScript = `
ObjC.import("Foundation");

try {
  const app = Application("DEVONthink");
${jxaResolveDatabaseAndGroup('db', 'destination', dbRef, destRef, true)}

  const ocrOptions = {
    file: "${escapeString(filePath)}",
    to: destination,
    waitingForReply: ${waitForReply}
  };
  ${ocrType ? `ocrOptions.type = "${ocrType}";` : ''}

  const record = app.ocr(ocrOptions);

  if (!record) {
    ${waitForReply ? 'throw new Error("OCR failed or returned no record");' : `
    JSON.stringify({
      success: true,
      message: "OCR started in background",
      database: db.name(),
      destination: destination.name()
    }, null, 2);
    `}
  } else {
    const recordUuid = record.uuid();

    ${customName ? `record.name = "${customName}";` : ''}
    ${tags.length > 0 ? `record.tags = ${JSON.stringify(tags)};` : ''}
    ${comment ? `record.comment = "${comment}";` : ''}

    JSON.stringify({
      success: true,
      uuid: recordUuid,
      name: record.name(),
      location: record.location(),
      database: db.name(),
      recordType: record.recordType(),
      path: record.path()
    }, null, 2);
  }

} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
`;

  if (process.env.DEBUG) {
    console.error('Generated JXA script:\n' + jxaScript);
  }

  const { stdout } = await execFileAsync(
    'osascript',
    ['-l', 'JavaScript', '-e', jxaScript],
    { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
  );

  return JSON.parse(stdout.trim());
}

/**
 * OCR an existing DEVONthink record and save to local path
 */
async function ocrRecordToLocal(uuid, options) {
  const outputPath = resolve(options.output);
  const outputDir = dirname(outputPath);

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const ocrType = mapOcrType(resolveOcrType(options));
  const waitForReply = options.background !== true;
  const extractText = options.text === true;

  // Build output handling code based on mode
  let outputCode;
  if (extractText) {
    outputCode = `
  // Extract plain text content
  const textContent = ocrRecord.plainText();

  // Delete the OCR'd record (we only wanted the text)
  app.delete({record: ocrRecord});

  JSON.stringify({
    success: true,
    textContent: textContent,
    sourceUuid: "${uuid}",
    sourceName: sourceRecord.name(),
    wordCount: textContent ? textContent.split(/\\s+/).length : 0
  }, null, 2);`;
  } else {
    outputCode = `
  // Export to local path
  const exportedPath = app.export({
    record: ocrRecord,
    to: "${escapeString(outputPath)}",
    DEVONtech_Storage: false
  });

  // Delete the OCR'd record (we only wanted the export)
  app.delete({record: ocrRecord});

  JSON.stringify({
    success: true,
    outputPath: exportedPath || "${escapeString(outputPath)}",
    sourceUuid: "${uuid}",
    sourceName: sourceRecord.name()
  }, null, 2);`;
  }

  const jxaScript = `
ObjC.import("Foundation");

try {
  const app = Application("DEVONthink");

  const sourceRecord = app.getRecordWithUuid("${uuid}");
  if (!sourceRecord) {
    throw new Error("Record not found: ${uuid}");
  }

  // Convert (OCR) the record - creates a new record
  const convertOptions = {
    record: sourceRecord,
    waitingForReply: ${waitForReply}
  };
  ${ocrType ? `convertOptions.type = "${ocrType}";` : ''}

  const ocrRecord = app.convertImage(convertOptions);

  if (!ocrRecord) {
    throw new Error("OCR conversion failed or returned no record");
  }

  const ocrUuid = ocrRecord.uuid();
${outputCode}

} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
`;

  if (process.env.DEBUG) {
    console.error('Generated JXA script:\n' + jxaScript);
  }

  const { stdout } = await execFileAsync(
    'osascript',
    ['-l', 'JavaScript', '-e', jxaScript],
    { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
  );

  const result = JSON.parse(stdout.trim());

  // If text extraction mode, write the text to the output file
  if (extractText && result.success && result.textContent !== undefined) {
    writeFileSync(outputPath, result.textContent || '', 'utf8');
    result.outputPath = outputPath;
    delete result.textContent; // Don't include full text in JSON output
  }

  return result;
}

/**
 * OCR an existing DEVONthink record and output text to stdout
 */
async function ocrRecordToStdout(uuid, options) {
  const ocrType = mapOcrType(resolveOcrType(options));
  const waitForReply = options.background !== true;

  const jxaScript = `
ObjC.import("Foundation");

try {
  const app = Application("DEVONthink");

  const sourceRecord = app.getRecordWithUuid("${uuid}");
  if (!sourceRecord) {
    throw new Error("Record not found: ${uuid}");
  }

  const convertOptions = {
    record: sourceRecord,
    waitingForReply: ${waitForReply}
  };
  ${ocrType ? `convertOptions.type = "${ocrType}";` : ''}

  const ocrRecord = app.convertImage(convertOptions);

  if (!ocrRecord) {
    throw new Error("OCR conversion failed or returned no record");
  }

  const textContent = ocrRecord.plainText();
  app.delete({record: ocrRecord});

  JSON.stringify({
    success: true,
    textContent: textContent,
    sourceUuid: "${uuid}",
    sourceName: sourceRecord.name()
  }, null, 2);

} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
`;

  if (process.env.DEBUG) {
    console.error('Generated JXA script:\n' + jxaScript);
  }

  const { stdout } = await execFileAsync(
    'osascript',
    ['-l', 'JavaScript', '-e', jxaScript],
    { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
  );

  return JSON.parse(stdout.trim());
}

/**
 * OCR an existing DEVONthink record in place (creates new record alongside)
 */
async function ocrRecordInPlace(uuid, options) {
  const customName = options.as ? escapeString(options.as) : null;
  const tags = options.tag || [];
  const comment = options.comment ? escapeString(options.comment) : null;
  const ocrType = mapOcrType(resolveOcrType(options));
  const destRef = options.to;
  const waitForReply = options.background !== true;

  const jxaScript = `
ObjC.import("Foundation");

try {
  const app = Application("DEVONthink");

  const sourceRecord = app.getRecordWithUuid("${uuid}");
  if (!sourceRecord) {
    throw new Error("Record not found: ${uuid}");
  }

  const convertOptions = {
    record: sourceRecord,
    waitingForReply: ${waitForReply}
  };
  ${ocrType ? `convertOptions.type = "${ocrType}";` : ''}
  ${destRef ? `
  const destRecord = app.getRecordWithUuid("${extractUuid(destRef)}");
  if (destRecord) convertOptions.to = destRecord;
  ` : ''}

  const ocrRecord = app.convertImage(convertOptions);

  if (!ocrRecord) {
    ${waitForReply ? 'throw new Error("OCR conversion failed or returned no record");' : `
    JSON.stringify({
      success: true,
      message: "OCR started in background",
      sourceUuid: "${uuid}"
    }, null, 2);
    `}
  } else {
    const ocrUuid = ocrRecord.uuid();

    ${customName ? `ocrRecord.name = "${customName}";` : ''}
    ${tags.length > 0 ? `ocrRecord.tags = ${JSON.stringify(tags)};` : ''}
    ${comment ? `ocrRecord.comment = "${comment}";` : ''}

    JSON.stringify({
      success: true,
      uuid: ocrUuid,
      name: ocrRecord.name(),
      location: ocrRecord.location(),
      database: ocrRecord.database().name(),
      recordType: ocrRecord.recordType(),
      path: ocrRecord.path(),
      sourceUuid: "${uuid}",
      sourceName: sourceRecord.name()
    }, null, 2);
  }

} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
`;

  if (process.env.DEBUG) {
    console.error('Generated JXA script:\n' + jxaScript);
  }

  const { stdout } = await execFileAsync(
    'osascript',
    ['-l', 'JavaScript', '-e', jxaScript],
    { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
  );

  return JSON.parse(stdout.trim());
}

/**
 * Map CLI type names to DEVONthink OCR convert type constants
 */
function mapOcrType(type) {
  if (!type) return null;

  const typeMap = {
    'pdf': 'PDF document',
    'rtf': 'RTF',
    'text': 'plain text',
    'html': 'HTML page',
    'markdown': 'Markdown document',
    'docx': 'Word document'
  };

  const mapped = typeMap[type.toLowerCase()];
  if (!mapped) {
    throw new Error(`Invalid OCR type: ${type}. Valid: pdf, rtf, text, html, markdown, docx`);
  }
  return mapped;
}
