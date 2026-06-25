/**
 * Resolves the deployed commit SHA reported by /health. Prefers Railway's
 * injected RAILWAY_GIT_COMMIT_SHA, which is set on every git-sourced deploy with
 * no build or pre-deploy step required, so the reported commit is correct
 * regardless of how the deploy was triggered. Falls back to the version.json
 * stamp written by scripts/deploy.sh (for manual `railway up`), then 'unknown'.
 * Issue #59: a raw `railway up` left version.json stale and /health reported the
 * wrong commit; preferring the env var removes that dependency.
 */
import fs from 'node:fs';

const UNKNOWN_COMMIT = 'unknown';

export function readDeployedCommit(versionFilePath: string): string {
  const fromEnv = process.env.RAILWAY_GIT_COMMIT_SHA?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  try {
    const { commit } = JSON.parse(
      fs.readFileSync(versionFilePath, 'utf-8'),
    ) as {
      commit?: string;
    };
    return commit || UNKNOWN_COMMIT;
  } catch {
    return UNKNOWN_COMMIT;
  }
}
