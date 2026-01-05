/**
 * Search Command
 * Search and lookup DEVONthink records with various methods
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerSearchCommand(program) {
  const search = program
    .command('search')
    .description('Search and lookup DEVONthink records');

  // dt search query <query> - Full-text search (main search)
  search
    .command('query <query>')
    .alias('q')
    .description('Full-text search for records')
    .option('-d, --database <nameOrUuid>', 'Search within specific database (name or UUID)')
    .option('-g, --group <uuid>', 'Search within specific group (UUID)')
    .option('-t, --type <type>', 'Filter by record type (markdown, pdf, etc.)')
    .option('-l, --limit <n>', 'Maximum results to return', '50')
    .option('-c, --comparison <mode>', 'Search mode: fuzzy, "no case", "no umlauts", related')
    .option('--exclude-subgroups', 'Do not search in subgroups')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .action(async (query, options) => {
      try {
        await requireDevonthink();

        const opts = {
          database: options.database || '',
          parentUUID: options.group || '',
          limit: parseInt(options.limit, 10) || 50,
          recordType: options.type || '',
          comparison: options.comparison || '',
          excludeSubgroups: options.excludeSubgroups || false
        };

        const result = await runJxa('read', 'search', [query, JSON.stringify(opts)]);
        print(result, options);

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt search comment <text> - Lookup by comment
  search
    .command('comment <text>')
    .description('Lookup records by comment')
    .option('-d, --database <nameOrUuid>', 'Search within specific database')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .action(async (text, options) => {
      try {
        await requireDevonthink();

        const params = { type: 'comment', value: text };
        if (options.database) params.database = options.database;

        const result = await runJxa('read', 'lookupRecords', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt search hash <hash> - Lookup by content hash
  search
    .command('hash <hash>')
    .description('Lookup records by content hash')
    .option('-d, --database <nameOrUuid>', 'Search within specific database')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .action(async (hash, options) => {
      try {
        await requireDevonthink();

        const params = { type: 'hash', value: hash };
        if (options.database) params.database = options.database;

        const result = await runJxa('read', 'lookupRecords', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt search file <filename> - Lookup by filename
  search
    .command('file <filename>')
    .description('Lookup records by filename (last path component)')
    .option('-d, --database <nameOrUuid>', 'Search within specific database')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .action(async (filename, options) => {
      try {
        await requireDevonthink();

        const params = { type: 'file', value: filename };
        if (options.database) params.database = options.database;

        const result = await runJxa('read', 'lookupRecords', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt search path <path> - Lookup by path
  search
    .command('path <path>')
    .description('Lookup records by path')
    .option('-d, --database <nameOrUuid>', 'Search within specific database')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .action(async (path, options) => {
      try {
        await requireDevonthink();

        const params = { type: 'path', value: path };
        if (options.database) params.database = options.database;

        const result = await runJxa('read', 'lookupRecords', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt search tags <tag...> - Lookup by tags
  search
    .command('tags <tag...>')
    .description('Lookup records by tags')
    .option('-a, --any', 'Match any tag (default: match all)')
    .option('-d, --database <nameOrUuid>', 'Search within specific database')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .action(async (tags, options) => {
      try {
        await requireDevonthink();

        const params = { type: 'tags', value: tags };
        if (options.any) params.any = true;
        if (options.database) params.database = options.database;

        const result = await runJxa('read', 'lookupRecords', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt search url <url> - Lookup by URL
  search
    .command('url <url>')
    .description('Lookup records by URL')
    .option('-d, --database <nameOrUuid>', 'Search within specific database')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .action(async (url, options) => {
      try {
        await requireDevonthink();

        const params = { type: 'url', value: url };
        if (options.database) params.database = options.database;

        const result = await runJxa('read', 'lookupRecords', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt search show [query] - Show search in DEVONthink UI
  search
    .command('show [query]')
    .alias('ui')
    .description('Open search in DEVONthink window')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (query, options) => {
      try {
        await requireDevonthink();

        const result = await runJxa('read', 'showSearch', [query || '']);
        print(result, options);

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
