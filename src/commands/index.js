/**
 * Index Command
 * Index external files and folders in DEVONthink
 */

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerIndexCommand(program) {
  program
    .command('index <path>')
    .alias('indicate')
    .description('Index an external file or folder (creates reference, not copy)')
    .requiredOption('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .option('-g, --to <pathOrUuid>', 'Destination group (path or UUID)', '/')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of indexed record')
    .addHelpText('after', `
Examples:
  dt index "/path/to/folder" -d "Research"
  dt index "/path/to/file.pdf" -d "Research" -g "/References"
`)
    .action(async (path, options) => {
      try {
        await requireDevonthink();

        // Resolve file path
        const filePath = resolve(path);
        if (!existsSync(filePath)) {
          throw new Error(`Path not found: ${filePath}`);
        }

        const params = {
          path: filePath,
          database: options.database,
          groupPath: options.to || '/'
        };

        const result = await runJxa('write', 'indexPath', [JSON.stringify(params)]);
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
