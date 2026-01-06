/**
 * JXA Script Runner
 * Executes JXA scripts via osascript and returns parsed JSON results
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const JXA_DIR = resolve(__dirname, '..', 'jxa');

/**
 * Run a JXA script and return the parsed JSON result
 * @param {string} category - Script category (read, write, utils)
 * @param {string} scriptName - Script filename (without .js)
 * @param {string[]} args - Arguments to pass to the script
 * @returns {Promise<object>} Parsed JSON response
 */
export async function runJxa(category, scriptName, args = []) {
  const scriptPath = resolve(JXA_DIR, category, `${scriptName}.js`);
  const helpersPath = resolve(JXA_DIR, 'utils', 'helpers.js');

  try {
    const [scriptContent, helpersContent] = await Promise.all([
      readFile(scriptPath, 'utf8'),
      readFile(helpersPath, 'utf8')
    ]);

    const cleanHelpers = helpersContent.replace(/^(?:(?:\/\/.*|\s*)\r?\n)+/, ''); // Remove leading comments and empty lines
    const cleanScript = scriptContent.replace(/^#!.*\r?\n/, '');
    
    // Combine helpers and script
    const fullScript = `${cleanHelpers}\n${cleanScript}`;

    const { stdout, stderr } = await execFileAsync(
      'osascript',
      ['-l', 'JavaScript', '-e', fullScript, '--', ...args],
      {
        timeout: 60000, // 60 second timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large results
      }
    );

    // Parse JSON output
    const trimmed = stdout.trim();
    if (!trimmed) {
      return { success: false, error: 'Empty response from script' };
    }

    try {
      return JSON.parse(trimmed);
    } catch (parseError) {
      // If not valid JSON, return raw output
      return { success: true, raw: trimmed };
    }
  } catch (error) {
    // Handle execution errors
    if (error.killed) {
      return { success: false, error: 'Script timed out' };
    }
    if (error.code === 'ENOENT') {
      return { success: false, error: `Script not found: ${scriptPath}` };
    }

    // Try to parse stderr as JSON (some scripts output errors to stdout)
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout.trim());
      } catch {
        // Fall through to error handling
      }
    }

    return {
      success: false,
      error: error.message || 'Unknown error',
      stderr: error.stderr?.trim() || undefined
    };
  }
}

/**
 * Check if DEVONthink is running
 * @returns {Promise<boolean>}
 */
export async function isDevonthinkRunning() {
  const result = await runJxa('utils', 'isRunning');
  return result.success && result.running === true;
}

/**
 * Ensure DEVONthink is running before executing a command
 * @returns {Promise<void>}
 * @throws {Error} if DEVONthink is not running
 */
export async function requireDevonthink() {
  const running = await isDevonthinkRunning();
  if (!running) {
    const error = new Error('DEVONthink is not running. Please launch DEVONthink and try again.');
    error.code = 'DEVONTHINK_NOT_RUNNING';
    throw error;
  }
}
