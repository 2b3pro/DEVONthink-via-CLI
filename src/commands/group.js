/**
 * Group Command
 * Create and resolve group paths
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerGroupCommand(program) {
  program
    .command('group <path>')
    .alias('mkdir')
    .description('Resolve or create a group path (with fuzzy matching)')
    .requiredOption('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output group UUID')
    .addHelpText('after', `
Examples:
  dt group "/Projects/Client A" -d "Research"
  dt mkdir "Archive/2024" -d "Research"
`)
    .action(async (path, options) => {
      try {
        await requireDevonthink();

        const params = {
          database: options.database,
          path: path
        };

        const result = await runJxa('write', 'resolveOrCreateGroup', [JSON.stringify(params)]);
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
