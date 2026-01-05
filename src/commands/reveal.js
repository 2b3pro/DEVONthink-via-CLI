/**
 * Reveal Command
 * Open/reveal records in DEVONthink UI
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerRevealCommand(program) {
  program
    .command('reveal <uuid>')
    .alias('open')
    .alias('show')
    .description('Reveal/open a record in DEVONthink')
    .option('-p, --parent', 'Reveal parent group instead of record')
    .option('-m, --mode <mode>', 'Display mode: window, tab, reveal (in-place)', 'window')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Suppress output')
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();

        const target = options.parent ? 'parent' : 'self';
        const mode = options.mode || 'window';

        const result = await runJxa('utils', 'revealRecord', [uuid, target, mode]);

        if (!options.quiet) {
          print(result, options);
        }

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
