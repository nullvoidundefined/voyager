import { describe, expect, it } from 'vitest';

import { buildICSContent } from '../exportIcs';

const DAYS = [
  {
    id: 'd1',
    day_number: 1,
    day_date: '2026-08-01',
    items: [
      {
        id: 'i1',
        time_of_day: 'morning',
        title: 'Museum Visit',
        item_type: 'activity',
        item_order: 1,
        description: 'Explore the local art museum.',
        place_id: null,
        booking_url: null,
        price_usd: null,
      },
    ],
  },
];

describe('buildICSContent', () => {
  it('returns a string starting with BEGIN:VCALENDAR', () => {
    const ics = buildICSContent('Test Trip', DAYS);
    expect(typeof ics).toBe('string');
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
  });

  it('includes the event title', () => {
    const ics = buildICSContent('Test Trip', DAYS);
    expect(ics).toContain('Museum Visit');
  });

  it('returns a valid calendar for an empty days array', () => {
    const ics = buildICSContent('Empty Trip', []);
    expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
    expect(ics).toContain('END:VCALENDAR');
  });

  it('falls back to 09:00 for an unknown time_of_day value', () => {
    const days = [
      {
        id: 'd1',
        day_number: 1,
        day_date: '2026-08-01',
        items: [
          {
            id: 'i1',
            time_of_day: 'midnight',
            title: 'Mystery Event',
            item_type: 'activity',
            item_order: 1,
            description: null,
            place_id: null,
            booking_url: null,
            price_usd: null,
          },
        ],
      },
    ];
    const ics = buildICSContent('Test', days);
    expect(ics).toContain('Mystery Event');
  });
});
