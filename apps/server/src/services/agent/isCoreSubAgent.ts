/**
 * Narrows a sub-agent type to the three core conversation-flow agents, so
 * tool-partition lookups know whether to read the core table or the segment
 * registry.
 */
import type {
  CoreSubAgentType,
  SubAgentType,
} from 'app/services/agent/subAgentTypes.js';

export function isCoreSubAgent(
  subAgent: SubAgentType,
): subAgent is CoreSubAgentType {
  return (
    subAgent === 'detail' || subAgent === 'plan' || subAgent === 'conversation'
  );
}
