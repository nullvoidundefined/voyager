/**
 * Tools that must be called before format_response for a sub-agent turn.
 * Consumed by AgentOrchestrator to enforce the data-before-response invariant
 * in code rather than relying solely on prompt instructions.
 */
import { getSegmentCapability } from 'app/segments/registry/index.js';
import { isCoreSubAgent } from 'app/services/agent/isCoreSubAgent.js';
import type { SubAgentType } from 'app/services/agent/subAgentTypes.js';

export function getSubAgentRequiredTools(subAgent: SubAgentType): string[] {
  if (isCoreSubAgent(subAgent)) return [];
  return getSegmentCapability(subAgent).requiredTools;
}
