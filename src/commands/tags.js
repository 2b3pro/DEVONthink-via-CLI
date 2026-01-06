/**
 * Tags Command
 * Tag analysis and normalization for DEVONthink databases
 * @version 1.0.0
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { ML_ARTIFACT_BLOCKLIST, SCANNER_BLOCKLIST, NOISE_BLOCKLIST } from '../data/tag-blocklists.js';
import { loadRules, planChanges, getConfigDir, getGlobalRulesPath, getDatabaseRulesPath } from '../rules-loader.js';
import { addTasks } from '../queue.js';

/**
 * Normalize a tag for comparison (lowercase, strip punctuation/spaces)
 */
function normalizeForComparison(tag) {
  return tag.toLowerCase().replace(/[-_\s]/g, '');
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Detect problems in tags
 */
function analyzeTagProblems(tags, options = {}) {
  const problems = {
    case: [],
    malformed: [],
    punctuationVariants: [],
    mlArtifacts: [],
    scannerArtifacts: [],
    noise: [],
    lowUsage: []
  };

  const tagMap = new Map(tags.map(t => [t.tag, t.count]));
  const tagList = tags.map(t => t.tag);

  // 1. Case variant detection - group by lowercase
  const caseGroups = new Map();
  for (const { tag, count } of tags) {
    const lower = tag.toLowerCase();
    if (!caseGroups.has(lower)) {
      caseGroups.set(lower, []);
    }
    caseGroups.get(lower).push({ tag, count });
  }

  for (const [canonical, variants] of caseGroups) {
    if (variants.length > 1) {
      const totalRecords = variants.reduce((sum, v) => sum + v.count, 0);
      // Pick the most used variant as canonical, or lowercase
      const sorted = [...variants].sort((a, b) => b.count - a.count);
      problems.case.push({
        canonical: sorted[0].tag,
        variants: variants.map(v => v.tag),
        counts: Object.fromEntries(variants.map(v => [v.tag, v.count])),
        totalRecords,
        suggestion: 'merge_to_most_used'
      });
    }
  }

  // 2. Malformed detection
  for (const { tag, count } of tags) {
    const issues = [];

    if (/^\s/.test(tag)) issues.push('leading_whitespace');
    if (/\s$/.test(tag)) issues.push('trailing_whitespace');
    if (/^[:\-_.]/.test(tag)) issues.push('leading_punctuation');
    if (/^\d+$/.test(tag)) issues.push('numeric_only');
    if (tag.length === 1) issues.push('single_character');
    if (/\s{2,}/.test(tag)) issues.push('multiple_spaces');

    if (issues.length > 0) {
      const suggested = tag.trim().replace(/^[:\-_.\s]+/, '').replace(/\s{2,}/g, ' ');
      problems.malformed.push({
        tag,
        count,
        issues,
        suggestion: suggested !== tag ? suggested : 'review'
      });
    }
  }

  // 3. Punctuation variant detection (bow-tie vs bow tie vs bowtie)
  const punctuationGroups = new Map();
  for (const { tag, count } of tags) {
    const normalized = normalizeForComparison(tag);
    if (!punctuationGroups.has(normalized)) {
      punctuationGroups.set(normalized, []);
    }
    punctuationGroups.get(normalized).push({ tag, count });
  }

  for (const [normalized, variants] of punctuationGroups) {
    // Only report if there are actual different tags (not just case variants which are caught above)
    const uniqueLower = new Set(variants.map(v => v.tag.toLowerCase()));
    if (uniqueLower.size > 1) {
      const totalRecords = variants.reduce((sum, v) => sum + v.count, 0);
      const sorted = [...variants].sort((a, b) => b.count - a.count);
      problems.punctuationVariants.push({
        normalized,
        variants: variants.map(v => v.tag),
        counts: Object.fromEntries(variants.map(v => [v.tag, v.count])),
        totalRecords,
        suggestion: sorted[0].tag
      });
    }
  }

  // 4. ML artifact detection (blocklist)
  const mlBlocklistLower = new Set(ML_ARTIFACT_BLOCKLIST.map(t => t.toLowerCase()));
  for (const { tag, count } of tags) {
    if (mlBlocklistLower.has(tag.toLowerCase())) {
      problems.mlArtifacts.push({
        tag,
        count,
        confidence: 0.95,
        suggestion: 'delete'
      });
    }
  }

  // 5. Scanner artifact detection
  const scannerBlocklistLower = new Set(SCANNER_BLOCKLIST.map(t => t.toLowerCase()));
  for (const { tag, count } of tags) {
    if (scannerBlocklistLower.has(tag.toLowerCase())) {
      problems.scannerArtifacts.push({
        tag,
        count,
        suggestion: 'delete_or_move_to_metadata'
      });
    }
  }

  // 6. Noise detection
  const noiseBlocklistLower = new Set(NOISE_BLOCKLIST.map(t => t.toLowerCase()));
  for (const { tag, count } of tags) {
    if (noiseBlocklistLower.has(tag.toLowerCase())) {
      problems.noise.push({
        tag,
        count,
        suggestion: 'delete'
      });
    }
  }

  // 7. Low usage detection
  const lowUsageThreshold = options.lowUsageThreshold || 1;
  for (const { tag, count } of tags) {
    if (count <= lowUsageThreshold) {
      // Skip if already categorized as ML artifact, scanner, or noise
      const alreadyCategorized =
        problems.mlArtifacts.some(p => p.tag === tag) ||
        problems.scannerArtifacts.some(p => p.tag === tag) ||
        problems.noise.some(p => p.tag === tag);

      if (!alreadyCategorized) {
        problems.lowUsage.push({
          tag,
          count,
          suggestion: 'review'
        });
      }
    }
  }

  // Calculate summary
  const summary = {
    totalProblems:
      problems.case.length +
      problems.malformed.length +
      problems.punctuationVariants.length +
      problems.mlArtifacts.length +
      problems.scannerArtifacts.length +
      problems.noise.length +
      problems.lowUsage.length,
    byCategory: {
      case: problems.case.length,
      malformed: problems.malformed.length,
      punctuationVariants: problems.punctuationVariants.length,
      mlArtifacts: problems.mlArtifacts.length,
      scannerArtifacts: problems.scannerArtifacts.length,
      noise: problems.noise.length,
      lowUsage: problems.lowUsage.length
    }
  };

  return { problems, summary };
}

/**
 * Generate YAML rules file from analysis
 */
function generateRulesYaml(analysis, database) {
  const lines = [
    '# Auto-generated tag normalization rules',
    `# Database: ${database}`,
    `# Generated: ${new Date().toISOString()}`,
    'version: 1',
    '',
    '# Case normalization',
    'case:',
    '  strategy: lowercase  # lowercase | uppercase | titlecase | preserve',
    ''
  ];

  // Merges from case variants
  if (analysis.problems.case.length > 0) {
    lines.push('# Case variant merges');
    lines.push('merges:');
    for (const problem of analysis.problems.case) {
      const target = problem.canonical.toLowerCase();
      const sources = problem.variants.filter(v => v.toLowerCase() !== target);
      if (sources.length > 0) {
        lines.push(`  - target: "${target}"`);
        lines.push(`    sources: [${sources.map(s => `"${s}"`).join(', ')}]`);
      }
    }
    lines.push('');
  }

  // Merges from punctuation variants
  if (analysis.problems.punctuationVariants.length > 0) {
    lines.push('# Punctuation variant merges');
    if (analysis.problems.case.length === 0) lines.push('merges:');
    for (const problem of analysis.problems.punctuationVariants) {
      const target = problem.suggestion;
      const sources = problem.variants.filter(v => v !== target);
      if (sources.length > 0) {
        lines.push(`  - target: "${target}"`);
        lines.push(`    sources: [${sources.map(s => `"${s}"`).join(', ')}]`);
      }
    }
    lines.push('');
  }

  // Deletions
  const deleteTags = [
    ...analysis.problems.mlArtifacts.map(p => p.tag),
    ...analysis.problems.scannerArtifacts.map(p => p.tag),
    ...analysis.problems.noise.map(p => p.tag)
  ];

  if (deleteTags.length > 0) {
    lines.push('# Tags to delete');
    lines.push('deletions:');
    for (const tag of deleteTags) {
      lines.push(`  - "${tag}"`);
    }
    lines.push('');
  }

  // Malformed fixes
  const fixes = analysis.problems.malformed.filter(p => p.suggestion !== 'review');
  if (fixes.length > 0) {
    lines.push('# Malformed tag fixes');
    lines.push('renames:');
    for (const fix of fixes) {
      lines.push(`  - from: "${fix.tag}"`);
      lines.push(`    to: "${fix.suggestion}"`);
    }
    lines.push('');
  }

  // Low usage (commented out for review)
  if (analysis.problems.lowUsage.length > 0) {
    lines.push('# Low usage tags (uncomment to delete after review)');
    lines.push('# low_usage_deletions:');
    for (const problem of analysis.problems.lowUsage.slice(0, 50)) {
      lines.push(`#   - "${problem.tag}"  # count: ${problem.count}`);
    }
    if (analysis.problems.lowUsage.length > 50) {
      lines.push(`#   # ... and ${analysis.problems.lowUsage.length - 50} more`);
    }
  }

  return lines.join('\n');
}

export function registerTagsCommand(program) {
  const tags = program
    .command('tags')
    .description('Tag analysis and normalization');

  // dt tags list
  tags
    .command('list')
    .alias('ls')
    .description('List all tags in a database with usage counts')
    .option('-d, --database <name>', 'Target database (name or UUID)')
    .option('-s, --sort <method>', 'Sort by: alpha (default), count', 'alpha')
    .option('-m, --min-count <n>', 'Only show tags used N or more times', parseInt)
    .option('-f, --format <format>', 'Output format: json (default), csv, plain', 'json')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output tag names (one per line)')
    .action(async (options) => {
      try {
        await requireDevonthink();

        const params = {
          database: options.database,
          sort: options.sort,
          minCount: options.minCount || 1
        };

        const result = await runJxa('read', 'listTags', [JSON.stringify(params)]);

        if (!result.success) {
          printError(result, options);
          process.exit(1);
        }

        if (options.quiet) {
          console.log(result.tags.map(t => t.tag).join('\n'));
        } else if (options.format === 'csv') {
          console.log('tag,count');
          for (const { tag, count } of result.tags) {
            // Escape quotes and wrap in quotes if contains comma
            const escaped = tag.includes(',') || tag.includes('"')
              ? `"${tag.replace(/"/g, '""')}"`
              : tag;
            console.log(`${escaped},${count}`);
          }
        } else if (options.format === 'plain') {
          const maxTagLen = Math.max(...result.tags.map(t => t.tag.length));
          for (const { tag, count } of result.tags) {
            console.log(`${tag.padEnd(maxTagLen + 2)}${count}`);
          }
          console.log(`\nTotal: ${result.totalTags} tags, ${result.totalTagInstances} instances`);
        } else {
          print(result, options);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt tags analyze
  tags
    .command('analyze')
    .description('Analyze tags for problems (case variants, duplicates, junk)')
    .option('-d, --database <name>', 'Target database (name or UUID)')
    .option('-c, --category <cat>', 'Only show specific category: case, malformed, punctuation, ml, scanner, noise, low-usage')
    .option('--low-usage <n>', 'Threshold for low-usage detection (default: 1)', parseInt, 1)
    .option('-e, --export <file>', 'Export results as YAML rules file')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output problem counts')
    .action(async (options) => {
      try {
        await requireDevonthink();

        // First, get all tags
        const params = {
          database: options.database,
          sort: 'alpha',
          minCount: 1
        };

        const listResult = await runJxa('read', 'listTags', [JSON.stringify(params)]);

        if (!listResult.success) {
          printError(listResult, options);
          process.exit(1);
        }

        // Analyze tags
        const analysis = analyzeTagProblems(listResult.tags, {
          lowUsageThreshold: options.lowUsage
        });

        // Filter by category if specified
        if (options.category) {
          const categoryMap = {
            'case': 'case',
            'malformed': 'malformed',
            'punctuation': 'punctuationVariants',
            'ml': 'mlArtifacts',
            'scanner': 'scannerArtifacts',
            'noise': 'noise',
            'low-usage': 'lowUsage'
          };
          const key = categoryMap[options.category];
          if (!key) {
            console.error(`Unknown category: ${options.category}`);
            console.error('Valid categories: case, malformed, punctuation, ml, scanner, noise, low-usage');
            process.exit(1);
          }
          analysis.problems = { [key]: analysis.problems[key] };
          analysis.summary = {
            totalProblems: analysis.problems[key].length,
            byCategory: { [key]: analysis.problems[key].length }
          };
        }

        // Export to YAML if requested
        if (options.export) {
          const yaml = generateRulesYaml(analysis, listResult.database);
          const fs = await import('fs/promises');
          await fs.writeFile(options.export, yaml, 'utf8');
          console.log(`Rules exported to: ${options.export}`);
        }

        // Output
        const result = {
          success: true,
          database: listResult.database,
          totalTags: listResult.totalTags,
          ...analysis
        };

        if (options.quiet) {
          console.log(`Problems found: ${analysis.summary.totalProblems}`);
          for (const [cat, count] of Object.entries(analysis.summary.byCategory)) {
            if (count > 0) {
              console.log(`  ${cat}: ${count}`);
            }
          }
        } else {
          print(result, options);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt tags merge
  tags
    .command('merge')
    .description('Merge source tags into a target tag (uses native DEVONthink merge)')
    .requiredOption('-t, --target <tag>', 'Target tag name (will survive)')
    .requiredOption('-s, --sources <tags...>', 'Source tag names to merge into target')
    .option('-d, --database <name>', 'Target database (name or UUID)')
    .option('--queue', 'Add task to the execution queue instead of running immediately')
    .option('--dry-run', 'Preview changes without applying')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .action(async (options) => {
      try {
        if (options.queue) {
          const result = await addTasks([{
            action: 'tag.merge',
            params: {
              database: options.database,
              target: options.target,
              sources: options.sources
            }
          }]);
          print(result, options);
          return;
        }

        await requireDevonthink();

        const params = {
          database: options.database,
          target: options.target,
          sources: options.sources,
          dryRun: options.dryRun || false
        };

        const result = await runJxa('write', 'mergeTags', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          if (result.dryRun) {
            console.log(`Would merge ${result.sources.length} tags into "${result.target}"`);
          } else {
            console.log(`Merged ${result.sourcesMerged.length} tags into "${result.target}"`);
          }
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt tags rename
  tags
    .command('rename')
    .description('Rename a tag')
    .requiredOption('-f, --from <name>', 'Current tag name')
    .requiredOption('-t, --to <name>', 'New tag name')
    .option('-d, --database <name>', 'Target database (name or UUID)')
    .option('--queue', 'Add task to the execution queue instead of running immediately')
    .option('--dry-run', 'Preview changes without applying')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .action(async (options) => {
      try {
        if (options.queue) {
          const result = await addTasks([{
            action: 'tag.rename',
            params: {
              database: options.database,
              from: options.from,
              to: options.to
            }
          }]);
          print(result, options);
          return;
        }

        await requireDevonthink();

        const params = {
          database: options.database,
          from: options.from,
          to: options.to,
          dryRun: options.dryRun || false
        };

        const result = await runJxa('write', 'renameTags', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          if (result.dryRun) {
            console.log(`Would rename "${result.from}" to "${result.to}" (${result.recordCount} records)`);
          } else {
            console.log(`Renamed "${result.from}" to "${result.to}" (${result.recordCount} records)`);
          }
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt tags delete
  tags
    .command('delete')
    .description('Delete tags from database')
    .argument('<tags...>', 'Tag names to delete')
    .option('-d, --database <name>', 'Target database (name or UUID)')
    .option('--queue', 'Add task to the execution queue instead of running immediately')
    .option('--dry-run', 'Preview changes without applying')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .action(async (tagNames, options) => {
      try {
        if (options.queue) {
          const tasks = tagNames.map(tag => ({
            action: 'tag.delete',
            params: { database: options.database, tag }
          }));
          const result = await addTasks(tasks);
          print(result, options);
          return;
        }

        await requireDevonthink();

        const params = {
          database: options.database,
          tags: tagNames,
          dryRun: options.dryRun || false
        };

        const result = await runJxa('write', 'deleteTags', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          if (result.dryRun) {
            console.log(`Would delete ${result.tagsToDelete.length} tags (${result.totalRecordsAffected} records affected)`);
          } else {
            console.log(`Deleted ${result.totalDeleted} tags (${result.totalRecordsAffected} records affected)`);
          }
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt tags normalize
  tags
    .command('normalize')
    .description('Apply tag normalization rules in batch (dry-run by default)')
    .option('-d, --database <name>', 'Target database (name or UUID)')
    .option('-r, --rules <file>', 'Use specific rules file (overrides config hierarchy)')
    .option('--no-global', 'Skip global rules, use only explicit rules file')
    .option('--auto', 'Auto-generate rules from analysis (case, malformed, blocklist)')
    .option('--apply', 'Apply changes (default is dry-run)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .action(async (options) => {
      try {
        await requireDevonthink();

        // 1. Get current tags
        const listParams = {
          database: options.database,
          sort: 'alpha',
          minCount: 1
        };

        const listResult = await runJxa('read', 'listTags', [JSON.stringify(listParams)]);
        if (!listResult.success) {
          printError(listResult, options);
          process.exit(1);
        }

        // 2. Load or generate rules
        let rules;
        if (options.auto) {
          // Auto-generate rules from analysis
          const analysis = analyzeTagProblems(listResult.tags);
          rules = generateRulesFromAnalysis(analysis);
        } else {
          // Load from config hierarchy
          rules = await loadRules({
            database: listResult.database,
            rulesFile: options.rules,
            noGlobal: options.noGlobal
          });
        }

        // 3. Plan changes
        const plan = planChanges(listResult.tags, rules);

        // 4. Output dry-run or apply
        if (!options.apply) {
          // Dry-run output
          const result = {
            success: true,
            dryRun: true,
            database: listResult.database,
            rulesSource: options.rules || (options.auto ? 'auto-generated' : 'config'),
            ...plan
          };

          if (options.quiet) {
            console.log(`Would apply ${plan.changes.length} changes:`);
            console.log(`  Merges: ${plan.summary.merges}`);
            console.log(`  Renames: ${plan.summary.renames}`);
            console.log(`  Deletes: ${plan.summary.deletes}`);
            console.log(`  Records affected: ${plan.summary.totalAffectedRecords}`);
          } else {
            print(result, options);
          }
        } else {
          // Apply changes
          const results = {
            applied: [],
            errors: []
          };

          for (const change of plan.changes) {
            try {
              let opResult;
              switch (change.action) {
                case 'merge':
                  opResult = await runJxa('write', 'mergeTags', [JSON.stringify({
                    database: options.database,
                    target: change.target,
                    sources: change.sources
                  })]);
                  break;
                case 'rename':
                  opResult = await runJxa('write', 'renameTags', [JSON.stringify({
                    database: options.database,
                    from: change.from,
                    to: change.to
                  })]);
                  break;
                case 'delete':
                  opResult = await runJxa('write', 'deleteTags', [JSON.stringify({
                    database: options.database,
                    tags: [change.tag]
                  })]);
                  break;
              }

              if (opResult.success) {
                results.applied.push(change);
              } else {
                results.errors.push({ ...change, error: opResult.error });
              }
            } catch (e) {
              results.errors.push({ ...change, error: e.message });
            }
          }

          const result = {
            success: results.errors.length === 0,
            dryRun: false,
            database: listResult.database,
            applied: results.applied.length,
            errors: results.errors.length > 0 ? results.errors : undefined,
            summary: {
              merges: results.applied.filter(c => c.action === 'merge').length,
              renames: results.applied.filter(c => c.action === 'rename').length,
              deletes: results.applied.filter(c => c.action === 'delete').length,
              totalAffectedRecords: results.applied.reduce((sum, c) => sum + c.affectedRecords, 0),
              failed: results.errors.length
            }
          };

          if (options.quiet) {
            console.log(`Applied ${results.applied.length} changes:`);
            console.log(`  Merges: ${result.summary.merges}`);
            console.log(`  Renames: ${result.summary.renames}`);
            console.log(`  Deletes: ${result.summary.deletes}`);
            if (results.errors.length > 0) {
              console.log(`  Failed: ${results.errors.length}`);
            }
          } else {
            print(result, options);
          }

          if (!result.success) process.exit(1);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt tags config - show config paths
  tags
    .command('config')
    .description('Show tag rules configuration paths and status')
    .option('-d, --database <name>', 'Show database-specific config path')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (options) => {
      const { existsSync } = await import('fs');

      const globalPath = getGlobalRulesPath();
      const config = {
        configDir: getConfigDir(),
        globalRules: {
          path: globalPath,
          exists: existsSync(globalPath)
        }
      };

      if (options.database) {
        const dbPath = getDatabaseRulesPath(options.database);
        config.databaseRules = {
          database: options.database,
          path: dbPath,
          exists: existsSync(dbPath)
        };
      }

      print({ success: true, ...config }, options);
    });

  return tags;
}

/**
 * Generate rules from analysis results (for --auto mode)
 */
function generateRulesFromAnalysis(analysis) {
  const rules = {
    version: 1,
    case: { strategy: 'lowercase' },
    merges: [],
    renames: [],
    deletions: [],
    patterns: [
      { match: '^: ', action: 'strip' },
      { match: '^\\s+', action: 'trim' },
      { match: '\\s+$', action: 'trim' }
    ],
    blocklist: [
      ...ML_ARTIFACT_BLOCKLIST,
      ...SCANNER_BLOCKLIST,
      ...NOISE_BLOCKLIST
    ],
    preserve: []
  };

  // Add malformed tag renames
  for (const problem of analysis.problems.malformed) {
    if (problem.suggestion && problem.suggestion !== 'review') {
      rules.renames.push({
        from: problem.tag,
        to: problem.suggestion
      });
    }
  }

  return rules;
}
