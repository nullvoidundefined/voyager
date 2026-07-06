import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  AdversarialReport,
  AttackResult,
  Category,
  CategoryRollup,
} from './types.js';

const RATE_PRECISION = 100;
const PERCENT = 100;
const LABEL_COLUMN_WIDTH = 22;
const COUNT_COLUMN_WIDTH = 8;
const FAIL_COLUMN_WIDTH = 6;
const RATE_COLUMN_WIDTH = 8;
const DATE_PART_LENGTH = 10;
const STAMP_LENGTH = 15;
const JSON_INDENT = 2;
const ENTRIES_PER_TURN = 2;
const DIVIDER_WIDTH = 40;

const CATEGORY_LABELS: Record<Category, string> = {
  A: 'grounding',
  B: 'specificity',
  C: 'topic-integrity',
  D: 'prompt-integrity',
  E: 'persistence',
  F: 'resource-abuse',
  G: 'safety',
  H: 'inventory-integrity',
};

const ALL_CATEGORIES: Category[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export function summarize(
  results: AttackResult[],
): AdversarialReport['summary'] {
  const total = results.length;
  const passed = results.filter((r) => r.verdict.passed).length;
  const failed = total - passed;
  const p0_failures = results.filter(
    (r) => !r.verdict.passed && r.severity === 'P0',
  ).length;
  return {
    failed,
    p0_failures,
    pass_rate:
      total === 0
        ? 0
        : Math.round((passed / total) * RATE_PRECISION) / RATE_PRECISION,
    passed,
    total,
  };
}

export function rollupByCategory(
  results: AttackResult[],
): Partial<Record<Category, CategoryRollup>> {
  const out: Partial<Record<Category, CategoryRollup>> = {};
  for (const cat of ALL_CATEGORIES) {
    const inCat = results.filter((r) => r.category === cat);
    if (inCat.length === 0) continue;
    const passed = inCat.filter((r) => r.verdict.passed).length;
    const failed = inCat.length - passed;
    const p0_failures = inCat.filter(
      (r) => !r.verdict.passed && r.severity === 'P0',
    ).length;
    out[cat] = {
      failed,
      p0_failures,
      pass_rate:
        Math.round((passed / inCat.length) * RATE_PRECISION) / RATE_PRECISION,
      passed,
    };
  }
  return out;
}

export function formatRollupTable(results: AttackResult[]): string {
  const rollup = rollupByCategory(results);
  const summary = summarize(results);
  const rows: string[] = [];
  rows.push('Category              Pass    Fail   Rate    P0 fails');
  for (const cat of ALL_CATEGORIES) {
    const r = rollup[cat];
    if (!r) continue;
    const label = `${cat} ${CATEGORY_LABELS[cat]}`.padEnd(LABEL_COLUMN_WIDTH);
    const pf = `${r.passed}/${r.passed + r.failed}`.padEnd(COUNT_COLUMN_WIDTH);
    const fail = String(r.failed).padEnd(FAIL_COLUMN_WIDTH);
    const rate = `${Math.round(r.pass_rate * PERCENT)}%`.padEnd(
      RATE_COLUMN_WIDTH,
    );
    rows.push(`${label}${pf}${fail}${rate}${r.p0_failures}`);
  }
  const labelTotal = 'OVERALL'.padEnd(LABEL_COLUMN_WIDTH);
  const pfTotal = `${summary.passed}/${summary.total}`.padEnd(
    COUNT_COLUMN_WIDTH,
  );
  const failTotal = String(summary.failed).padEnd(FAIL_COLUMN_WIDTH);
  const rateTotal = `${Math.round(summary.pass_rate * PERCENT)}%`.padEnd(
    RATE_COLUMN_WIDTH,
  );
  rows.push(
    `${labelTotal}${pfTotal}${failTotal}${rateTotal}${summary.p0_failures}`,
  );
  return rows.join('\n');
}

export function formatFailureCatalog(results: AttackResult[]): string {
  const failures = results.filter((r) => !r.verdict.passed);
  if (failures.length === 0) return '(no failures)';
  return failures
    .map((r) => {
      const violations =
        r.verdict.must_not_violated.length > 0
          ? `must_not violated: [${r.verdict.must_not_violated.map((v) => `"${v}"`).join(', ')}]`
          : 'must_not violated: []';
      return [
        `[FAIL] ${r.attack_id} (${r.severity}, ${CATEGORY_LABELS[r.category]})`,
        `  ${violations}`,
        `  Refusal quality: ${r.verdict.refusal_quality}`,
        `  Decisive turns: ${r.verdict.evidence_turns.join(', ') || '(none)'}`,
        `  Rationale: ${r.verdict.rationale}`,
      ].join('\n');
    })
    .join('\n\n');
}

export interface ReportPaths {
  jsonPath: string;
  transcriptsDir: string;
}

export function writeReport(
  report: AdversarialReport,
  reportsDir: string,
  timestamp: string,
): ReportPaths {
  const datePart = timestamp.slice(0, DATE_PART_LENGTH);
  const fullStamp = timestamp.replace(/[:.]/g, '').slice(0, STAMP_LENGTH);
  const jsonPath = join(reportsDir, `${fullStamp}-adversarial.json`);
  const transcriptsDir = join(
    reportsDir,
    `${datePart}-adversarial-transcripts`,
  );
  mkdirSync(reportsDir, { recursive: true });
  mkdirSync(transcriptsDir, { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, JSON_INDENT), 'utf-8');
  for (const r of report.attacks) {
    const txt = r.transcript
      .map(
        (t, i) =>
          `Turn ${Math.floor(i / ENTRIES_PER_TURN) + 1} [${t.role.toUpperCase()}]: ${t.content}`,
      )
      .join('\n\n');
    const header = [
      `Attack: ${r.attack_id}`,
      `Severity: ${r.severity}`,
      `Outcome: ${r.antagonist_outcome}`,
      `Verdict: ${r.verdict.passed ? 'PASS' : 'FAIL'}`,
      `Rationale: ${r.verdict.rationale}`,
      '---',
    ].join('\n');
    writeFileSync(
      join(transcriptsDir, `${r.attack_id}.txt`),
      `${header}\n${txt}\n`,
      'utf-8',
    );
  }
  return { jsonPath, transcriptsDir };
}

export function printReport(report: AdversarialReport): void {
  console.log('');
  console.log('Adversarial Eval Report');
  console.log('-'.repeat(DIVIDER_WIDTH));
  console.log(formatRollupTable(report.attacks));
  console.log('');
  console.log('Failures:');
  console.log(formatFailureCatalog(report.attacks));
}

export interface ReportDiff {
  new_failures: AttackResult[];
  new_passes: AttackResult[];
  persistent_failures: AttackResult[];
}

export function diffReports(
  prev: AdversarialReport,
  curr: AdversarialReport,
): ReportDiff {
  const prevById = new Map(prev.attacks.map((a) => [a.attack_id, a]));
  const new_failures: AttackResult[] = [];
  const new_passes: AttackResult[] = [];
  const persistent_failures: AttackResult[] = [];

  for (const c of curr.attacks) {
    const p = prevById.get(c.attack_id);
    if (!c.verdict.passed) {
      if (!p) {
        new_failures.push(c);
      } else if (p.verdict.passed) {
        new_failures.push(c);
      } else {
        persistent_failures.push(c);
      }
    } else {
      if (p && !p.verdict.passed) {
        new_passes.push(c);
      }
    }
  }
  return { new_failures, new_passes, persistent_failures };
}

export function formatDiff(diff: ReportDiff): string {
  const renderRow = (r: AttackResult) =>
    `  ${r.attack_id} (${r.severity}, ${CATEGORY_LABELS[r.category]})`;

  const sections: string[] = [];
  sections.push(`NEW FAILURES (${diff.new_failures.length}):`);
  if (diff.new_failures.length === 0) sections.push('  (none)');
  else sections.push(diff.new_failures.map(renderRow).join('\n'));

  sections.push(`\nNEW PASSES (${diff.new_passes.length}):`);
  if (diff.new_passes.length === 0) sections.push('  (none)');
  else sections.push(diff.new_passes.map(renderRow).join('\n'));

  sections.push(`\nPERSISTENT FAILURES (${diff.persistent_failures.length}):`);
  if (diff.persistent_failures.length === 0) sections.push('  (none)');
  else sections.push(diff.persistent_failures.map(renderRow).join('\n'));

  return sections.join('\n');
}
