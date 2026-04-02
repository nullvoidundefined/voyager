'use client';

import { useCallback, useState } from 'react';

import type { ChatNode, SSEEvent } from '@agentic-travel-agent/shared-types';
import { useQueryClient } from '@tanstack/react-query';

import { API_BASE } from '@/lib/api';

interface UseSSEChatOptions {
  tripId: string;
}

interface UseSSEChatReturn {
  sendMessage: (message: string) => Promise<void>;
  isSending: boolean;
  streamingNodes: ChatNode[];
  toolProgress: ChatNode[];
  streamingText: string;
}

export function useSSEChat({ tripId }: UseSSEChatOptions): UseSSEChatReturn {
  const [isSending, setIsSending] = useState(false);
  const [streamingNodes, setStreamingNodes] = useState<ChatNode[]>([]);
  const [toolProgress, setToolProgress] = useState<ChatNode[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const queryClient = useQueryClient();

  function handleEvent(event: SSEEvent) {
    switch (event.type) {
      case 'node':
        setStreamingNodes((prev) => [...prev, event.node]);
        break;

      case 'text_delta':
        setStreamingText((prev) => prev + event.content);
        break;

      case 'tool_progress':
        setToolProgress((prev) => {
          const existing = prev.findIndex(
            (n) => n.type === 'tool_progress' && n.tool_id === event.tool_id,
          );
          const node: ChatNode = {
            type: 'tool_progress',
            tool_name: event.tool_name ?? '',
            tool_id: event.tool_id,
            status: event.status,
          };
          if (existing >= 0) {
            const next = [...prev];
            next[existing] = node;
            return next;
          }
          return [...prev, node];
        });
        break;

      case 'done':
        // Replace streaming state with canonical message from server
        setStreamingNodes([]);
        setStreamingText('');
        break;

      case 'error':
        setStreamingText(event.error);
        break;
    }
  }

  const sendMessage = useCallback(
    async (message: string) => {
      if (!message.trim() || isSending) return;

      setIsSending(true);
      setStreamingNodes([]);
      setToolProgress([]);
      setStreamingText('');

      try {
        const res = await fetch(`${API_BASE}/trips/${tripId}/chat`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({ message }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`Chat request failed: ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          let eventType = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              const event = JSON.parse(line.slice(6)) as SSEEvent;
              // Attach the event type from the SSE envelope if not in the payload
              if (!event.type) {
                (event as Record<string, unknown>).type = eventType;
              }
              handleEvent(event);
            }
          }
        }
      } catch (err) {
        console.error('SSE chat error:', err);
        setStreamingText('Something went wrong. Please try again.');
      } finally {
        setIsSending(false);
        setToolProgress([]);
        await queryClient.invalidateQueries({ queryKey: ['messages', tripId] });
        queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
        setStreamingNodes([]);
        setStreamingText('');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tripId, queryClient, isSending],
  );

  return {
    sendMessage,
    isSending,
    streamingNodes,
    toolProgress,
    streamingText,
  };
}
