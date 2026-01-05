/**
 * Get Command
 * Get record properties, preview, or content
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerGetCommand(program) {
  const get = program
    .command('get')
    .description('Get record information');

  // dt get props <uuid>
  get
    .command('props <uuid>')
    .alias('properties')
    .description('Get all properties of a record')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID')
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();
        const result = await runJxa('read', 'getRecordProperties', [uuid]);
        print(result, options);
        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt get preview <uuid>
  get
    .command('preview <uuid>')
    .alias('content')
    .description('Get plain text preview of a record')
    .option('-l, --length <chars>', 'Maximum characters to return', '3000')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output the preview text')
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();
        const maxChars = options.length || '3000';
        const result = await runJxa('read', 'getRecordPreview', [uuid, maxChars]);

        if (options.quiet && result.success) {
          console.log(result.preview || '');
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt get selection
  get
    .command('selection')
    .alias('selected')
    .description('Get currently selected records in DEVONthink')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .action(async (options) => {
      try {
        await requireDevonthink();
        const result = await runJxa('read', 'getSelection', []);
        print(result, options);
        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt get concordance <uuid>
  get
    .command('concordance <uuid>')
    .alias('words')
    .description('Get word list (concordance) of a record')
    .option('-s, --sort <method>', 'Sort by: weight (default), frequency, name', 'weight')
    .option('-l, --limit <n>', 'Limit number of words returned', parseInt)
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output words (one per line)')
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();
        const sortBy = options.sort || 'weight';
        const result = await runJxa('read', 'getConcordance', [uuid, sortBy]);

        if (options.limit && result.success && result.words) {
          result.words = result.words.slice(0, options.limit);
          result.wordCount = result.words.length;
        }

        if (options.quiet && result.success) {
          // Output just the words, one per line
          console.log(result.words.join('\n'));
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt get transcribe <uuid>
  get
    .command('transcribe <uuid>')
    .alias('transcript')
    .description('Transcribe speech/text from audio, video, PDF, or image')
    .option('-l, --language <code>', 'ISO language code (e.g., en, de)')
    .option('-t, --timestamps', 'Include timestamps in transcription')
    .option('--no-timestamps', 'Exclude timestamps from transcription')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output the transcription text')
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();

        const params = { uuid };
        if (options.language) params.language = options.language;
        if (options.timestamps !== undefined) params.timestamps = options.timestamps;

        const result = await runJxa('read', 'transcribe', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          console.log(result.transcription || '');
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
