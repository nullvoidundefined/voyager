# Explore Mode Design

**Date:** 2026-04-03
**Status:** Approved
**Scope:** Public Explore page with 30 curated destination guides, category filtering, and destination detail pages with experiences, dining, neighborhoods, weather, and travel advisories.

---

## Problem

The app is a trip booking tool — users only come when they're ready to plan. There's no discovery, no browsing, no reason to visit unless you're actively booking. Travel platforms like Airbnb succeed because users browse for inspiration, not just transactions.

## Decisions

1. **Public pages** — Explore is accessible without login. Discovery is the marketing funnel.
2. **Destination-centric with category filters** — browse by city, filter by interest (beach, city, adventure, etc.)
3. **Content-rich destination pages** — top 10 experiences, dining highlights, neighborhoods, weather, visa info
4. **Static curated content** — Claude generates, human reviews, committed as TypeScript data
5. **30 curated cities** — quality over quantity. Cities with Unsplash photos get full guides.
6. **"Plan a trip" CTA** — the conversion point from browsing to booking

---

## Explore Page

**Route:** `/explore` — public, no auth required

### Layout

1. **Hero banner** — rotating destination images with "Discover your next adventure" headline
2. **Category filter bar** — pill buttons: All, Beach & Islands, City Breaks, Adventure, Romantic, Food & Wine, Culture & History, Budget-Friendly, Family
3. **Destination card grid** — filterable 3-column grid (2 on tablet, 1 on mobile)

### Destination Cards

Each card shows:

- Destination photo (Unsplash CDN, reusing existing `getDestinationImage`)
- City name + country
- Price indicator ($ to $$$$)
- Best season badge (e.g., "Best: Mar-May")
- 1-2 category tags

Cards link to `/explore/[city-slug]`.

### Filtering

Client-side filtering on the static 30-item array by category tags. No API calls. Instant.

---

## Destination Detail Page

**Route:** `/explore/[city-slug]` — public, statically generated

### Layout (top to bottom)

1. **Hero image** — full-width, 300px, city name + country overlaid with gradient
2. **Quick stats bar** — currency, language, best time to visit, estimated daily budget, visa one-liner
3. **About** — 2-3 paragraph destination description
4. **Top 10 Experiences** — cards: name, category, description, estimated cost
5. **Dining Highlights** — 4-6 recommendations: name, cuisine, price level, description. Future: Resy-bookable
6. **Neighborhoods** — 3-4 spotlights: name + character description
7. **Weather** — month-by-month temperature chart (static averages)
8. **Travel Advisories** — visa info + safety summary
9. **CTA section** — "Ready to go? Plan a trip to [city]" button

### CTA Behavior

- **Logged in:** `POST /trips` with `destination: city`, redirect to `/trips/[id]`
- **Not logged in:** redirect to `/login?redirect=/trips/new?destination=[city]`

---

## Content Data Structure

**File:** `web-client/src/data/destinations.ts`

```typescript
interface Destination {
  slug: string;
  name: string;
  country: string;
  categories: string[];
  price_level: 1 | 2 | 3 | 4;
  best_season: string;
  description: string;
  currency: string;
  language: string;
  estimated_daily_budget: { budget: number; mid: number; luxury: number };
  visa_summary: string;
  top_experiences: Array<{
    name: string;
    category: string;
    description: string;
    estimated_cost: number;
  }>;
  dining_highlights: Array<{
    name: string;
    cuisine: string;
    price_level: 1 | 2 | 3 | 4;
    description: string;
  }>;
  neighborhoods: Array<{
    name: string;
    description: string;
  }>;
  weather: Array<{
    month: string;
    high_c: number;
    low_c: number;
    rainfall_mm: number;
  }>;
}
```

### Content Generation

1. Claude generates content for all 30 curated cities
2. Output: single TypeScript file with `DESTINATIONS` array
3. Human reviews/edits for accuracy and tone
4. Committed to codebase — fully static, zero runtime cost

### Category Tags

`beach`, `city`, `adventure`, `romantic`, `food-wine`, `culture`, `budget`, `family`

A city can have multiple tags (Tokyo: `city`, `culture`, `food-wine`).

### The 30 Cities

Tokyo, Paris, New York, London, Barcelona, Rome, Santorini, Bali, Sydney, Dubai, Singapore, Seoul, Lisbon, Istanbul, Bangkok, Kyoto, Cape Town, Marrakech, Havana, Rio de Janeiro, Amsterdam, Prague, Vienna, Budapest, Dubrovnik, Reykjavik, Cusco, Naples, Maldives, Amman

---

## SEO

Public pages with static content. Next.js generates them at build time via `generateStaticParams()`. Each page gets:

- `<title>` — "Tokyo Travel Guide — Voyager"
- `<meta name="description">` — first sentence of the destination description
- Open Graph tags for social sharing

---

## What Changes

| Component                                            | Change                                     |
| ---------------------------------------------------- | ------------------------------------------ |
| `web-client/src/data/destinations.ts`                | NEW: static content for 30 cities          |
| `web-client/src/app/explore/page.tsx`                | NEW: Explore page with hero, filters, grid |
| `web-client/src/app/explore/page.module.scss`        | NEW: Explore page styles                   |
| `web-client/src/app/explore/[slug]/page.tsx`         | NEW: Destination detail page               |
| `web-client/src/app/explore/[slug]/page.module.scss` | NEW: Detail page styles                    |
| `web-client/src/components/Header/Header.tsx`        | Add "Explore" nav link (public)            |
| `web-client/src/app/page.tsx`                        | Add "Explore destinations" CTA             |

### What Doesn't Change

- Backend, API, database, chat, preferences, booking flow
- Server-side city data (`server/src/data/cities.ts`)
- Unsplash image system (reused)
- Existing components

---

## Future: Resy Dining Integration

Not in this spec. Planned as a follow-up:

- During the Experiences booking step, search Resy for available reservations alongside Google Places
- Standalone "Dining" section in Explore for browsing/booking restaurants by destination
- Dining highlight cards on destination pages become bookable via Resy
- Separate spec → plan → implementation cycle
