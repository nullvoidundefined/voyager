'use client';

import { useEffect, useRef, useState } from 'react';

import { NodeRenderer } from '@/components/ChatBox/NodeRenderer';
import { APP_NAME } from '@/lib/constants';
import type { ChatNode } from '@agentic-travel-agent/shared-types';

import styles from './MockChatBox.module.scss';

interface DemoMessage {
  role: 'user' | 'assistant';
  nodes: ChatNode[];
  delay: number;
}

const DEMO_MESSAGES: DemoMessage[] = [
  {
    role: 'assistant',
    delay: 800,
    nodes: [
      {
        type: 'text',
        content: "Great choice! Let's plan your trip to **Monterey**.",
      },
    ],
  },
  {
    role: 'assistant',
    delay: 1200,
    nodes: [
      {
        type: 'travel_plan_form',
        fields: [
          {
            name: 'origin',
            label: 'Origin',
            field_type: 'text',
            placeholder: 'City or airport',
            required: true,
          },
          {
            name: 'departure_date',
            label: 'Departure date',
            field_type: 'date',
            required: true,
          },
          {
            name: 'return_date',
            label: 'Return date',
            field_type: 'date',
            required: true,
          },
          {
            name: 'budget',
            label: 'Budget',
            field_type: 'number',
            placeholder: '$3000',
            required: true,
          },
          {
            name: 'travelers',
            label: 'Travelers',
            field_type: 'number',
            placeholder: '2',
            required: true,
          },
        ],
      },
    ],
  },
  {
    role: 'user',
    delay: 2000,
    nodes: [
      {
        type: 'text',
        content:
          "I'm traveling from San Francisco, from April 15, 2026 to April 22, 2026, with a $3000 budget, for 2 travelers.",
      },
    ],
  },
  {
    role: 'assistant',
    delay: 2400,
    nodes: [
      {
        type: 'text',
        content: 'Will you be flying or driving?',
      },
      {
        type: 'quick_replies',
        options: ["I'll be flying", "I'll drive"],
      },
    ],
  },
  {
    role: 'user',
    delay: 1800,
    nodes: [
      {
        type: 'text',
        content: "I'll drive",
      },
    ],
  },
  {
    role: 'assistant',
    delay: 2200,
    nodes: [
      {
        type: 'text',
        content: 'Do you need a hotel?',
      },
      {
        type: 'quick_replies',
        options: ['Yes, find me a hotel', 'No, I have lodging'],
      },
    ],
  },
  {
    role: 'user',
    delay: 1800,
    nodes: [
      {
        type: 'text',
        content: 'Yes, find me a hotel',
      },
    ],
  },
  {
    role: 'assistant',
    delay: 2800,
    nodes: [
      {
        type: 'text',
        content: 'Here are some hotels in Monterey.',
      },
      {
        type: 'hotel_tiles',
        selectable: false,
        hotels: [
          {
            id: 'demo-hotel-1',
            name: 'Monterey Plaza Hotel & Spa',
            city: 'Monterey',
            star_rating: 4,
            price_per_night: 289,
            total_price: 2023,
            currency: 'USD',
            check_in: '2026-04-15',
            check_out: '2026-04-22',
          },
          {
            id: 'demo-hotel-2',
            name: 'InterContinental The Clement',
            city: 'Monterey',
            star_rating: 5,
            price_per_night: 359,
            total_price: 2513,
            currency: 'USD',
            check_in: '2026-04-15',
            check_out: '2026-04-22',
          },
        ],
      },
    ],
  },
  {
    role: 'user',
    delay: 2000,
    nodes: [
      {
        type: 'text',
        content: "I've selected Monterey Plaza Hotel",
      },
    ],
  },
  {
    role: 'assistant',
    delay: 2400,
    nodes: [
      {
        type: 'text',
        content: 'Great picks!',
      },
      {
        type: 'budget_bar',
        allocated: 2023,
        total: 3000,
        currency: 'USD',
      },
    ],
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
    }, delay * 0.3);

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
        top: listRef.current.scrollHeight,
        behavior: 'smooth',
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
