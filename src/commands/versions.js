/**
 * Versions Command
 * Manage document versions in DEVONthink
 * @version 1.0.0
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerVersionsCommand(program) {
  const versions = program
    .command('versions')
    .description('Manage document versions');

  // List versions of a record
  versions
    .command('list <uuid>')
    .description('List saved versions of a record')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output (just UUIDs)')
    .addHelpText('after', `
JSON Output:
  {
    "success": true,
    "uuid": "string",
    "name": "string",
    "versioningEnabled": boolean,
    "versions": [
      {
        "index": number,
        "uuid": "string",
        "name": "string",
        "creationDate": "ISO date",
        "modificationDate": "ISO date",
        "size": number
      }
    ],
    "count": number
  }

Examples:
  dt versions list ABCD-1234
  dt versions list ABCD-1234 --quiet        # Just version UUIDs
`)
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();

        const result = await runJxa('read', 'getVersions', [JSON.stringify({ uuid })]);

        if (options.quiet && result.success) {
          if (result.versions && result.versions.length > 0) {
            console.log(result.versions.map(v => v.uuid).join('\n'));
          }
        } else {
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

  // Restore a version
  versions
    .command('restore <version-uuid>')
    .description('Restore a saved version of a record')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .addHelpText('after', `
JSON Output:
  {
    "success": true,
    "restored": true,
    "versionUuid": "string",
    "message": "string"
  }

Examples:
  dt versions restore VERSION-UUID-1234
`)
    .action(async (versionUuid, options) => {
      try {
        await requireDevonthink();

        const result = await runJxa('write', 'restoreVersion', [JSON.stringify({ versionUuid })]);
        print(result, options);

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // Get versioning status for a database
  versions
    .command('status')
    .description('Get versioning status for a database')
    .option('-d, --database <name>', 'Database name or UUID')
    .option('-u, --uuid <uuid>', 'Get status for the database containing this record')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .addHelpText('after', `
JSON Output:
  {
    "success": true,
    "database": "string",
    "databaseUuid": "string",
    "versioningEnabled": boolean,
    "versionsGroup": {
      "name": "string",
      "uuid": "string",
      "location": "string"
    }
  }

Examples:
  dt versions status -d "My Database"
  dt versions status -u RECORD-UUID         # Get status for record's database
`)
    .action(async (options) => {
      try {
        await requireDevonthink();

        if (!options.database && !options.uuid) {
          throw new Error('Either --database or --uuid is required');
        }

        const params = {};
        if (options.database) params.database = options.database;
        if (options.uuid) params.uuid = options.uuid;

        const result = await runJxa('read', 'getVersioningStatus', [JSON.stringify(params)]);
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
