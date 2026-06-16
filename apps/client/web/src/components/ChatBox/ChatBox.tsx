'use client';

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChatMessage, TripPlanCard } from '@voyager/shared-types';

import { AIDisclosure } from '@/components/AIDisclosure/AIDisclosure';
import { CostCounter } from '@/components/CostCounter/CostCounter';
import { Toast } from '@/components/Toast/Toast';
import type { ToolCall } from '@/components/ToolTimeline/ToolTimeline';
import { ToolTimeline } from '@/components/ToolTimeline/ToolTimeline';
import { get, post, put } from '@/lib/api/api';
import { runDemoScript } from '@/lib/demoScript/demoScript';

import styles from './ChatBox.module.scss';
import { VirtualizedChat } from './VirtualizedChat';
import { useSSEChat } from './useSSEChat';

export const BOOKING_CONFIRMATION_TRIGGER = 'Save itinerary';

interface ChatBoxProps {
  tripId: string;
  initialDestination?: string;
  hasFlights?: boolean;
  hasHotels?: boolean;
  experiencesEmpty?: boolean;
  carRentalsEmpty?: boolean;
  tripStatus?: string;
  onBookTrip?: () => void;
  isDemoMode?: boolean;
}

export function ChatBox({
  tripId,
  initialDestination,
  hasFlights,
  hasHotels,
  experiencesEmpty,
  carRentalsEmpty,
  tripStatus,
  onBookTrip,
  isDemoMode,
}: ChatBoxProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [pendingUserMessage, setPendingUserMessage] =
    useState<ChatMessage | null>(null);
  const skipFormAutoSave = useRef(false);
  const formValuesRef = useRef<Record<string, string>>({});

  const handleFormValuesChange = useCallback(
    (values: Record<string, string>) => {
      formValuesRef.current = values;
    },
    [],
  );

  const { data: serverMessages } = useQuery({
    queryKey: ['messages', tripId],
    queryFn: () =>
      get<{ messages: ChatMessage[] }>(`/trips/${tripId}/messages`).then(
        (r) => r.messages,
      ),
  });

  // trip-costs is event-driven, not polled. The underlying value only
  // changes when an agent turn completes (it sums agent_turn_cost),
  // so refetching on a 5s interval was wasted DB load. Invalidation
  // happens in useSSEChat's onComplete callback below.
  const { data: costsData } = useQuery({
    queryKey: ['trip-costs', tripId],
    queryFn: () =>
      get<{ total_tokens: number; total_cost_usd: string }>(
        `/trips/${tripId}/costs`,
      ),
  });

  // Merge server messages with optimistic pending user message
  const allMessages: ChatMessage[] = useMemo(
    () => [
      ...(serverMessages ?? []),
      ...(pendingUserMessage ? [pendingUserMessage] : []),
    ],
    [serverMessages, pendingUserMessage],
  );

  const {
    sendMessage,
    isSending,
    streamingNodes,
    toolProgress,
    streamingText,
    liveTokens,
    error: sseError,
    clearError: clearSseError,
  } = useSSEChat({
    tripId,
    onComplete: () => {
      setPendingUserMessage(null);
      void queryClient.invalidateQueries({
        queryKey: ['trip-costs', tripId],
      });
    },
  });

  const timelineToolCalls = useMemo<ToolCall[]>(
    () =>
      toolProgress
        .filter((n) => n.type === 'tool_progress')
        .map((n) => {
          const node = n as Extract<typeof n, { type: 'tool_progress' }>;
          return {
            id: node.tool_id,
            toolName: node.tool_name,
            status: node.status === 'running' ? 'running' : 'done',
            durationMs: 0,
          };
        }),
    [toolProgress],
  );

  // Suppress booking actions when the most recent assistant message contains
  // selectable tile nodes -- the SelectableCardGroup "Confirm Selection" button
  // serves as the confirmation mechanism in that case.
  const lastAssistantMessage = serverMessages
    ?.slice()
    .reverse()
    .find((m) => m.role === 'assistant');
  const hasActiveTileSelection =
    lastAssistantMessage?.nodes.some(
      (n) =>
        (n.type === 'flight_tiles' ||
          n.type === 'hotel_tiles' ||
          n.type === 'car_rental_tiles' ||
          n.type === 'experience_tiles') &&
        n.selectable,
    ) ?? false;

  const showBookingActions =
    hasFlights &&
    hasHotels &&
    tripStatus === 'planning' &&
    !isSending &&
    !hasActiveTileSelection;
  const isBooked = tripStatus === 'saved';

  const handleSend = useCallback(
    (msg: string) => {
      if (!msg.trim()) return;

      // Intercept booking confirmation -- open modal instead of sending chat message
      if (msg.trim() === BOOKING_CONFIRMATION_TRIGGER) {
        onBookTrip?.();
        return;
      }

      // Auto-save any form data that hasn't been submitted yet.
      // If the user typed in the chat input while the trip details form has values,
      // we treat that data as canonical and persist it before sending the message.
      // Values are kept in sync via a ref callback from TripDetailsForm.
      if (!skipFormAutoSave.current) {
        const vals = formValuesRef.current;
        const formData: Record<string, unknown> = {};
        if (vals.destination?.trim()) formData.destination = vals.destination;
        if (vals.origin?.trim()) formData.origin = vals.origin;
        if (vals.departure_date?.trim())
          formData.departure_date = vals.departure_date;
        if (vals.return_date?.trim()) formData.return_date = vals.return_date;
        if (vals.budget?.trim()) formData.budget_total = Number(vals.budget);
        if (vals.travelers?.trim()) formData.travelers = Number(vals.travelers);
        if (vals.trip_type?.trim()) formData.trip_type = vals.trip_type;
        if (vals.flexible_dates !== undefined)
          formData.flexible_dates = vals.flexible_dates === 'true';

        if (Object.keys(formData).length > 0) {
          put(`/trips/${tripId}`, formData).catch((err) =>
            console.error('Failed to auto-save form data:', err),
          );
        }
      }
      skipFormAutoSave.current = false;

      // Optimistic: show user message immediately
      setPendingUserMessage({
        id: `pending-${Date.now()}`,
        role: 'user',
        nodes: [{ type: 'text', content: msg }],
        sequence: (serverMessages?.length ?? 0) + 1,
        created_at: new Date().toISOString(),
      });
      void sendMessage(msg);
    },
    [sendMessage, serverMessages?.length, onBookTrip, tripId],
  );

  useEffect(() => {
    if (!isDemoMode) return;
    const stop = runDemoScript((msg) => {
      handleSend(msg);
    });
    return stop;
  }, [isDemoMode, handleSend]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const msg = input.trim();
      if (!msg) return;
      setInput('');
      handleSend(msg);
    },
    [input, handleSend],
  );

  const handleFormSubmit = useCallback(
    async (structuredData: Record<string, string>, displayMessage: string) => {
      const tripUpdate: Record<string, unknown> = {};
      if (structuredData.destination)
        tripUpdate.destination = structuredData.destination;
      if (structuredData.origin) tripUpdate.origin = structuredData.origin;
      if (structuredData.departure_date)
        tripUpdate.departure_date = structuredData.departure_date;
      if (structuredData.return_date)
        tripUpdate.return_date = structuredData.return_date;
      if (structuredData.budget)
        tripUpdate.budget_total = Number(structuredData.budget);
      if (structuredData.travelers)
        tripUpdate.travelers = Number(structuredData.travelers);
      if (structuredData.trip_type)
        tripUpdate.trip_type = structuredData.trip_type;
      if (structuredData.flexible_dates !== undefined)
        tripUpdate.flexible_dates = structuredData.flexible_dates === 'true';

      try {
        await put(`/trips/${tripId}`, tripUpdate);
        void queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
      } catch (err) {
        console.error('Failed to update trip:', err);
      }

      skipFormAutoSave.current = true;
      handleSend(displayMessage);
    },
    [tripId, queryClient, handleSend],
  );

  const handleSelectItem = useCallback(
    async (type: string, data: Record<string, unknown>) => {
      try {
        await post(`/trips/${tripId}/selections`, { type, data });
        void queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
      } catch (err) {
        console.error('Failed to persist selection:', err);
      }
    },
    [tripId, queryClient],
  );

  const handleConfirmPlan = useCallback(
    (confirmedCard: TripPlanCard, summaryMessage: string) => {
      setPendingUserMessage({
        id: `pending-${Date.now()}`,
        role: 'user',
        nodes: [{ type: 'text', content: summaryMessage }],
        sequence: (serverMessages?.length ?? 0) + 1,
        created_at: new Date().toISOString(),
      });
      void sendMessage(summaryMessage, { planConfirmation: confirmedCard });
    },
    [sendMessage, serverMessages?.length],
  );

  // Invalidate trips query after booking-related actions
  const handleBookTrip = useCallback(() => {
    onBookTrip?.();
    void queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
  }, [onBookTrip, queryClient, tripId]);

  // B6: when booking criteria are met, append a client-only booking_prompt
  // virtual node so the inline tile renders as the last assistant message.
  const messagesWithBookingPrompt = useMemo<ChatMessage[]>(() => {
    if (!showBookingActions) return allMessages;
    const promptNode = {
      type: 'booking_prompt' as const,
      experiences_empty: experiencesEmpty ?? true,
      car_rentals_empty: carRentalsEmpty ?? true,
    };
    const promptMessage: ChatMessage = {
      id: '__booking_prompt__',
      role: 'assistant',
      nodes: [promptNode],
      sequence: allMessages.length + 1,
      created_at: new Date().toISOString(),
    };
    return [...allMessages, promptMessage];
  }, [allMessages, showBookingActions, experiencesEmpty, carRentalsEmpty]);

  return (
    <div className={styles.chatBox} data-testid='chat-box'>
      {sseError && <Toast message={sseError} onClose={clearSseError} />}
      <AIDisclosure />
      {costsData && (
        <div className={styles.chatHeader}>
          <CostCounter
            totalTokens={costsData.total_tokens}
            totalCostUsd={costsData.total_cost_usd}
          />
        </div>
      )}
      <VirtualizedChat
        messages={messagesWithBookingPrompt}
        streamingNodes={streamingNodes}
        toolProgress={toolProgress}
        streamingText={streamingText}
        isSending={isSending}
        isStreaming={isSending}
        onQuickReply={handleSend}
        onSelectItem={handleSelectItem}
        onFormSubmit={handleFormSubmit}
        onFormValuesChange={handleFormValuesChange}
        onConfirmPlan={handleConfirmPlan}
        onBookNow={handleBookTrip}
        initialDestination={initialDestination}
      />

      {timelineToolCalls.length > 0 && (
        <div className={styles.timeline}>
          <ToolTimeline toolCalls={timelineToolCalls} />
        </div>
      )}

      <div className={styles.srOnly} aria-live='polite' aria-atomic='true'>
        {isSending ? 'Agent is searching...' : ''}
      </div>

      {isSending && liveTokens !== null && (
        <div className={styles.liveBudget} aria-live='polite'>
          {liveTokens.toLocaleString()} tokens used
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.inputArea}>
        <input
          type='text'
          className={styles.input}
          placeholder={
            isBooked
              ? 'Itinerary saved! Enjoy your adventure.'
              : 'Ask the agent to plan your trip...'
          }
          aria-label={
            isBooked
              ? 'Itinerary saved! Enjoy your adventure.'
              : 'Ask the agent to plan your trip...'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isSending || isBooked}
        />
        <button
          type='submit'
          className={styles.sendButton}
          disabled={isSending || isBooked || !input.trim()}
          aria-label={isSending ? 'Sending message' : 'Send message'}
        >
          {isSending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
