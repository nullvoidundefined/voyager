/**
 * Tool partition for a sub-agent turn; segment partitions come from the
 * capability registry so a new mode never edits this lookup.
 */
import { getSegmentCapability } from 'app/segments/registry/index.js';
import { CORE_SUB_AGENT_TOOLS } from 'app/services/agent/coreSubAgentTools.js';
import { isCoreSubAgent } from 'app/services/agent/isCoreSubAgent.js';
import type { SubAgentType } from 'app/services/agent/subAgentTypes.js';

export function getSubAgentTools(subAgent: SubAgentType): string[] {
  if (isCoreSubAgent(subAgent)) return CORE_SUB_AGENT_TOOLS[subAgent];
  return getSegmentCapability(subAgent).subAgentTools;
}
