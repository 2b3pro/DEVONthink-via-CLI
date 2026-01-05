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
    .description('Update text content of a record (plain/rich text, Markdown, HTML)')
    .requiredOption('-m, --mode <mode>', 'Update mode: setting (replace), inserting (after metadata), appending')
    .option('-c, --content <text>', 'Text content to update (use - for stdin)')
    .option('-f, --file <path>', 'Read content from file')
    .option('-u, --url <url>', 'URL associated with the text')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();

        const validModes = ['setting', 'inserting', 'appending'];
        if (!validModes.includes(options.mode)) {
          throw new Error(`Invalid mode: ${options.mode}. Valid: setting, inserting, appending`);
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
          mode: options.mode
        };

        if (options.url) {
          params.url = options.url;
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
