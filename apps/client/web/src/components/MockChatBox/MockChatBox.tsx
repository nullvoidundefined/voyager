'use client';

/**
 * Scripted, non-interactive chat playback used on marketing/demo surfaces to showcase
 * the assistant experience without a live backend connection.
 */
import { useEffect, useRef, useState } from 'react';

import type { ChatNode } from '@repo/types';

import { NodeRenderer } from '@/components/ChatBox/NodeRenderer';
import { APP_NAME } from '@/constants';

import styles from './MockChatBox.module.scss';

interface DemoMessage {
  role: 'user' | 'assistant';
  nodes: ChatNode[];
  delay: number;
}

const TYPING_INDICATOR_DELAY_RATIO = 0.3;

const DEMO_MESSAGES: DemoMessage[] = [
  {
    delay: 800,
    nodes: [
      {
        content: "Great choice! Let's plan your trip to **Barcelona**.",
        type: 'text',
      },
    ],
    role: 'assistant',
  },
  {
    delay: 1200,
    nodes: [
      {
        fields: [
          {
            field_type: 'text',
            label: 'Origin',
            name: 'origin',
            placeholder: 'City or airport',
            required: true,
          },
          {
            field_type: 'date',
            label: 'Departure date',
            name: 'departure_date',
            required: true,
          },
          {
            field_type: 'date',
            label: 'Return date',
            name: 'return_date',
            required: true,
          },
          {
            field_type: 'number',
            label: 'Budget',
            name: 'budget',
            placeholder: '$3000',
            required: true,
          },
          {
            field_type: 'number',
            label: 'Travelers',
            name: 'travelers',
            placeholder: '2',
            required: true,
          },
        ],
        type: 'travel_plan_form',
      },
    ],
    role: 'assistant',
  },
  {
    delay: 2000,
    nodes: [
      {
        content:
          "I'm traveling from San Francisco, from April 15, 2026 to April 22, 2026, with a $3000 budget, for 2 travelers.",
        type: 'text',
      },
    ],
    role: 'user',
  },
  {
    delay: 2400,
    nodes: [
      {
        content: 'Will you be flying or driving?',
        type: 'text',
      },
      {
        options: ["I'll be flying", "I'll drive"],
        type: 'quick_replies',
      },
    ],
    role: 'assistant',
  },
  {
    delay: 1800,
    nodes: [
      {
        content: "I'll drive",
        type: 'text',
      },
    ],
    role: 'user',
  },
  {
    delay: 2200,
    nodes: [
      {
        content: 'Do you need a hotel?',
        type: 'text',
      },
      {
        options: ['Yes, find me a hotel', 'No, I have lodging'],
        type: 'quick_replies',
      },
    ],
    role: 'assistant',
  },
  {
    delay: 1800,
    nodes: [
      {
        content: 'Yes, find me a hotel',
        type: 'text',
      },
    ],
    role: 'user',
  },
  {
    delay: 2800,
    nodes: [
      {
        content: 'Here are some hotels in Barcelona.',
        type: 'text',
      },
      {
        offer_kind: 'hotel',
        offers: [
          {
            badges: ['5-star'],
            currency: 'USD',
            detail: {
              check_in: '2026-04-15',
              check_out: '2026-04-22',
              city: 'Barcelona',
              name: 'W Barcelona',
              price_per_night: 289,
              star_rating: 5,
              total_price: 2023,
            },
            id: 'demo-hotel-1',
            price: 2023,
            price_unit: 'total',
            selection_label: 'W Barcelona, Barcelona',
            subtitle: 'Barcelona',
            title: 'W Barcelona',
          },
          {
            badges: ['5-star'],
            currency: 'USD',
            detail: {
              check_in: '2026-04-15',
              check_out: '2026-04-22',
              city: 'Barcelona',
              name: 'Hotel Arts Barcelona',
              price_per_night: 359,
              star_rating: 5,
              total_price: 2513,
            },
            id: 'demo-hotel-2',
            price: 2513,
            price_unit: 'total',
            selection_label: 'Hotel Arts Barcelona, Barcelona',
            subtitle: 'Barcelona',
            title: 'Hotel Arts Barcelona',
          },
        ],
        selectable: false,
        type: 'offer_tiles',
      },
    ],
    role: 'assistant',
  },
  {
    delay: 2000,
    nodes: [
      {
        content: "I've selected W Barcelona",
        type: 'text',
      },
    ],
    role: 'user',
  },
  {
    delay: 2400,
    nodes: [
      {
        content: 'Great picks!',
        type: 'text',
      },
      {
        allocated: 2023,
        currency: 'USD',
        total: 3000,
        type: 'budget_bar',
      },
    ],
    role: 'assistant',
  },
];

const RESTART_DELAY = 4000;

export function MockChatBox() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [showTyping, setShowTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visibleCount >= DEMO_MESSAGES.length) {
      const t = setTimeout(() => {
        setVisibleCount(0);
        setShowTyping(false);
      }, RESTART_DELAY);
      return () => clearTimeout(t);
    }

    const nextMsg = DEMO_MESSAGES[visibleCount];
    const delay = nextMsg.delay;

    // Show typing indicator first
    const typingTimer = setTimeout(() => {
      setShowTyping(true);
    }, delay * TYPING_INDICATOR_DELAY_RATIO);

    // Then reveal the message
    const msgTimer = setTimeout(() => {
      setShowTyping(false);
      setVisibleCount((c) => c + 1);
    }, delay);

    return () => {
      clearTimeout(typingTimer);
      clearTimeout(msgTimer);
    };
  }, [visibleCount]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({
        behavior: 'smooth',
        top: listRef.current.scrollHeight,
      });
    }
  }, [visibleCount, showTyping]);

  const visibleMessages = DEMO_MESSAGES.slice(0, visibleCount);

  return (
    <div className={styles.chatBox}>
      <div className={styles.messageList} ref={listRef}>
        {visibleMessages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.message} ${styles[msg.role]} ${styles.fadeIn}`}
          >
            <div className={styles.roleBadge}>
              {msg.role === 'user' ? 'You' : APP_NAME}
            </div>
            <div className={styles.bubble}>
              <div className={styles.demoOverlay}>
                {msg.nodes.map((node, ni) => (
                  <NodeRenderer
                    key={ni}
                    node={node}
                    callbacks={{ disabled: true }}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
        {showTyping && (
          <div
            className={`${styles.message} ${
              DEMO_MESSAGES[visibleCount]?.role === 'user'
                ? styles.user
                : styles.assistant
            }`}
          >
            <div className={styles.roleBadge}>
              {DEMO_MESSAGES[visibleCount]?.role === 'user' ? 'You' : APP_NAME}
            </div>
            <div className={styles.bubble}>
              <div className={styles.typing}>
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className={styles.inputArea}>
        <input
          type='text'
          className={styles.input}
          placeholder='Where do you want to go?'
          aria-label='Where do you want to go?'
          disabled
          readOnly
        />
        <button className={styles.sendButton} disabled>
          Send
        </button>
      </div>
      <p className={styles.demoLabel}>Live demo — sign in to try it</p>
    </div>
  );
}
