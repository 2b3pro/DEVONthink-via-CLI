/**
 * Classify Command
 * Get classification proposals and batch classify records
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerClassifyCommand(program) {
  const classify = program
    .command('classify')
    .description('Classification operations');

  // dt classify suggest <uuid>
  classify
    .command('suggest <uuid>')
    .alias('proposals')
    .description('Get DEVONthink classification proposals for a record')
    .option('-d, --database <nameOrUuid>', 'Limit proposals to specific database (name or UUID)')
    .option('--include-tags', 'Include tag suggestions')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output proposed group UUIDs')
    .addHelpText('after', `
Examples:
  dt classify suggest ABCD-1234
  dt classify proposals ABCD-1234 -d "Research" --include-tags
`)
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();

        const args = [
          uuid,
          options.database || '',
          options.includeTags ? 'true' : 'false'
        ];

        const result = await runJxa('read', 'classify', args);
        print(result, options);

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt classify batch
  classify
    .command('batch')
    .alias('file')
    .description('Batch classify multiple records')
    .requiredOption('-i, --input <json>', 'JSON array of classification operations (or - for stdin)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .addHelpText('after', `
Examples:
  dt classify batch -i '[{"uuid":"ABCD-1234","destination":"/Inbox"}]'
  cat classify.json | dt classify batch -i -
`)
    .action(async (options) => {
      try {
        await requireDevonthink();

        let input = options.input;

        // Read from stdin if input is "-"
        if (input === '-') {
          const chunks = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk);
          }
          input = Buffer.concat(chunks).toString('utf-8');
        }

        // Validate JSON
        try {
          JSON.parse(input);
        } catch (e) {
          throw new Error(`Invalid JSON input: ${e.message}`);
        }

        const result = await runJxa('write', 'batchClassify', [input]);
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
