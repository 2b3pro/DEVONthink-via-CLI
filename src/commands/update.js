/**
 * Update Command
 * Update text content of records
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { readFileSync } from 'node:fs';
import { readStdin, isStdinMarker } from '../utils.js';

export function registerUpdateCommand(program) {
  program
    .command('update <uuid>')
    .description('Update a record\'s main text content from a file or stdin. Use "modify" to set metadata properties.')
    .option('-m, --mode <mode>', 'Update mode: setting (replace), inserting (after first line), appending (default: setting)')
    .option('-c, --content <text>', 'Text content to update (use - for stdin)')
    .option('-f, --file <path>', 'Read content from file')
    .option('-u, --url <url>', 'URL associated with the text')
    .option('--comments', 'Update the comment property instead of content')
    .option('--custom-metadata <field>', 'Update a custom metadata field instead of content')
    .option('--no-version', 'Skip saving a version before updating (versioning is ON by default)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .addHelpText('after', `
JSON Output:
  {
    "success": true,
    "uuid": "string",
    "name": "string",
    "recordType": "string",
    "target": "content|comment|customMetadata",
    "mode": "setting|inserting|appending",
    "textLength": number,
    "versionSaved": boolean,
    "field": "string" // optional (for customMetadata)
  }

Examples:
  dt update ABCD-1234 -c "New content"             # Saves version by default
  dt update ABCD-1234 -c "New content" --no-version   # Skip versioning
  dt update ABCD-1234 -f ./notes.md --comments
`)
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();

        // Default mode to 'setting' if not specified
        const mode = options.mode || 'setting';
        const validModes = ['setting', 'inserting', 'appending'];
        if (!validModes.includes(mode)) {
          throw new Error(`Invalid mode: ${mode}. Valid: setting, inserting, appending`);
        }

        // Check for mutually exclusive target options
        const targets = [options.comments, options.customMetadata].filter(Boolean);
        if (targets.length > 1) {
          throw new Error('Cannot use --comments and --custom-metadata together');
        }

        let text;
        if (options.file) {
          try {
            text = readFileSync(options.file, 'utf-8');
          } catch (err) {
            throw new Error(`Cannot read file: ${options.file} - ${err.message}`);
          }
        } else if (options.content !== undefined) {
          if (isStdinMarker(options.content)) {
            text = await readStdin();
            if (!text) {
              throw new Error('No content received from stdin');
            }
          } else {
            text = options.content;
          }
        } else {
          throw new Error('Either --content or --file is required');
        }

        const params = {
          uuid,
          text,
          mode,
          saveVersion: options.version !== false  // --no-version sets version to false
        };

        if (options.url) {
          params.url = options.url;
        }

        // Set target type
        if (options.comments) {
          params.target = 'comment';
        } else if (options.customMetadata) {
          params.target = 'customMetadata';
          params.customMetadataField = options.customMetadata;
        } else {
          params.target = 'content';
        }

        const result = await runJxa('write', 'updateRecord', [JSON.stringify(params)]);
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
