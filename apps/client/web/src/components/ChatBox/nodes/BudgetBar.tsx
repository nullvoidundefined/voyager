/**
 * Adapts a budget_bar chat node into the shared InlineBudgetBar widget, keeping
 * the chat-node-to-widget mapping in one place so the conversation can show live
 * budget progress without the node type leaking into the widget.
 */
import type { ChatNodeOfType } from '@repo/types';

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
