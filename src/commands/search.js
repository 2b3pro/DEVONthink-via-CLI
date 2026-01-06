/**
 * Search Command
 * Search and lookup DEVONthink records with various methods
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { trackDatabaseAccess } from '../state.js';
import { getDatabaseCache } from '../cache.js';
import { buildSearchQuery } from '../utils.js';

async function trackDb(nameOrUuid) {
  if (!nameOrUuid) return;
  try {
    const cache = await getDatabaseCache();
    if (cache && cache.databases) {
       const db = cache.databases.find(d => d.name === nameOrUuid || d.uuid === nameOrUuid);
       if (db) {
         await trackDatabaseAccess(db);
       }
    }
  } catch (e) {}
}

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
    .option('--created-after <value>', 'Filter by creation date (after). Example: "2 weeks", "2024-01-01"')
    .option('--created-before <value>', 'Filter by creation date (before). Example: "2024-12-31"')
    .option('--modified-after <value>', 'Filter by modification date (after)')
    .option('--modified-before <value>', 'Filter by modification date (before)')
    .option('--added-after <value>', 'Filter by addition date (after)')
    .option('--added-before <value>', 'Filter by addition date (before)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .addHelpText('after', `
Examples:
  dt search q "project plan"
  dt search q "machine learning" -d "Research"
  dt search q "client" --created-after "2 weeks" --modified-before "2024-12-31"
  dt search q "tags:urgent AND kind:pdf" --type pdf
`)
    .action(async (query, options) => {
      try {
        await requireDevonthink();

        await trackDb(options.database);

        const opts = {
          database: options.database || '',
          parentUUID: options.group || '',
          limit: parseInt(options.limit, 10) || 50,
          recordType: options.type || '',
          comparison: options.comparison || '',
          excludeSubgroups: options.excludeSubgroups || false
        };

        const combinedQuery = buildSearchQuery(query, {
          createdAfter: options.createdAfter,
          createdBefore: options.createdBefore,
          modifiedAfter: options.modifiedAfter,
          modifiedBefore: options.modifiedBefore,
          addedAfter: options.addedAfter,
          addedBefore: options.addedBefore
        });

        const result = await runJxa('read', 'search', [combinedQuery, JSON.stringify(opts)]);
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
    .addHelpText('after', `
Examples:
  dt search comment "client notes"
  dt search comment "needs follow up" -d "Research"
`)
    .action(async (text, options) => {
      try {
        await requireDevonthink();
        
        await trackDb(options.database);

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
    .addHelpText('after', `
Examples:
  dt search hash "0cc175b9c0f1b6a831c399e269772661"
  dt search hash "deadbeef" -d "Research"
`)
    .action(async (hash, options) => {
      try {
        await requireDevonthink();

        await trackDb(options.database);

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
    .addHelpText('after', `
Examples:
  dt search file "Invoice-2024.pdf"
  dt search file "Meeting Notes" -d "Work"
`)
    .action(async (filename, options) => {
      try {
        await requireDevonthink();

        await trackDb(options.database);

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
    .addHelpText('after', `
Examples:
  dt search path "/Projects/Client A/Contracts"
  dt search path "Research/Papers/2024" -d "Research"
`)
    .action(async (path, options) => {
      try {
        await requireDevonthink();

        await trackDb(options.database);

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
    .addHelpText('after', `
Examples:
  dt search tags urgent client
  dt search tags "to-review" "2024" --any -d "Research"
`)
    .action(async (tags, options) => {
      try {
        await requireDevonthink();

        await trackDb(options.database);

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
    .addHelpText('after', `
Examples:
  dt search url "https://example.com/article"
  dt search url "https://example.com" -d "Research"
`)
    .action(async (url, options) => {
      try {
        await requireDevonthink();

        await trackDb(options.database);

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
    .addHelpText('after', `
Examples:
  dt search show "project plan"
  dt search ui "tags:urgent AND kind:pdf"
`)
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
