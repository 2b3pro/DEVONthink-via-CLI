/**
 * Test Helpers for DevonThink CLI
 * Provides utilities for testing commands against Test_Database
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);

// Test database configuration
export const TEST_DATABASE = {
  name: 'Test_Database',
  uuid: '3DAB969D-B963-4056-ABE5-4990E2243F59',
  itemLink: 'x-devonthink-item://3DAB969D-B963-4056-ABE5-4990E2243F59'
};

// Path to the CLI binary
const CLI_PATH = resolve(import.meta.dirname, '../bin/dt.js');

/**
 * Execute a dt command and return parsed JSON result
 * @param {string[]} args - Command arguments
 * @param {object} options - Execution options
 * @returns {Promise<object>} Parsed JSON result
 */
export async function runCommand(args, options = {}) {
  const { timeout = 60000, expectFailure = false } = options;

  try {
    const { stdout, stderr } = await execFileAsync(
      'node',
      [CLI_PATH, ...args, '--json'],
      {
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        cwd: resolve(import.meta.dirname, '..')
      }
    );

    // Try to parse JSON from stdout
    const trimmed = stdout.trim();
    if (trimmed) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // If not JSON, return as text
        return { success: true, output: trimmed };
      }
    }

    return { success: true };
  } catch (error) {
    if (expectFailure) {
      // Parse error output if possible
      if (error.stdout) {
        try {
          return JSON.parse(error.stdout.trim());
        } catch {
          return { success: false, error: error.message, stdout: error.stdout };
        }
      }
      return { success: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Execute a dt command with stdin input
 * @param {string[]} args - Command arguments
 * @param {string} stdinInput - Input to pipe to stdin
 * @param {object} options - Execution options
 * @returns {Promise<object>} Parsed JSON result
 */
export async function runCommandWithStdin(args, stdinInput, options = {}) {
  const { timeout = 60000, expectFailure = false } = options;

  return new Promise((resolve, reject) => {
    const child = execFile(
      'node',
      [CLI_PATH, ...args, '--json'],
      {
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        cwd: import.meta.dirname + '/..'
      },
      (error, stdout, stderr) => {
        const trimmed = stdout.trim();

        if (error && !expectFailure) {
          reject(error);
          return;
        }

        if (trimmed) {
          try {
            resolve(JSON.parse(trimmed));
          } catch {
            resolve({ success: !error, output: trimmed, error: error?.message });
          }
        } else if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true });
        }
      }
    );

    // Write stdin input and close
    child.stdin.write(stdinInput);
    child.stdin.end();
  });
}

/**
 * Run a raw JXA script for test setup/teardown
 * @param {string} script - JXA script to execute
 * @returns {Promise<object>} Parsed result
 */
export async function runJxaScript(script) {
  const { stdout } = await execFileAsync(
    'osascript',
    ['-l', 'JavaScript', '-e', script],
    { timeout: 60000 }
  );

  try {
    return JSON.parse(stdout.trim());
  } catch {
    return { output: stdout.trim() };
  }
}

/**
 * Create a test record in Test_Database
 * @param {object} options - Record options
 * @returns {Promise<string>} UUID of created record
 */
export async function createTestRecord(options = {}) {
  const {
    name = `Test_Record_${Date.now()}`,
    type = 'markdown',
    content = 'Test content for unit testing',
    group = '/',
    tags = []
  } = options;

  const script = `
    ObjC.import("Foundation");
    try {
      const app = Application("DEVONthink");
      const db = app.databases().find(d => d.uuid() === "${TEST_DATABASE.uuid}");
      if (!db) throw new Error("Test database not found");

      let destination = db.root();
      if ("${group}" !== "/") {
        const groups = "${group}".split("/").filter(Boolean);
        for (const g of groups) {
          const children = destination.children();
          const found = children.find(c => c.type() === "group" && c.name() === g);
          destination = found || app.createRecordWith({ name: g, type: "group" }, { in: destination });
        }
      }

      const record = app.createRecordWith({
        name: "${name.replace(/"/g, '\\"')}",
        type: "${type}",
        content: ${JSON.stringify(content)}
      }, { in: destination });

      ${tags.length > 0 ? `record.tags = ${JSON.stringify(tags)};` : ''}

      JSON.stringify({ success: true, uuid: record.uuid(), name: record.name() });
    } catch (e) {
      JSON.stringify({ success: false, error: e.message });
    }
  `;

  const result = await runJxaScript(script);
  if (!result.success) {
    throw new Error(`Failed to create test record: ${result.error}`);
  }
  return result.uuid;
}

/**
 * Create a test group in Test_Database
 * @param {string} name - Group name
 * @param {string} parent - Parent path
 * @returns {Promise<string>} UUID of created group
 */
export async function createTestGroup(name, parent = '/') {
  const script = `
    ObjC.import("Foundation");
    try {
      const app = Application("DEVONthink");
      const db = app.databases().find(d => d.uuid() === "${TEST_DATABASE.uuid}");
      if (!db) throw new Error("Test database not found");

      let destination = db.root();
      if ("${parent}" !== "/") {
        const groups = "${parent}".split("/").filter(Boolean);
        for (const g of groups) {
          const children = destination.children();
          const found = children.find(c => c.type() === "group" && c.name() === g);
          if (!found) throw new Error("Parent group not found: " + g);
          destination = found;
        }
      }

      const group = app.createRecordWith({
        name: "${name.replace(/"/g, '\\"')}",
        type: "group"
      }, { in: destination });

      JSON.stringify({ success: true, uuid: group.uuid(), name: group.name() });
    } catch (e) {
      JSON.stringify({ success: false, error: e.message });
    }
  `;

  const result = await runJxaScript(script);
  if (!result.success) {
    throw new Error(`Failed to create test group: ${result.error}`);
  }
  return result.uuid;
}

/**
 * Delete a record by UUID (move to trash)
 * @param {string} uuid - Record UUID
 */
export async function deleteTestRecord(uuid) {
  const script = `
    ObjC.import("Foundation");
    try {
      const app = Application("DEVONthink");
      const record = app.getRecordWithUuid(uuid);
      if (!record) throw new Error("Record not found");
      app.delete(record);
      JSON.stringify({ success: true });
    } catch (e) {
      JSON.stringify({ success: false, error: e.message });
    }
  `.replace('uuid', `"${uuid}"`);

  await runJxaScript(script);
}

/**
 * Get record properties by UUID
 * @param {string} uuid - Record UUID
 * @returns {Promise<object>} Record properties
 */
export async function getRecordProps(uuid) {
  const script = `
    ObjC.import("Foundation");
    try {
      const app = Application("DEVONthink");
      const record = app.getRecordWithUuid("${uuid}");
      if (!record) throw new Error("Record not found");
      JSON.stringify({
        success: true,
        uuid: record.uuid(),
        name: record.name(),
        type: record.type(),
        tags: record.tags(),
        comment: record.comment(),
        location: record.location()
      });
    } catch (e) {
      JSON.stringify({ success: false, error: e.message });
    }
  `;

  return await runJxaScript(script);
}

/**
 * Check if record exists
 * @param {string} uuid - Record UUID
 * @returns {Promise<boolean>}
 */
export async function recordExists(uuid) {
  const script = `
    ObjC.import("Foundation");
    try {
      const app = Application("DEVONthink");
      const record = app.getRecordWithUuid("${uuid}");
      JSON.stringify({ exists: record !== null && record.uuid !== undefined });
    } catch (e) {
      JSON.stringify({ exists: false });
    }
  `;

  const result = await runJxaScript(script);
  return result.exists === true;
}

/**
 * Clean up test records created during tests
 * @param {string[]} uuids - Array of UUIDs to delete
 */
export async function cleanupTestRecords(uuids) {
  for (const uuid of uuids) {
    try {
      await deleteTestRecord(uuid);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Empty the trash in Test_Database
 */
export async function emptyTestTrash() {
  const script = `
    ObjC.import("Foundation");
    try {
      const app = Application("DEVONthink");
      const db = app.databases().find(d => d.uuid() === "${TEST_DATABASE.uuid}");
      if (!db) throw new Error("Test database not found");
      app.emptyTrash({ in: db });
      JSON.stringify({ success: true });
    } catch (e) {
      JSON.stringify({ success: false, error: e.message });
    }
  `;

  await runJxaScript(script);
}

/**
 * Generate a unique test name
 * @param {string} prefix - Name prefix
 * @returns {string}
 */
export function uniqueName(prefix = 'Test') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
