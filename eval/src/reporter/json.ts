import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { EvalReport } from '../types.js';

const TIMESTAMP_LENGTH = 19;
const JSON_INDENT = 2;

export function writeJsonReport(report: EvalReport, outputDir: string): string {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = report.timestamp
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .slice(0, TIMESTAMP_LENGTH);
  const filename = `${timestamp}.json`;
  const filepath = join(outputDir, filename);

  writeFileSync(filepath, JSON.stringify(report, null, JSON_INDENT), 'utf-8');
  console.log(`Report saved to ${filepath}`);
  return filepath;
}
