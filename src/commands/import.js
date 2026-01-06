/**
 * Import Command
 * Import files into DEVONthink
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { isUuid, escapeString, jxaResolveDatabaseAndGroup } from '../utils.js';

const execFileAsync = promisify(execFile);

export function registerImportCommand(program) {
  program
    .command('import <file>')
    .description('Import a file into DEVONthink')
    .option('-d, --database <nameOrUuid>', 'Target database (required unless -g is a UUID)')
    .option('-g, --to <pathOrUuid>', 'Destination group (path or UUID)', '/')
    .option('-n, --as <name>', 'Custom name for imported record')
    .option('-t, --tag <tag>', 'Add tag (can be used multiple times)', collectTags, [])
    .option('--comment <text>', 'Set comment on imported record')
    .option('--ocr', 'Import with OCR (for PDFs and images)')
    .option('--ocr-type <type>', 'OCR output type (pdf, rtf, text, html, markdown, docx)')
    .option('--background', 'Run OCR in background (do not wait for completion)')
    .option('--transcribe', 'Transcribe audio/video and create markdown with transcription')
    .option('--language <code>', 'Transcription language (ISO code like en, de)')
    .option('--timestamps', 'Include timestamps in transcription')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of imported record')
    .addHelpText('after', `
Examples:
  dt import "/path/to/file.pdf" -d "Research" -g "/Papers"
  dt import "/path/to/audio.m4a" -d "Inbox" --transcribe --language en
`)
    .action(async (file, options) => {
      try {
        await requireDevonthink();

        // Resolve file path
        const filePath = resolve(file);
        if (!existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }

        // Validate: database required unless group is a UUID
        const destRef = options.to || '/';
        if (!options.database && !isUuid(destRef)) {
          throw new Error('Database (-d) is required unless destination group (-g) is a UUID');
        }

        // Build JXA script for import (with OCR, transcribe, or standard)
        let jxaScript;
        if (options.transcribe) {
          jxaScript = buildTranscribeImportScript(filePath, options);
        } else if (options.ocr) {
          jxaScript = buildOcrImportScript(filePath, options);
        } else {
          jxaScript = buildImportScript(filePath, options);
        }

        // Debug: output generated script if DEBUG env is set
        if (process.env.DEBUG) {
          console.error('Generated JXA script:\n' + jxaScript);
        }

        const { stdout } = await execFileAsync(
          'osascript',
          ['-l', 'JavaScript', '-e', jxaScript],
          { timeout: 300000, maxBuffer: 10 * 1024 * 1024 } // 5 min timeout for OCR
        );

        const result = JSON.parse(stdout.trim());
        print(result, options);

        if (!result.success) {
          process.exit(1);
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

function buildImportScript(filePath, options) {
  const dbRef = options.database;
  const destRef = options.to || '/';
  const customName = options.as ? escapeString(options.as) : null;
  const tags = options.tag || [];
  const comment = options.comment ? escapeString(options.comment) : null;

  return `
ObjC.import("Foundation");

try {
  const app = Application("DEVONthink");
${jxaResolveDatabaseAndGroup('db', 'destination', dbRef, destRef, true)}

  // Import the file (AppleScript 'import path' -> JXA 'importPath')
  const importResult = app.importPath("${escapeString(filePath)}", { to: destination });
  if (!importResult) throw new Error("Import failed");

  // Get the imported record (use UUID for further manipulation)
  const record = importResult;
  const recordUuid = record.uuid();

  // Set custom name if specified
  ${customName ? `record.name = "${customName}";` : ''}

  // Set tags if specified
  ${tags.length > 0 ? `record.tags = ${JSON.stringify(tags)};` : ''}

  // Set comment if specified
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

} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
`;
}

function buildOcrImportScript(filePath, options) {
  const dbRef = options.database;
  const destRef = options.to || '/';
  const customName = options.as ? escapeString(options.as) : null;
  const tags = options.tag || [];
  const comment = options.comment ? escapeString(options.comment) : null;
  const ocrType = options.ocrType || null;
  const waitForReply = options.background !== true;

  // Map CLI type names to DEVONthink OCR convert type constants
  const ocrTypeMap = {
    'pdf': 'PDF document with text',
    'rtf': 'rich text',
    'text': 'plain text',
    'html': 'HTML page',
    'markdown': 'Markdown document',
    'docx': 'Microsoft Word document'
  };

  const mappedType = ocrType && ocrTypeMap[ocrType.toLowerCase()];
  if (ocrType && !mappedType) {
    throw new Error(`Invalid OCR type: ${ocrType}. Valid: pdf, rtf, text, html, markdown, docx`);
  }

  return `
ObjC.import("Foundation");

try {
  const app = Application("DEVONthink");
${jxaResolveDatabaseAndGroup('db', 'destination', dbRef, destRef, true)}

  // Build OCR options
  const ocrOptions = {
    file: "${escapeString(filePath)}",
    to: destination,
    waitingForReply: ${waitForReply}
  };

  ${mappedType ? `ocrOptions.fileType = "${mappedType}";` : ''}

  // Perform OCR import
  const record = app.ocr(ocrOptions);

  if (!record) {
    ${waitForReply ? 'throw new Error("OCR import failed or returned no record");' : `
    JSON.stringify({
      success: true,
      message: "OCR started in background",
      database: db.name(),
      destination: destination.name()
    }, null, 2);
    `}
  } else {
    const recordUuid = record.uuid();

    // Set custom name if specified
    ${customName ? `record.name = "${customName}";` : ''}

    // Set tags if specified
    ${tags.length > 0 ? `record.tags = ${JSON.stringify(tags)};` : ''}

    // Set comment if specified
    ${comment ? `record.comment = "${comment}";` : ''}

    JSON.stringify({
      success: true,
      uuid: recordUuid,
      name: record.name(),
      location: record.location(),
      database: db.name(),
      recordType: record.recordType(),
      path: record.path(),
      ocr: true
    }, null, 2);
  }

} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
`;
}

function buildTranscribeImportScript(filePath, options) {
  const dbRef = options.database;
  const destRef = options.to || '/';
  const customName = options.as ? escapeString(options.as) : null;
  const tags = options.tag || [];
  const comment = options.comment ? escapeString(options.comment) : null;
  const language = options.language || null;
  const timestamps = options.timestamps === true;

  return `
ObjC.import("Foundation");

try {
  const app = Application("DEVONthink");
${jxaResolveDatabaseAndGroup('db', 'destination', dbRef, destRef, true)}

  // Import the file first (AppleScript 'import path' -> JXA 'importPath')
  const importResult = app.importPath("${escapeString(filePath)}", { to: destination });
  if (!importResult) throw new Error("Import failed");

  const record = importResult;
  const recordUuid = record.uuid();
  const recordName = ${customName ? `"${customName}"` : 'record.name()'};

  // Set custom name if specified
  ${customName ? `record.name = "${customName}";` : ''}

  // Set tags if specified
  ${tags.length > 0 ? `record.tags = ${JSON.stringify(tags)};` : ''}

  // Set comment if specified
  ${comment ? `record.comment = "${comment}";` : ''}

  // Transcribe the imported record
  const transcribeOptions = {};
  ${language ? `transcribeOptions.language = "${language}";` : ''}
  ${timestamps ? `transcribeOptions.timestamps = true;` : `transcribeOptions.timestamps = false;`}

  const transcription = app.transcribeRecord(record, transcribeOptions);

  if (!transcription) {
    JSON.stringify({
      success: true,
      uuid: recordUuid,
      name: record.name(),
      location: record.location(),
      database: db.name(),
      recordType: record.recordType(),
      path: record.path(),
      transcription: null,
      warning: "Transcription failed or returned no content"
    }, null, 2);
  } else {
    // Create markdown document with transcription
    const mdName = recordName.replace(/\\.[^.]+$/, '') + " - Transcription";
    const mdContent = "# " + recordName + "\\n\\n" + transcription;

    const mdRecord = app.createRecordWith({
      name: mdName,
      type: "markdown",
      content: mdContent
    }, { in: destination });

    if (!mdRecord) throw new Error("Failed to create transcription markdown");

    // Copy tags to transcription if any
    ${tags.length > 0 ? `mdRecord.tags = ${JSON.stringify(tags)};` : ''}

    JSON.stringify({
      success: true,
      imported: {
        uuid: recordUuid,
        name: record.name(),
        location: record.location(),
        recordType: record.recordType(),
        path: record.path()
      },
      transcription: {
        uuid: mdRecord.uuid(),
        name: mdRecord.name(),
        location: mdRecord.location()
      },
      database: db.name()
    }, null, 2);
  }

} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
`;
}
