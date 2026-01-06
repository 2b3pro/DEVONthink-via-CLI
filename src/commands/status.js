/**
 * Status Command
 * Check DEVONthink status
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { setDatabaseCache } from '../cache.js';

export function registerStatusCommand(program) {
  program
    .command('status')
    .description('Check if DEVONthink is running')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Exit code only (0=running, 1=not running)')
    .addHelpText('after', `
Examples:
  dt status
  dt status --json
`)
    .action(async (options) => {
      try {
        const result = await runJxa('utils', 'isRunning', []);

        if (result.running) {
          try {
            // Silently refresh database cache
            const dbs = await runJxa('read', 'listDatabases', []);
            if (Array.isArray(dbs)) {
              await setDatabaseCache(dbs);
            }
          } catch (e) {
            // Ignore cache errors on status check
          }
        }

        if (!options.quiet) {
          print(result, options);
        }

        // Exit with appropriate code
        process.exit(result.running ? 0 : 1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
