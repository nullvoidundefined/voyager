import type { ChatNodeOfType } from '@agentic-travel-agent/shared-types';

import { InlineBudgetBar } from '../widgets/InlineBudgetBar';

interface BudgetBarProps {
  node: ChatNodeOfType<'budget_bar'>;
}

export function BudgetBar({ node }: BudgetBarProps) {
  return (
    <InlineBudgetBar
      allocated={node.allocated}
      total={node.total}
      currency={node.currency}
    />
  );
}
