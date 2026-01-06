/**
 * Tag Rules Loader
 * Loads and merges tag normalization rules from config hierarchy
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

// Config paths
const CONFIG_DIR = join(homedir(), '.config', 'dt');
const GLOBAL_RULES_PATH = join(CONFIG_DIR, 'tag-rules.yaml');
const DATABASES_DIR = join(CONFIG_DIR, 'databases');

/**
 * Convert database name to slug for filename
 */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

/**
 * Load a YAML file if it exists
 */
async function loadYamlFile(path) {
  if (!existsSync(path)) {
    return null;
  }
  const content = await readFile(path, 'utf8');
  return parseYaml(content);
}

/**
 * Load rules from the config hierarchy
 * Priority: explicit file > database-specific > global
 */
export async function loadRules(options = {}) {
  const { database, rulesFile, noGlobal } = options;

  let rules = createEmptyRules();

  // 1. Load global rules (unless --no-global)
  if (!noGlobal) {
    const globalRules = await loadYamlFile(GLOBAL_RULES_PATH);
    if (globalRules) {
      rules = mergeRules(rules, globalRules);
    }
  }

  // 2. Load database-specific rules
  if (database && !rulesFile) {
    const dbSlug = slugify(database);
    const dbRulesPath = join(DATABASES_DIR, `${dbSlug}.yaml`);
    const dbRules = await loadYamlFile(dbRulesPath);
    if (dbRules) {
      rules = mergeRules(rules, dbRules);
    }
  }

  // 3. Load explicit rules file (overrides hierarchy)
  if (rulesFile) {
    const explicitRules = await loadYamlFile(rulesFile);
    if (!explicitRules) {
      throw new Error(`Rules file not found: ${rulesFile}`);
    }
    // If explicit file has extends: none, start fresh
    if (explicitRules.extends === 'none') {
      rules = createEmptyRules();
    }
    rules = mergeRules(rules, explicitRules);
  }

  return rules;
}

/**
 * Create empty rules structure
 */
function createEmptyRules() {
  return {
    version: 1,
    case: { strategy: 'preserve' },
    merges: [],
    renames: [],
    deletions: [],
    patterns: [],
    blocklist: [],
    preserve: []
  };
}

/**
 * Merge two rule sets (later rules override earlier)
 */
function mergeRules(base, overlay) {
  const merged = { ...base };

  // Version
  if (overlay.version) {
    merged.version = overlay.version;
  }

  // Case strategy (override)
  if (overlay.case) {
    merged.case = { ...merged.case, ...overlay.case };
  }

  // Merges (append, dedup by target)
  if (overlay.merges && Array.isArray(overlay.merges)) {
    const existingTargets = new Set(merged.merges.map(m => m.target));
    for (const merge of overlay.merges) {
      if (existingTargets.has(merge.target)) {
        // Override existing merge for same target
        const idx = merged.merges.findIndex(m => m.target === merge.target);
        merged.merges[idx] = merge;
      } else {
        merged.merges.push(merge);
      }
    }
  }

  // Renames (append, dedup by from)
  if (overlay.renames && Array.isArray(overlay.renames)) {
    const existingFroms = new Set(merged.renames.map(r => r.from));
    for (const rename of overlay.renames) {
      if (existingFroms.has(rename.from)) {
        const idx = merged.renames.findIndex(r => r.from === rename.from);
        merged.renames[idx] = rename;
      } else {
        merged.renames.push(rename);
      }
    }
  }

  // Deletions (append, dedup)
  if (overlay.deletions && Array.isArray(overlay.deletions)) {
    const existingDeletions = new Set(merged.deletions);
    for (const tag of overlay.deletions) {
      if (!existingDeletions.has(tag)) {
        merged.deletions.push(tag);
      }
    }
  }

  // Blocklist (append, dedup)
  if (overlay.blocklist && Array.isArray(overlay.blocklist)) {
    const existingBlocklist = new Set(merged.blocklist);
    for (const tag of overlay.blocklist) {
      if (!existingBlocklist.has(tag)) {
        merged.blocklist.push(tag);
      }
    }
  }

  // Patterns (append)
  if (overlay.patterns && Array.isArray(overlay.patterns)) {
    merged.patterns = [...merged.patterns, ...overlay.patterns];
  }

  // Preserve list (append, dedup)
  if (overlay.preserve && Array.isArray(overlay.preserve)) {
    const existingPreserve = new Set(merged.preserve);
    for (const tag of overlay.preserve) {
      if (!existingPreserve.has(tag)) {
        merged.preserve.push(tag);
      }
    }
  }

  return merged;
}

/**
 * Plan changes based on rules and current tags
 * Returns a list of operations to perform
 */
export function planChanges(tags, rules) {
  const changes = [];
  const preserveSet = new Set(rules.preserve.map(t => t.toLowerCase()));
  const tagMap = new Map(tags.map(t => [t.tag, t.count]));
  const tagNames = new Set(tags.map(t => t.tag));

  // Track tags that will be affected to avoid conflicts
  const affectedTags = new Set();

  // 1. Case normalization
  if (rules.case.strategy && rules.case.strategy !== 'preserve') {
    const caseGroups = new Map();

    for (const tag of tagNames) {
      const lower = tag.toLowerCase();
      if (!caseGroups.has(lower)) {
        caseGroups.set(lower, []);
      }
      caseGroups.get(lower).push(tag);
    }

    for (const [canonical, variants] of caseGroups) {
      if (variants.length > 1) {
        // Skip if any variant is preserved
        if (variants.some(v => preserveSet.has(v.toLowerCase()))) continue;

        // Pick target based on strategy
        let target;
        switch (rules.case.strategy) {
          case 'lowercase':
            target = canonical;
            break;
          case 'uppercase':
            target = canonical.toUpperCase();
            break;
          case 'titlecase':
            target = canonical.replace(/\b\w/g, c => c.toUpperCase());
            break;
          default:
            // preserve_first: keep the most-used variant
            target = variants.sort((a, b) => (tagMap.get(b) || 0) - (tagMap.get(a) || 0))[0];
        }

        const sources = variants.filter(v => v !== target);
        if (sources.length > 0) {
          // Check if target exists, if not we need to rename the first source
          const targetExists = tagNames.has(target);
          if (!targetExists) {
            // Rename first source to target, then merge rest
            const [firstSource, ...restSources] = sources;
            changes.push({
              action: 'rename',
              from: firstSource,
              to: target,
              affectedRecords: tagMap.get(firstSource) || 0,
              reason: 'case_normalization'
            });
            affectedTags.add(firstSource);

            if (restSources.length > 0) {
              changes.push({
                action: 'merge',
                target,
                sources: restSources,
                affectedRecords: restSources.reduce((sum, s) => sum + (tagMap.get(s) || 0), 0),
                reason: 'case_normalization'
              });
              restSources.forEach(s => affectedTags.add(s));
            }
          } else {
            changes.push({
              action: 'merge',
              target,
              sources,
              affectedRecords: sources.reduce((sum, s) => sum + (tagMap.get(s) || 0), 0),
              reason: 'case_normalization'
            });
            sources.forEach(s => affectedTags.add(s));
          }
        }
      }
    }
  }

  // 2. Explicit merges
  for (const merge of rules.merges) {
    const { target, sources } = merge;

    // Skip if target is preserved
    if (preserveSet.has(target.toLowerCase())) continue;

    // Filter sources to only those that exist and aren't preserved, already affected, or the target itself
    const validSources = sources.filter(s =>
      s !== target &&
      tagNames.has(s) &&
      !preserveSet.has(s.toLowerCase()) &&
      !affectedTags.has(s)
    );

    if (validSources.length > 0) {
      // Check if target exists
      const targetExists = tagNames.has(target);

      if (!targetExists && validSources.length > 0) {
        // Rename first source to target, merge rest
        const [firstSource, ...restSources] = validSources;
        changes.push({
          action: 'rename',
          from: firstSource,
          to: target,
          affectedRecords: tagMap.get(firstSource) || 0,
          reason: 'explicit_merge'
        });
        affectedTags.add(firstSource);

        if (restSources.length > 0) {
          changes.push({
            action: 'merge',
            target,
            sources: restSources,
            affectedRecords: restSources.reduce((sum, s) => sum + (tagMap.get(s) || 0), 0),
            reason: 'explicit_merge'
          });
          restSources.forEach(s => affectedTags.add(s));
        }
      } else if (targetExists) {
        changes.push({
          action: 'merge',
          target,
          sources: validSources,
          affectedRecords: validSources.reduce((sum, s) => sum + (tagMap.get(s) || 0), 0),
          reason: 'explicit_merge'
        });
        validSources.forEach(s => affectedTags.add(s));
      }
    }
  }

  // 3. Explicit renames
  for (const rename of rules.renames) {
    const { from, to } = rename;

    // Skip if source doesn't exist, is preserved, or already affected
    if (!tagNames.has(from) || preserveSet.has(from.toLowerCase()) || affectedTags.has(from)) {
      continue;
    }

    // Skip if target already exists (would need merge instead)
    if (tagNames.has(to)) {
      continue;
    }

    changes.push({
      action: 'rename',
      from,
      to,
      affectedRecords: tagMap.get(from) || 0,
      reason: 'explicit_rename'
    });
    affectedTags.add(from);
  }

  // 4. Pattern-based fixes
  for (const pattern of rules.patterns) {
    const regex = new RegExp(pattern.match);

    for (const tag of tagNames) {
      if (affectedTags.has(tag) || preserveSet.has(tag.toLowerCase())) continue;

      if (regex.test(tag)) {
        let newTag;
        switch (pattern.action) {
          case 'strip':
            newTag = tag.replace(regex, '');
            break;
          case 'trim':
            newTag = tag.trim();
            break;
          case 'delete':
            changes.push({
              action: 'delete',
              tag,
              affectedRecords: tagMap.get(tag) || 0,
              reason: 'pattern_match'
            });
            affectedTags.add(tag);
            continue;
          default:
            continue;
        }

        if (newTag && newTag !== tag && newTag.length > 0) {
          // Check if cleaned tag exists
          if (tagNames.has(newTag)) {
            changes.push({
              action: 'merge',
              target: newTag,
              sources: [tag],
              affectedRecords: tagMap.get(tag) || 0,
              reason: 'pattern_cleanup'
            });
          } else {
            changes.push({
              action: 'rename',
              from: tag,
              to: newTag,
              affectedRecords: tagMap.get(tag) || 0,
              reason: 'pattern_cleanup'
            });
          }
          affectedTags.add(tag);
        }
      }
    }
  }

  // 5. Blocklist deletions
  const blocklist = new Set([...rules.blocklist, ...rules.deletions].map(t => t.toLowerCase()));

  for (const tag of tagNames) {
    if (affectedTags.has(tag) || preserveSet.has(tag.toLowerCase())) continue;

    if (blocklist.has(tag.toLowerCase())) {
      changes.push({
        action: 'delete',
        tag,
        affectedRecords: tagMap.get(tag) || 0,
        reason: 'blocklist'
      });
      affectedTags.add(tag);
    }
  }

  // Calculate summary
  const summary = {
    merges: changes.filter(c => c.action === 'merge').length,
    renames: changes.filter(c => c.action === 'rename').length,
    deletes: changes.filter(c => c.action === 'delete').length,
    totalAffectedRecords: changes.reduce((sum, c) => sum + c.affectedRecords, 0)
  };

  return { changes, summary };
}

/**
 * Get config directory path
 */
export function getConfigDir() {
  return CONFIG_DIR;
}

/**
 * Get global rules path
 */
export function getGlobalRulesPath() {
  return GLOBAL_RULES_PATH;
}

/**
 * Get database-specific rules path
 */
export function getDatabaseRulesPath(database) {
  return join(DATABASES_DIR, `${slugify(database)}.yaml`);
}
