# Destination Imagery Design

**Date:** 2026-04-03
**Status:** Approved
**Scope:** Add beautiful destination imagery throughout the app: hero banners, trip tiles, booking confirmation, and updated MockChatBox demo.

---

## Problem

The app has no images. Every page is text and cards on flat backgrounds. A travel app should be visually inspiring — destination photography is the single most impactful way to create emotional engagement.

## Decisions

1. **Unsplash CDN with static photo IDs** — $0 cost, no API key, CDN handles resizing
2. **CSS gradient fallback** for cities without curated photos
3. **Hero carousel** — single rotating image with crossfade, 5 destinations
4. **Trip tiles** — image header above text details (Airbnb-style cards)
5. **Booking confirmation** — destination photo header with overlaid text
6. **MockChatBox** — rebuilt with real node components from the typed chat protocol

---

## Image Sourcing

### Strategy

Add `unsplash_id` field to the top ~30 cities in `server/src/data/cities.ts`. A shared frontend helper constructs CDN URLs:

```
https://images.unsplash.com/photo-{ID}?w={width}&h={height}&fit=crop&q=80
```

### Fallback

Cities without a curated `unsplash_id`: warm gradient background (Mediterranean blue → coral diagonal) with the city name centered in white text. Pure CSS, no image request.

### Next.js Config

Add `images.remotePatterns` to `web-client/next.config.ts`:

```typescript
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'images.unsplash.com' },
  ],
},
```

### Helper Function

Frontend utility at `web-client/src/lib/destinationImage.ts`:

```typescript
function getDestinationImageUrl(
  unsplashId: string,
  width: number,
  height: number,
): string;
function getDestinationImage(cityName: string): {
  url: string | null;
  unsplashId: string | null;
};
```

The helper looks up the city in a static map (duplicated from server's `cities.ts` — just the city name → unsplash_id mapping, not the full dataset). Returns `null` for unknown cities, triggering the gradient fallback.

### Curated Cities (~30)

Tokyo, Paris, New York, London, Barcelona, Rome, Santorini, Bali, Sydney, Dubai, Singapore, Seoul, Lisbon, Istanbul, Bangkok, Kyoto, Cape Town, Marrakech, Havana, Rio de Janeiro, Amsterdam, Prague, Vienna, Budapest, Dubrovnik, Reykjavik, Machu Picchu (Cusco), Amalfi Coast (Naples), Maldives, Petra (Amman)

Each gets a hand-picked Unsplash photo ID for a stunning, well-composed travel shot.

---

## Home Page Hero

Full-width hero banner with rotating destination images behind the existing headline.

### Carousel

- 5 images: Tokyo, Santorini, Paris, Bali, New York
- Crossfade transition: 1s opacity, 5s interval
- Dark gradient overlay: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.5))` so text remains readable
- Preload first image, lazy-load rest
- Image size: `w=1600&h=800` for full-width hero

### Layout

- `position: relative` container
- Image: `position: absolute`, `inset: 0`, `object-fit: cover`, `z-index: 0`
- Overlay gradient: `position: absolute`, `z-index: 1`
- Text content: `position: relative`, `z-index: 2`
- Existing headline, subtitle, CTA buttons stay — now on top of the photo
- Text color: white (replace current `var(--foreground)` for hero section only)

### Mobile

Same layout. Image crops naturally via `object-fit: cover`. No layout change needed.

### Replaces

The current radial gradient glow (`radial-gradient(ellipse at 50% 0%, rgba(30, 86, 160, 0.12)...)`) in the hero section.

---

## Trip Tiles

Trip cards on the trips list page get a destination image header.

### Card Layout

```
┌──────────────────────┐
│   [destination photo] │  160px tall, object-fit: cover, rounded top corners
├──────────────────────┤
│  Destination name     │
│  Dates               │
│  Budget              │
│  Status badge        │
└──────────────────────┘
```

### Image

- Size: `w=600&h=300` via Unsplash CDN
- Fallback: CSS gradient with city name overlay
- "Planning..." placeholder trips: generic travel gradient (no destination to look up)
- Next.js `<Image>` component with `fill` + `object-fit: cover` for optimization

### Card Changes

- Layout changes from horizontal flex to vertical stack
- Delete button: small icon overlaid on top-right of image (semi-transparent background circle)
- Card maintains hover effects (border, shadow, transform)

---

## Booking Confirmation

The confirmation modal gets a destination photo header.

### Layout

```
┌──────────────────────────┐
│                          │
│   [destination photo]    │  180px, full-width, rounded top corners
│   gradient overlay       │
│   "You're going to       │  white text on gradient
│    [destination]!"       │
│                          │
├──────────────────────────┤
│  Trip details            │
│  Itemized breakdown      │
│  Total                   │
│  [Confirm]  [Cancel]     │
└──────────────────────────┘
```

### Image

- Size: `w=800&h=400` via Unsplash CDN
- Bottom gradient for text readability: `linear-gradient(transparent 30%, rgba(0,0,0,0.6) 100%)`
- Destination name overlaid in white, Fraunces font, ~28px
- Same gradient fallback for unknown cities

### Confirmed State

After booking confirmation (checkmark stage), the image stays visible. The checkmark overlays the photo.

---

## MockChatBox Update

Replace the 18 hardcoded text messages with a demo rendering actual typed node components.

### Demo Script (Monterey Trip)

| #   | Role      | Node Types                           | Content                                                 |
| --- | --------- | ------------------------------------ | ------------------------------------------------------- |
| 1   | assistant | text                                 | "Great choice! Let's plan your trip to **Monterey**..." |
| 2   | assistant | travel_plan_form                     | Origin, dates, budget, travelers fields                 |
| 3   | user      | text                                 | "San Francisco, April 15-22, $3000, 2 travelers"        |
| 4   | assistant | text + quick_replies                 | "Will you be flying or driving?" + chips                |
| 5   | user      | text                                 | "I'll drive"                                            |
| 6   | assistant | text + quick_replies                 | "Do you need a hotel?" + chips                          |
| 7   | user      | text                                 | "Yes, find me a hotel"                                  |
| 8   | assistant | text + hotel_tiles                   | "Here are some hotels." + 2-3 mini cards                |
| 9   | user      | text                                 | "I've selected Monterey Plaza Hotel"                    |
| 10  | assistant | text + quick_replies                 | "Any experiences?" + chips                              |
| 11  | assistant | text + experience_tiles + budget_bar | Experience cards + budget                               |

### Implementation

- Import `NodeRenderer` and render real nodes
- Static `ChatMessage[]` array with properly typed `ChatNode` objects
- Same sequential timing animation (messages appear with delays)
- Form and tiles are display-only (no click handlers wired)
- Reuse VirtualizedChat's message styling (role badge, bubble classes)
- Keep the disabled input area and "Live demo" footer

---

## What Changes

| Component                                                                       | Change                                         |
| ------------------------------------------------------------------------------- | ---------------------------------------------- |
| `server/src/data/cities.ts`                                                     | Add `unsplash_id` field to top ~30 cities      |
| `web-client/next.config.ts`                                                     | Add `images.remotePatterns` for Unsplash       |
| `web-client/src/lib/destinationImage.ts`                                        | NEW: image URL helper + city → unsplash_id map |
| `web-client/src/app/page.tsx`                                                   | Hero carousel with rotating destination images |
| `web-client/src/app/page.module.scss`                                           | Hero image styles, overlay, text color updates |
| `web-client/src/components/MockChatBox/MockChatBox.tsx`                         | Complete rewrite with typed node rendering     |
| `web-client/src/components/MockChatBox/MockChatBox.module.scss`                 | Updated styles for node-based layout           |
| `web-client/src/app/(protected)/trips/page.tsx`                                 | Trip cards with image headers                  |
| `web-client/src/app/(protected)/trips/trips.module.scss`                        | Vertical card layout with image                |
| `web-client/src/components/BookingConfirmation/BookingConfirmation.tsx`         | Destination photo header                       |
| `web-client/src/components/BookingConfirmation/BookingConfirmation.module.scss` | Image header styles                            |

### What Doesn't Change

- Backend, API, database, chat system, preferences, booking state machines
- Existing node components (they're reused, not modified)
- SCSS variable system (new styles use existing variables)
