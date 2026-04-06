/**
 * Returns true if the agent's external-API tool calls should use
 * mock fixtures instead of hitting real SerpApi / Google Places.
 *
 * Recognizes two env flags:
 * - EVAL_MOCK_SEARCH=true: set by the eval harness under eval/
 * - E2E_MOCK_TOOLS=1: set by Playwright's webServer config
 */
export function isMockMode(): boolean {
  return (
    process.env.EVAL_MOCK_SEARCH === 'true' ||
    process.env.E2E_MOCK_TOOLS === '1'
  );
}
