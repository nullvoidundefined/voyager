'use client';

/**
 * Virtualized chat transcript. Renders persisted messages plus in-flight
 * streaming nodes through a windowed list (per-node-type height estimates) so
 * long conversations stay performant, and auto-scrolls as new content streams.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { ChatMessage, ChatNode, TripPlanCard } from '@repo/types';
import { useVirtualizer } from '@tanstack/react-virtual';

import { APP_NAME } from '@/constants';

import { NodeRenderer } from './NodeRenderer';
import styles from './VirtualizedChat.module.scss';
import {
  buildOfferSelectionMessage,
  getOfferTileHeightEstimate,
} from './nodes/offerCardRegistry';
import { ChatProgressBar } from './widgets/ChatProgressBar';

interface VirtualizedChatProps {
  messages: ChatMessage[];
  streamingNodes: ChatNode[];
  toolProgress: ChatNode[];
  streamingText: string;
  isSending: boolean;
  isStreaming?: boolean;
  onQuickReply: (text: string) => void;
  onSelectItem?: (type: string, data: Record<string, unknown>) => void;
  onBookNow?: () => void;
  onFormSubmit?: (
    structuredData: Record<string, string>,
    displayMessage: string,
  ) => void;
  onFormValuesChange?: (values: Record<string, string>) => void;
  onConfirmPlan?: (confirmedCard: TripPlanCard, summaryMessage: string) => void;
  initialDestination?: string;
}

// Height estimates by node type for initial virtualized sizing
const NODE_HEIGHT_ESTIMATES: Partial<Record<ChatNode['type'], number>> = {
  advisory: 80,
  booking_prompt: 96,
  budget_bar: 48,
  itinerary: 200,
  plan_card: 280,
  quick_replies: 48,
  text: 60,
  tool_progress: 32,
  travel_plan_form: 300,
  weather_forecast: 120,
};

const TOOL_LABELS: Record<string, string> = {
  calculate_remaining_budget: 'Calculating budget',
  format_response: 'Assembling response',
  get_destination_info: 'Looking up destination',
  search_car_rentals: 'Searching car rentals',
  search_experiences: 'Finding experiences',
  search_flights: 'Searching flights',
  search_hotels: 'Searching hotels',
};

function getToolLabelForName(toolName: string): string {
  if (!toolName) return 'Working';
  return TOOL_LABELS[toolName] ?? toolName.replace(/_/g, ' ');
}

const DEFAULT_NODE_HEIGHT_PX = 60;
const EMPTY_MESSAGE_HEIGHT_PX = 40;
const MESSAGE_BASE_PADDING_PX = 16;
const AT_BOTTOM_THRESHOLD_PX = 50;

function estimateNodeHeight(node: ChatNode): number {
  if (node.type === 'offer_tiles') {
    return getOfferTileHeightEstimate(node.offer_kind);
  }
  return NODE_HEIGHT_ESTIMATES[node.type] ?? DEFAULT_NODE_HEIGHT_PX;
}

function estimateMessageHeight(nodes: ChatNode[]): number {
  if (nodes.length === 0) return EMPTY_MESSAGE_HEIGHT_PX;
  return nodes.reduce(
    (sum, node) => sum + estimateNodeHeight(node),
    MESSAGE_BASE_PADDING_PX,
  );
}

export function VirtualizedChat({
  initialDestination,
  isSending,
  isStreaming,
  messages,
  onBookNow,
  onConfirmPlan,
  onFormSubmit,
  onFormValuesChange,
  onQuickReply,
  onSelectItem,
  streamingNodes,
  streamingText,
  toolProgress,
}: VirtualizedChatProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  // Build a temporary streaming message to append during active turns
  const streamingMessage = useMemo<ChatMessage | null>(
    () =>
      isSending &&
      (streamingNodes.length > 0 || toolProgress.length > 0 || streamingText)
        ? {
            created_at: new Date().toISOString(),
            id: '__streaming__',
            nodes: [
              ...toolProgress,
              ...streamingNodes,
              ...(streamingText
                ? [{ content: streamingText, type: 'text' as const }]
                : []),
            ],
            role: 'assistant',
            sequence: messages.length + 1,
          }
        : null,

    [isSending, streamingNodes, toolProgress, streamingText, messages.length],
  );

  const allMessages = useMemo(
    () => (streamingMessage ? [...messages, streamingMessage] : messages),
    [messages, streamingMessage],
  );

  const virtualizer = useVirtualizer({
    count: allMessages.length,
    estimateSize: (index) =>
      estimateMessageHeight(allMessages[index]?.nodes ?? []),
    getScrollElement: () => parentRef.current,
    measureElement:
      typeof window !== 'undefined' &&
      navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element.getBoundingClientRect().height
        : undefined,
    overscan: 3,
  });

  // Auto-scroll to bottom on new messages, but only if user was already at bottom
  useEffect(() => {
    if (wasAtBottomRef.current && allMessages.length > 0) {
      virtualizer.scrollToIndex(allMessages.length - 1, { align: 'end' });
    }
    // Deps intentionally omit the virtualizer instance: scroll only reacts to
    // new content, not re-created virtualizer objects.
    // eslint-disable-next-line
  }, [allMessages.length, streamingText]);

  function renderBubbleContent(
    message: (typeof allMessages)[number],
    messageIndex: number,
  ) {
    const toolNodes = message.nodes.filter(
      (n): n is Extract<ChatNode, { type: 'tool_progress' }> =>
        n.type === 'tool_progress',
    );
    const otherNodes = message.nodes.filter((n) => n.type !== 'tool_progress');
    const latestRunning = toolNodes
      .filter((n) => n.status === 'running')
      .at(-1);
    const latestAny = toolNodes.at(-1);
    const latestToolName =
      latestRunning?.tool_name ?? latestAny?.tool_name ?? '';
    return (
      <>
        {toolNodes.length > 0 && (
          <ChatProgressBar
            mode='determinate'
            done={toolNodes.filter((n) => n.status === 'done').length}
            total={toolNodes.length}
            latestLabel={getToolLabelForName(latestToolName)}
          />
        )}
        {otherNodes.map((node, nodeIdx) => (
          <NodeRenderer
            key={`${message.id}-${nodeIdx}`}
            node={node}
            callbacks={{
              disabled: isSending || messageIndex !== allMessages.length - 1,
              initialValues:
                initialDestination &&
                initialDestination !== 'New trip' &&
                initialDestination !== 'Planning...'
                  ? { destination: initialDestination }
                  : undefined,
              onBookNow,
              onConfirmOffer: (kind, label, data) => {
                onSelectItem?.(kind, data);
                onQuickReply(buildOfferSelectionMessage(kind, label));
              },
              onConfirmPlan,
              onFormSubmit,
              onFormValuesChange,
              onQuickReply,
            }}
          />
        ))}
      </>
    );
  }

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    wasAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < AT_BOTTOM_THRESHOLD_PX;
  }, []);

  return (
    <div
      ref={parentRef}
      className={styles.chatContainer}
      onScroll={handleScroll}
    >
      {allMessages.length === 0 && !isSending && (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>&#x2708;&#xFE0F;</p>
          <p className={styles.emptyTitle}>Start planning your trip</p>
          <p className={styles.emptySubtitle}>
            Describe where you want to go, your dates, and budget below.
          </p>
          <button
            type='button'
            className={styles.starterChip}
            onClick={() => onQuickReply('Plan a trip to ')}
          >
            Plan a trip to...
          </button>
        </div>
      )}
      {isSending &&
        streamingNodes.length === 0 &&
        toolProgress.length === 0 &&
        streamingText === '' &&
        messages.at(-1)?.role !== 'assistant' && (
          <div className={styles.pendingIndicator}>
            <ChatProgressBar mode='indeterminate' label='Thinking' />
          </div>
        )}
      {isStreaming && (
        <div
          className={styles.thinkingIndicator}
          aria-live='polite'
          aria-label='Agent is thinking'
        >
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.thinkingText}>Thinking...</span>
        </div>
      )}
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const message = allMessages[virtualItem.index];
          if (!message) return null;

          return (
            <div
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                left: 0,
                position: 'absolute',
                top: 0,
                transform: `translateY(${virtualItem.start}px)`,
                width: '100%',
              }}
            >
              <div
                className={`${styles.message} ${styles[message.role]}`}
                data-role={message.role}
              >
                <div className={styles.roleBadge}>
                  {message.role === 'user' ? 'You' : APP_NAME}
                </div>
                <div className={styles.bubble}>
                  {renderBubbleContent(message, virtualItem.index)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
