/**
 * Download Command
 * Download operations for DEVONthink
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerDownloadCommand(program) {
  const download = program
    .command('download')
    .alias('dl')
    .description('Download operations');

  // dt download add <url> - Add URL to download manager
  download
    .command('add <url>')
    .alias('queue')
    .description('Add a URL to DEVONthink download manager')
    .option('-a, --automatic', 'Download automatically (vs. manual queue)')
    .option('-u, --user <username>', 'Username for protected URLs')
    .option('-p, --password <password>', 'Password for protected URLs')
    .option('-r, --referrer <url>', 'HTTP referrer URL')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .addHelpText('after', `
Examples:
  dt download add "https://example.com/file.zip"
  dt download queue "https://example.com/file.zip" --automatic
`)
    .action(async (url, options) => {
      try {
        await requireDevonthink();

        const params = {
          url: url,
          automatic: options.automatic || false
        };

        if (options.user) params.user = options.user;
        if (options.password) params.password = options.password;
        if (options.referrer) params.referrer = options.referrer;

        const result = await runJxa('write', 'addDownload', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt download url <url> - Download URL content
  download
    .command('url <url>')
    .alias('fetch')
    .description('Download URL content (raw data)')
    .option('-u, --user <username>', 'Username for protected URLs')
    .option('-p, --password <password>', 'Password for protected URLs')
    .option('-r, --referrer <url>', 'HTTP referrer URL')
    .option('-a, --agent <agent>', 'User agent string')
    .option('-m, --method <method>', 'HTTP method (GET, POST)', 'GET')
    .option('--post <json>', 'POST data as JSON object')
    .option('-o, --output <file>', 'Save to file instead of stdout')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output the downloaded content')
    .addHelpText('after', `
Examples:
  dt download url "https://example.com/data.txt"
  dt download fetch "https://example.com/api" --post '{"q":"test"}'
`)
    .action(async (url, options) => {
      try {
        await requireDevonthink();

        const params = { url };
        if (options.user) params.user = options.user;
        if (options.password) params.password = options.password;
        if (options.referrer) params.referrer = options.referrer;
        if (options.agent) params.agent = options.agent;
        if (options.method) params.method = options.method;
        if (options.post) {
          try {
            params.post = JSON.parse(options.post);
          } catch {
            throw new Error('Invalid JSON for --post option');
          }
        }
        if (options.output) params.outputFile = options.output;

        const result = await runJxa('read', 'downloadUrl', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          console.log(result.content || '');
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt download markup <url> - Download HTML/XML markup
  download
    .command('markup <url>')
    .alias('html')
    .description('Download HTML or XML page (including RSS, RDF, Atom)')
    .option('-u, --user <username>', 'Username for protected URLs')
    .option('-p, --password <password>', 'Password for protected URLs')
    .option('-r, --referrer <url>', 'HTTP referrer URL')
    .option('-a, --agent <agent>', 'User agent string')
    .option('-e, --encoding <encoding>', 'Page encoding (default: UTF-8)')
    .option('-m, --method <method>', 'HTTP method (GET, POST)', 'GET')
    .option('--post <json>', 'POST data as JSON object')
    .option('-o, --output <file>', 'Save to file instead of stdout')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output the markup')
    .addHelpText('after', `
Examples:
  dt download markup "https://example.com"
  dt download html "https://example.com/feed.xml" -e utf-8
`)
    .action(async (url, options) => {
      try {
        await requireDevonthink();

        const params = { url };
        if (options.user) params.user = options.user;
        if (options.password) params.password = options.password;
        if (options.referrer) params.referrer = options.referrer;
        if (options.agent) params.agent = options.agent;
        if (options.encoding) params.encoding = options.encoding;
        if (options.method) params.method = options.method;
        if (options.post) {
          try {
            params.post = JSON.parse(options.post);
          } catch {
            throw new Error('Invalid JSON for --post option');
          }
        }
        if (options.output) params.outputFile = options.output;

        const result = await runJxa('read', 'downloadMarkup', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          console.log(result.markup || '');
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt download json <url> - Download JSON
  download
    .command('json <url>')
    .alias('api')
    .description('Download JSON from a URL')
    .option('-u, --user <username>', 'Username for protected URLs')
    .option('-p, --password <password>', 'Password for protected URLs')
    .option('-r, --referrer <url>', 'HTTP referrer URL')
    .option('-a, --agent <agent>', 'User agent string')
    .option('-m, --method <method>', 'HTTP method (GET, POST)', 'GET')
    .option('--post <json>', 'POST data as JSON object')
    .option('-o, --output <file>', 'Save to file instead of stdout')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output the JSON data')
    .addHelpText('after', `
Examples:
  dt download json "https://example.com/data.json"
  dt download api "https://example.com/api" -o /tmp/data.json
`)
    .action(async (url, options) => {
      try {
        await requireDevonthink();

        const params = { url };
        if (options.user) params.user = options.user;
        if (options.password) params.password = options.password;
        if (options.referrer) params.referrer = options.referrer;
        if (options.agent) params.agent = options.agent;
        if (options.method) params.method = options.method;
        if (options.post) {
          try {
            params.post = JSON.parse(options.post);
          } catch {
            throw new Error('Invalid JSON for --post option');
          }
        }
        if (options.output) params.outputFile = options.output;

        const result = await runJxa('read', 'downloadJson', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          console.log(JSON.stringify(result.data, null, 2));
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt download start - Start download manager queue
  download
    .command('start')
    .description('Start the download manager queue')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .addHelpText('after', `
Examples:
  dt download start
`)
    .action(async (options) => {
      try {
        await requireDevonthink();
        const result = await runJxa('write', 'downloadManager', [JSON.stringify({ action: 'start' })]);
        print(result, options);
        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt download stop - Stop download manager queue
  download
    .command('stop')
    .description('Stop the download manager queue')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .addHelpText('after', `
Examples:
  dt download stop
`)
    .action(async (options) => {
      try {
        await requireDevonthink();
        const result = await runJxa('write', 'downloadManager', [JSON.stringify({ action: 'stop' })]);
        print(result, options);
        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
