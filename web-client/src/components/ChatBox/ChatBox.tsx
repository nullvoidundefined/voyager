'use client';

import { type FormEvent, useCallback, useState } from 'react';

import type { ChatMessage } from '@agentic-travel-agent/shared-types';
import { get } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import styles from './ChatBox.module.scss';
import { VirtualizedChat } from './VirtualizedChat';
import { useSSEChat } from './useSSEChat';

interface ChatBoxProps {
  tripId: string;
  hasFlights?: boolean;
  tripStatus?: string;
  onBookTrip?: () => void;
}

export function ChatBox({ tripId, hasFlights, tripStatus, onBookTrip }: ChatBoxProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');

  const { data: serverMessages } = useQuery({
    queryKey: ['messages', tripId],
    queryFn: () =>
      get<{ messages: ChatMessage[] }>(`/trips/${tripId}/messages`).then(
        (r) => r.messages,
      ),
  });

  const { sendMessage, isSending, streamingNodes, toolProgress, streamingText } =
    useSSEChat({ tripId });


  const showBookingActions = hasFlights && tripStatus === 'planning' && !isSending;

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const msg = input.trim();
      if (!msg) {
        return;
      }
      setInput('');
      sendMessage(msg);
    },
    [input, sendMessage],
  );

  // Invalidate trips query after booking-related actions
  const handleBookTrip = useCallback(() => {
    onBookTrip?.();
    queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
  }, [onBookTrip, queryClient, tripId]);

  return (
    <div className={styles.chatBox}>
      <VirtualizedChat
        messages={serverMessages ?? []}
        streamingNodes={streamingNodes}
        toolProgress={toolProgress}
        streamingText={streamingText}
        isSending={isSending}
        onQuickReply={sendMessage}
      />

      {showBookingActions && (
        <div className={styles.bookingActions}>
          <button type='button' className={styles.bookButton} onClick={handleBookTrip}>
            Book This Trip
          </button>
          <button
            type='button'
            className={styles.tryAgainButton}
            onClick={() =>
              sendMessage(
                "I'd like to make some changes to the itinerary. What would you suggest adjusting?",
              )
            }
          >
            Try Again
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.inputArea}>
        <input
          type='text'
          className={styles.input}
          placeholder='Ask the agent to plan your trip...'
          aria-label='Ask the agent to plan your trip...'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isSending}
        />
        <button
          type='submit'
          className={styles.sendButton}
          disabled={isSending || !input.trim()}
        >
          {isSending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
