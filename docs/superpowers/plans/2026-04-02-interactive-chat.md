# Interactive Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Voyager's text-only chat into a rich interactive experience with clickable result cards, quick-reply chips, Google Places photos, map previews, inline budget tracking, and itinerary timelines.

**Architecture:** A widget-based rendering system inside ChatBox. Tool result payloads are stored in component state and rendered as structured cards. Assistant text is parsed for patterns (questions, options, itinerary blocks) and rendered with appropriate interactive widgets. Backend tools are updated to include visual data (airline logos, photos, coordinates) in their responses.

**Tech Stack:** React 19, Next.js 15, SCSS modules, TanStack Query, Google Places API (photos + location), Google Maps Static API, SerpApi (existing)

---

## File Structure

### Backend (server/src/)

| File                                    | Action | Responsibility                                                                  |
| --------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| `tools/flights.tool.ts`                 | Modify | Add `airline_logo` to FlightResult                                              |
| `tools/hotels.tool.ts`                  | Modify | Add `image_url`, `latitude`, `longitude` to HotelResult                         |
| `tools/experiences.tool.ts`             | Modify | Add `photo_ref`, `latitude`, `longitude` to ExperienceResult; update FIELD_MASK |
| `routes/places.ts`                      | Create | Photo proxy route                                                               |
| `handlers/places/photoProxy.handler.ts` | Create | Proxy Google Places photos                                                      |

### Frontend (web-client/src/components/ChatBox/)

| File                                      | Action | Responsibility                              |
| ----------------------------------------- | ------ | ------------------------------------------- |
| `ChatBox.tsx`                             | Modify | Store tool results in state, render widgets |
| `ChatBox.module.scss`                     | Modify | Styles for widget integration areas         |
| `widgets/FlightCard.tsx`                  | Create | Flight result card                          |
| `widgets/FlightCard.module.scss`          | Create | Flight card styles                          |
| `widgets/HotelCard.tsx`                   | Create | Hotel result card                           |
| `widgets/HotelCard.module.scss`           | Create | Hotel card styles                           |
| `widgets/ExperienceCard.tsx`              | Create | Experience result card                      |
| `widgets/ExperienceCard.module.scss`      | Create | Experience card styles                      |
| `widgets/SelectableCardGroup.tsx`         | Create | Selection wrapper + confirm button          |
| `widgets/SelectableCardGroup.module.scss` | Create | Card group styles                           |
| `widgets/QuickReplyChips.tsx`             | Create | Clickable reply chips                       |
| `widgets/QuickReplyChips.module.scss`     | Create | Chip styles                                 |
| `widgets/InlineBudgetBar.tsx`             | Create | Budget progress bar                         |
| `widgets/InlineBudgetBar.module.scss`     | Create | Budget bar styles                           |
| `widgets/ItineraryTimeline.tsx`           | Create | Day-by-day timeline                         |
| `widgets/ItineraryTimeline.module.scss`   | Create | Timeline styles                             |
| `widgets/MapPreviewCard.tsx`              | Create | Static Google Maps card                     |
| `widgets/MapPreviewCard.module.scss`      | Create | Map card styles                             |

---

## Phase 1: Rich Message Rendering

### Task 1: Add airline_logo to FlightResult

**Files:**

- Modify: `server/src/tools/flights.tool.ts`
- Test: `server/src/tools/flights.tool.test.ts`

- [ ] **Step 1: Add airline_logo to FlightResult interface**

In `server/src/tools/flights.tool.ts`, add `airline_logo` to the `FlightResult` interface:

```typescript
export interface FlightResult {
  offer_id: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  airline: string;
  airline_logo: string | null; // ← ADD THIS
  flight_number: string;
  price: number;
  currency: string;
  cabin_class: string | null;
  segments: Array<{
    departure: { iataCode: string; at: string };
    arrival: { iataCode: string; at: string };
    carrierCode: string;
    number: string;
  }>;
}
```

- [ ] **Step 2: Update normalizeOffer to pass through airline_logo**

In the `normalizeOffer` function, add the field:

```typescript
function normalizeOffer(offer: SerpApiFlight, index: number): FlightResult {
  const firstLeg = offer.flights[0];
  const lastLeg = offer.flights[offer.flights.length - 1];

  return {
    offer_id: `serpapi-flight-${index}`,
    origin: firstLeg?.departure_airport.id ?? '',
    destination: lastLeg?.arrival_airport.id ?? '',
    departure_time: firstLeg?.departure_airport.time ?? '',
    arrival_time: lastLeg?.arrival_airport.time ?? '',
    airline: firstLeg?.airline ?? '',
    airline_logo: firstLeg?.airline_logo ?? null, // ← ADD THIS
    flight_number: firstLeg?.flight_number ?? '',
    price: offer.price,
    currency: 'USD',
    cabin_class: null,
    segments: offer.flights.map((f) => ({
      departure: {
        iataCode: f.departure_airport.id,
        at: f.departure_airport.time,
      },
      arrival: { iataCode: f.arrival_airport.id, at: f.arrival_airport.time },
      carrierCode: f.airline,
      number: f.flight_number,
    })),
  };
}
```

- [ ] **Step 3: Update tests**

In `flights.tool.test.ts`, add `airline_logo` to the expected result in existing tests. Find the test assertions for `normalizeOffer` or `searchFlights` and add `airline_logo: null` (or the test fixture's value) to each expected FlightResult.

- [ ] **Step 4: Run tests**

Run: `cd server && npx vitest run src/tools/flights.tool.test.ts`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add server/src/tools/flights.tool.ts server/src/tools/flights.tool.test.ts
git commit -m "feat: add airline_logo to FlightResult"
```

---

### Task 2: Add image_url and coordinates to HotelResult

**Files:**

- Modify: `server/src/tools/hotels.tool.ts`
- Test: `server/src/tools/hotels.tool.test.ts`

- [ ] **Step 1: Add fields to HotelResult interface**

```typescript
export interface HotelResult {
  hotel_id: string;
  offer_id: string;
  name: string;
  address: string;
  city: string;
  star_rating: number | null;
  total_price: number;
  price_per_night: number;
  currency: string;
  check_in: string;
  check_out: string;
  image_url: string | null; // ← ADD
  latitude: number | null; // ← ADD
  longitude: number | null; // ← ADD
}
```

- [ ] **Step 2: Update SerpApiHotel to capture images**

The SerpApiHotel interface already has `gps_coordinates`. Add image fields:

```typescript
interface SerpApiHotel {
  name: string;
  overall_rating: number;
  hotel_class: number | string;
  rate_per_night?: { lowest: string; extracted_lowest: number };
  total_rate?: { lowest: string; extracted_lowest: number };
  nearby_places?: Array<{ name: string }>;
  gps_coordinates?: { latitude: number; longitude: number };
  check_in_time?: string;
  check_out_time?: string;
  link?: string;
  images?: Array<{ thumbnail: string; original_image?: string }>; // ← ADD
}
```

- [ ] **Step 3: Update normalizeHotel**

```typescript
function normalizeHotel(
  entry: SerpApiHotel,
  index: number,
  input: HotelSearchInput,
): HotelResult {
  return {
    hotel_id: `serpapi-hotel-${index}`,
    offer_id: `serpapi-hotel-offer-${index}`,
    name: entry.name,
    address: '',
    city: input.city,
    star_rating: parseStarRating(entry.hotel_class),
    total_price:
      entry.total_rate?.extracted_lowest ??
      entry.rate_per_night?.extracted_lowest ??
      0,
    price_per_night: entry.rate_per_night?.extracted_lowest ?? 0,
    currency: 'USD',
    check_in: input.check_in,
    check_out: input.check_out,
    image_url: entry.images?.[0]?.thumbnail ?? null, // ← ADD
    latitude: entry.gps_coordinates?.latitude ?? null, // ← ADD
    longitude: entry.gps_coordinates?.longitude ?? null, // ← ADD
  };
}
```

- [ ] **Step 4: Update tests**

Add `image_url: null`, `latitude: null`, `longitude: null` to expected HotelResult objects in tests.

- [ ] **Step 5: Run tests**

Run: `cd server && npx vitest run src/tools/hotels.tool.test.ts`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add server/src/tools/hotels.tool.ts server/src/tools/hotels.tool.test.ts
git commit -m "feat: add image_url and coordinates to HotelResult"
```

---

### Task 3: Add photo_ref and coordinates to ExperienceResult

**Files:**

- Modify: `server/src/tools/experiences.tool.ts`
- Test: `server/src/tools/experiences.tool.test.ts`

- [ ] **Step 1: Update FIELD_MASK**

```typescript
const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.rating,places.priceLevel,places.primaryTypeDisplayName,places.photos,places.location';
```

- [ ] **Step 2: Add fields to ExperienceResult interface**

```typescript
export interface ExperienceResult {
  place_id: string;
  name: string;
  address: string;
  rating: number | null;
  price_level: string | null;
  estimated_cost: number | null;
  category: string | null;
  photo_ref: string | null; // ← ADD
  latitude: number | null; // ← ADD
  longitude: number | null; // ← ADD
}
```

- [ ] **Step 3: Update GooglePlace interface**

```typescript
interface GooglePlace {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  rating?: number;
  priceLevel?: string;
  primaryTypeDisplayName?: { text: string };
  photos?: Array<{ name: string }>; // ← ADD
  location?: { latitude: number; longitude: number }; // ← ADD
}
```

- [ ] **Step 4: Update normalizePlace**

```typescript
function normalizePlace(place: GooglePlace): ExperienceResult {
  return {
    place_id: place.id,
    name: place.displayName.text,
    address: place.formattedAddress,
    rating: place.rating ?? null,
    price_level: place.priceLevel ?? null,
    estimated_cost: place.priceLevel
      ? (PRICE_LEVEL_MAP[place.priceLevel] ?? null)
      : null,
    category: place.primaryTypeDisplayName?.text ?? null,
    photo_ref: place.photos?.[0]?.name ?? null, // ← ADD
    latitude: place.location?.latitude ?? null, // ← ADD
    longitude: place.location?.longitude ?? null, // ← ADD
  };
}
```

- [ ] **Step 5: Update tests**

Add `photo_ref: null`, `latitude: null`, `longitude: null` to expected ExperienceResult objects.

- [ ] **Step 6: Run tests**

Run: `cd server && npx vitest run src/tools/experiences.tool.test.ts`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add server/src/tools/experiences.tool.ts server/src/tools/experiences.tool.test.ts
git commit -m "feat: add photo_ref and coordinates to ExperienceResult"
```

---

### Task 4: Google Places photo proxy endpoint

**Files:**

- Create: `server/src/routes/places.ts`
- Create: `server/src/handlers/places/photoProxy.handler.ts`
- Modify: `server/src/app.ts` (mount route)

- [ ] **Step 1: Create photo proxy handler**

Create `server/src/handlers/places/photoProxy.handler.ts`:

```typescript
import type { Request, Response } from 'express';

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? '';

export async function photoProxyHandler(req: Request, res: Response) {
  const ref = req.query.ref as string;
  const maxwidth = parseInt(req.query.maxwidth as string, 10) || 400;

  if (!ref) {
    res
      .status(400)
      .json({ error: 'MISSING_PARAM', message: 'ref is required' });
    return;
  }

  try {
    const url = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=${maxwidth}&key=${GOOGLE_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      res.status(response.status).json({ error: 'PHOTO_FETCH_FAILED' });
      return;
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch {
    res.status(502).json({ error: 'PHOTO_PROXY_ERROR' });
  }
}
```

- [ ] **Step 2: Create places route**

Create `server/src/routes/places.ts`:

```typescript
import { Router } from 'express';

import { photoProxyHandler } from '../handlers/places/photoProxy.handler.js';

const router = Router();

router.get('/photo', photoProxyHandler);

export default router;
```

- [ ] **Step 3: Mount route in app.ts**

In `server/src/app.ts`, import and mount the places router. Find where other routes are mounted (e.g., `app.use('/trips', tripsRouter)`) and add:

```typescript
import placesRouter from './routes/places.js';

// ...
app.use('/places', placesRouter);
```

- [ ] **Step 4: Run server tests**

Run: `cd server && npx vitest run`
Expected: All existing tests pass (no regressions)

- [ ] **Step 5: Commit**

```bash
git add server/src/handlers/places/photoProxy.handler.ts server/src/routes/places.ts server/src/app.ts
git commit -m "feat: add Google Places photo proxy endpoint"
```

---

### Task 5: FlightCard widget

**Files:**

- Create: `web-client/src/components/ChatBox/widgets/FlightCard.tsx`
- Create: `web-client/src/components/ChatBox/widgets/FlightCard.module.scss`

- [ ] **Step 1: Create FlightCard component**

Create `web-client/src/components/ChatBox/widgets/FlightCard.tsx`:

```tsx
import styles from './FlightCard.module.scss';

interface FlightCardProps {
  airline: string;
  airlineLogo: string | null;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  price: number;
  currency: string;
  selected?: boolean;
  onClick?: () => void;
}

export function FlightCard({
  airline,
  airlineLogo,
  flightNumber,
  origin,
  destination,
  departureTime,
  price,
  currency,
  selected,
  onClick,
}: FlightCardProps) {
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);

  const formattedTime = departureTime
    ? new Date(departureTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <button
      type='button'
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div className={styles.logoArea}>
        {airlineLogo ? (
          <img src={airlineLogo} alt={airline} className={styles.logo} />
        ) : (
          <div className={styles.logoFallback}>{airline.slice(0, 2)}</div>
        )}
      </div>
      <div className={styles.details}>
        <span className={styles.airline}>
          {airline} {flightNumber}
        </span>
        <span className={styles.route}>
          {origin} → {destination}
        </span>
        {formattedTime && <span className={styles.time}>{formattedTime}</span>}
      </div>
      <div className={styles.priceArea}>
        <span className={styles.price}>{formattedPrice}</span>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Create FlightCard styles**

Create `web-client/src/components/ChatBox/widgets/FlightCard.module.scss`:

```scss
.card {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 16px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--background);
  cursor: pointer;
  font-family: var(--font-body);
  text-align: left;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);

  &:hover {
    border-color: var(--accent);
  }

  &.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1);
  }
}

.logoArea {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo {
  width: 36px;
  height: 36px;
  object-fit: contain;
  border-radius: 6px;
}

.logoFallback {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: var(--surface-alt);
  color: var(--foreground-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}

.details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.airline {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
}

.route {
  font-size: 13px;
  color: var(--foreground-muted);
}

.time {
  font-size: 12px;
  color: var(--foreground-muted);
}

.priceArea {
  flex-shrink: 0;
}

.price {
  font-size: 18px;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--accent);
}
```

- [ ] **Step 3: Build to verify**

Run: `cd web-client && npx next build`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add web-client/src/components/ChatBox/widgets/FlightCard.tsx web-client/src/components/ChatBox/widgets/FlightCard.module.scss
git commit -m "feat: add FlightCard widget component"
```

---

### Task 6: HotelCard widget

**Files:**

- Create: `web-client/src/components/ChatBox/widgets/HotelCard.tsx`
- Create: `web-client/src/components/ChatBox/widgets/HotelCard.module.scss`

- [ ] **Step 1: Create HotelCard component**

Create `web-client/src/components/ChatBox/widgets/HotelCard.tsx`:

```tsx
import styles from './HotelCard.module.scss';

interface HotelCardProps {
  name: string;
  city: string;
  imageUrl: string | null;
  starRating: number | null;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  checkIn: string;
  checkOut: string;
  selected?: boolean;
  onClick?: () => void;
}

export function HotelCard({
  name,
  city,
  imageUrl,
  starRating,
  pricePerNight,
  totalPrice,
  currency,
  checkIn,
  checkOut,
  selected,
  onClick,
}: HotelCardProps) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <button
      type='button'
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div className={styles.imageArea}>
        {imageUrl ? (
          <img src={imageUrl} alt={name} className={styles.image} />
        ) : (
          <div className={styles.imageFallback} />
        )}
      </div>
      <div className={styles.body}>
        <div className={styles.header}>
          <span className={styles.name}>{name}</span>
          {starRating && (
            <span className={styles.stars}>
              {'★'.repeat(Math.round(starRating))}
            </span>
          )}
        </div>
        <span className={styles.city}>{city}</span>
        <span className={styles.dates}>
          {formatDate(checkIn)} – {formatDate(checkOut)}
        </span>
        <div className={styles.pricing}>
          <span className={styles.perNight}>{fmt(pricePerNight)}/night</span>
          <span className={styles.total}>{fmt(totalPrice)} total</span>
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Create HotelCard styles**

Create `web-client/src/components/ChatBox/widgets/HotelCard.module.scss`:

```scss
.card {
  display: flex;
  flex-direction: column;
  width: 200px;
  flex-shrink: 0;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--background);
  overflow: hidden;
  cursor: pointer;
  font-family: var(--font-body);
  text-align: left;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);

  &:hover {
    border-color: var(--accent);
  }

  &.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1);
  }
}

.imageArea {
  height: 120px;
  overflow: hidden;
}

.image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.imageFallback {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--surface-alt), var(--surface));
}

.body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.name {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stars {
  font-size: 11px;
  color: var(--accent);
  flex-shrink: 0;
}

.city,
.dates {
  font-size: 12px;
  color: var(--foreground-muted);
}

.pricing {
  margin-top: 6px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.perNight {
  font-size: 15px;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--accent);
}

.total {
  font-size: 11px;
  color: var(--foreground-muted);
}
```

- [ ] **Step 3: Build to verify**

Run: `cd web-client && npx next build`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add web-client/src/components/ChatBox/widgets/HotelCard.tsx web-client/src/components/ChatBox/widgets/HotelCard.module.scss
git commit -m "feat: add HotelCard widget component"
```

---

### Task 7: ExperienceCard widget

**Files:**

- Create: `web-client/src/components/ChatBox/widgets/ExperienceCard.tsx`
- Create: `web-client/src/components/ChatBox/widgets/ExperienceCard.module.scss`

- [ ] **Step 1: Create ExperienceCard component**

Create `web-client/src/components/ChatBox/widgets/ExperienceCard.tsx`:

```tsx
import styles from './ExperienceCard.module.scss';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface ExperienceCardProps {
  name: string;
  category: string | null;
  photoRef: string | null;
  rating: number | null;
  estimatedCost: number | null;
  selected?: boolean;
  onClick?: () => void;
}

export function ExperienceCard({
  name,
  category,
  photoRef,
  rating,
  estimatedCost,
  selected,
  onClick,
}: ExperienceCardProps) {
  const photoUrl = photoRef
    ? `${API_BASE}/places/photo?ref=${encodeURIComponent(photoRef)}&maxwidth=400`
    : null;

  return (
    <button
      type='button'
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={onClick}
      aria-pressed={selected}
    >
      <div className={styles.imageArea}>
        {photoUrl ? (
          <img src={photoUrl} alt={name} className={styles.image} />
        ) : (
          <div className={styles.imageFallback} />
        )}
      </div>
      <div className={styles.body}>
        <span className={styles.name}>{name}</span>
        {category && <span className={styles.category}>{category}</span>}
        <div className={styles.meta}>
          {rating != null && (
            <span className={styles.rating}>★ {rating.toFixed(1)}</span>
          )}
          {estimatedCost != null && (
            <span className={styles.cost}>~${estimatedCost}</span>
          )}
        </div>
      </div>
    </button>
  );
}
```

- [ ] **Step 2: Create ExperienceCard styles**

Create `web-client/src/components/ChatBox/widgets/ExperienceCard.module.scss`:

```scss
.card {
  display: flex;
  flex-direction: column;
  width: 200px;
  flex-shrink: 0;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--background);
  overflow: hidden;
  cursor: pointer;
  font-family: var(--font-body);
  text-align: left;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);

  &:hover {
    border-color: var(--accent);
  }

  &.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1);
  }
}

.imageArea {
  height: 130px;
  overflow: hidden;
}

.image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.imageFallback {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, var(--surface-alt), var(--surface));
}

.body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.name {
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground);
}

.category {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--foreground-muted);
}

.meta {
  margin-top: 6px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.rating {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.cost {
  font-size: 13px;
  color: var(--foreground-muted);
}
```

- [ ] **Step 3: Build to verify**

Run: `cd web-client && npx next build`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add web-client/src/components/ChatBox/widgets/ExperienceCard.tsx web-client/src/components/ChatBox/widgets/ExperienceCard.module.scss
git commit -m "feat: add ExperienceCard widget component"
```

---

### Task 8: SelectableCardGroup wrapper

**Files:**

- Create: `web-client/src/components/ChatBox/widgets/SelectableCardGroup.tsx`
- Create: `web-client/src/components/ChatBox/widgets/SelectableCardGroup.module.scss`

- [ ] **Step 1: Create SelectableCardGroup**

Create `web-client/src/components/ChatBox/widgets/SelectableCardGroup.tsx`:

```tsx
'use client';

import { type ReactNode, useState } from 'react';

import styles from './SelectableCardGroup.module.scss';

interface SelectableCardGroupProps {
  items: Array<{
    id: string;
    label: string;
    node: (selected: boolean, onClick: () => void) => ReactNode;
  }>;
  onConfirm: (selectedLabel: string) => void;
  disabled?: boolean;
  confirmedId?: string | null;
}

export function SelectableCardGroup({
  items,
  onConfirm,
  disabled,
  confirmedId,
}: SelectableCardGroupProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    confirmedId ?? null,
  );
  const isLocked = confirmedId != null;

  return (
    <div className={styles.group}>
      <div className={styles.cards}>
        {items.map((item) => (
          <div key={item.id}>
            {item.node(
              selectedId === item.id,
              () =>
                !isLocked &&
                setSelectedId(item.id === selectedId ? null : item.id),
            )}
          </div>
        ))}
      </div>
      {!isLocked && selectedId && (
        <button
          type='button'
          className={styles.confirmBtn}
          onClick={() => {
            const item = items.find((i) => i.id === selectedId);
            if (item) onConfirm(item.label);
          }}
          disabled={disabled}
        >
          Confirm Selection
        </button>
      )}
      {isLocked && (
        <p className={styles.confirmed}>
          ✓ {items.find((i) => i.id === confirmedId)?.label ?? 'Selected'}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create styles**

Create `web-client/src/components/ChatBox/widgets/SelectableCardGroup.module.scss`:

```scss
.group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0;
}

.cards {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 2px;
  }
}

.confirmBtn {
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #0a0e17;
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font-body);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    box-shadow var(--transition-fast);
  align-self: flex-start;

  &:hover:not(:disabled) {
    background: var(--accent-hover);
    box-shadow: var(--shadow-glow);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.confirmed {
  font-size: 13px;
  font-weight: 600;
  color: var(--success);
}
```

- [ ] **Step 3: Build to verify**

Run: `cd web-client && npx next build`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add web-client/src/components/ChatBox/widgets/SelectableCardGroup.tsx web-client/src/components/ChatBox/widgets/SelectableCardGroup.module.scss
git commit -m "feat: add SelectableCardGroup widget"
```

---

### Task 9: QuickReplyChips widget

**Files:**

- Create: `web-client/src/components/ChatBox/widgets/QuickReplyChips.tsx`
- Create: `web-client/src/components/ChatBox/widgets/QuickReplyChips.module.scss`

- [ ] **Step 1: Create QuickReplyChips**

Create `web-client/src/components/ChatBox/widgets/QuickReplyChips.tsx`:

```tsx
import styles from './QuickReplyChips.module.scss';

interface QuickReplyChipsProps {
  chips: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export function QuickReplyChips({
  chips,
  onSelect,
  disabled,
}: QuickReplyChipsProps) {
  return (
    <div className={styles.chips} role='group' aria-label='Quick replies'>
      {chips.map((chip) => (
        <button
          key={chip}
          type='button'
          className={styles.chip}
          onClick={() => onSelect(chip)}
          disabled={disabled}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

/**
 * Parse assistant text and return quick reply chip labels, or null if no pattern matches.
 */
export function parseQuickReplies(text: string): string[] | null {
  const trimmed = text.trim();
  if (!trimmed.endsWith('?')) return null;

  const lower = trimmed.toLowerCase();

  // Yes/No patterns
  if (
    /(?:would you like|shall i|should i|do you want|want me to|ready to)\b/.test(
      lower,
    )
  ) {
    return ['Yes, please', 'No thanks'];
  }

  // "A or B" pattern (short phrases)
  const orMatch = trimmed.match(/\b(.{3,30})\s+or\s+(.{3,30})\?$/i);
  if (orMatch) {
    return [orMatch[1].trim(), orMatch[2].trim().replace(/\?$/, '')];
  }

  return null;
}
```

- [ ] **Step 2: Create styles**

Create `web-client/src/components/ChatBox/widgets/QuickReplyChips.module.scss`:

```scss
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 0 4px;
  animation: fadeIn 0.25s var(--ease-out);
}

.chip {
  padding: 8px 18px;
  border: 1.5px solid var(--border);
  border-radius: 100px;
  background: var(--surface-alt);
  color: var(--foreground);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);

  &:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--accent-light);
    color: var(--accent);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 3: Build to verify**

Run: `cd web-client && npx next build`
Expected: Compiles successfully

- [ ] **Step 4: Commit**

```bash
git add web-client/src/components/ChatBox/widgets/QuickReplyChips.tsx web-client/src/components/ChatBox/widgets/QuickReplyChips.module.scss
git commit -m "feat: add QuickReplyChips widget"
```

---

### Task 10: Wire widgets into ChatBox

**Files:**

- Modify: `web-client/src/components/ChatBox/ChatBox.tsx`
- Modify: `web-client/src/components/ChatBox/ChatBox.module.scss`

This is the integration task. It connects tool results to card widgets and adds quick reply detection.

- [ ] **Step 1: Add toolResults state and imports**

At the top of `ChatBox.tsx`, add imports:

```typescript
import { ExperienceCard } from './widgets/ExperienceCard';
import { FlightCard } from './widgets/FlightCard';
import { HotelCard } from './widgets/HotelCard';
import { QuickReplyChips, parseQuickReplies } from './widgets/QuickReplyChips';
import { SelectableCardGroup } from './widgets/SelectableCardGroup';
```

Add state inside the component:

```typescript
const [toolResults, setToolResults] = useState<
  Record<string, { tool_name: string; result: unknown }>
>({});
```

- [ ] **Step 2: Store tool results from SSE**

In the `tool_result` case of `handleSSEEvent`, after updating tool progress, also store the result:

```typescript
case "tool_result":
    setTools((prev) =>
        prev.map((t) =>
            t.tool_id === data.tool_id
                ? { ...t, status: "done" as const }
                : t,
        ),
    );
    setToolResults((prev) => ({
        ...prev,
        [data.tool_id as string]: {
            tool_name: (data.tool_name as string) ?? '',
            result: data.result,
        },
    }));
    queryClient.invalidateQueries({ queryKey: ["trips", tripId] });
    break;
```

- [ ] **Step 3: Clear toolResults in finally block**

In the `finally` block of `sendMessage`, add:

```typescript
setToolResults({});
```

- [ ] **Step 4: Render tool result cards after tool progress**

Replace the existing tool progress rendering block (the one with `isSending && tools.length > 0`) with:

```tsx
{
  isSending && tools.length > 0 && (
    <div className={`${styles.message} ${styles.assistant}`}>
      <div className={styles.roleBadge}>{APP_NAME}</div>
      <div className={styles.toolProgress}>
        {tools.map((t) => (
          <div key={t.tool_id} className={styles.toolRow}>
            <span className={styles.toolIcon}>
              {t.status === 'running' ? '\u23F3' : '\u2705'}
            </span>
            <span>{toolLabel(t.tool_name)}</span>
          </div>
        ))}
      </div>
      {/* Render result cards for completed tools */}
      {Object.entries(toolResults).map(([toolId, { tool_name, result }]) => {
        if (tool_name === 'search_flights' && Array.isArray(result)) {
          return (
            <div key={toolId} className={styles.resultCards}>
              <SelectableCardGroup
                items={(result as Array<Record<string, unknown>>).map(
                  (f, i) => ({
                    id: String(i),
                    label: `${f.airline} ${f.flight_number} (${f.origin}→${f.destination}) - $${f.price}`,
                    node: (sel, click) => (
                      <FlightCard
                        airline={f.airline as string}
                        airlineLogo={(f.airline_logo as string) ?? null}
                        flightNumber={f.flight_number as string}
                        origin={f.origin as string}
                        destination={f.destination as string}
                        departureTime={f.departure_time as string}
                        price={f.price as number}
                        currency={(f.currency as string) ?? 'USD'}
                        selected={sel}
                        onClick={click}
                      />
                    ),
                  }),
                )}
                onConfirm={(label) => sendMessage(`I'll go with ${label}`)}
                disabled={isSending}
              />
            </div>
          );
        }
        if (tool_name === 'search_hotels' && Array.isArray(result)) {
          return (
            <div key={toolId} className={styles.resultCards}>
              <SelectableCardGroup
                items={(result as Array<Record<string, unknown>>).map(
                  (h, i) => ({
                    id: String(i),
                    label: `${h.name} - $${h.total_price}`,
                    node: (sel, click) => (
                      <HotelCard
                        name={h.name as string}
                        city={h.city as string}
                        imageUrl={(h.image_url as string) ?? null}
                        starRating={(h.star_rating as number) ?? null}
                        pricePerNight={h.price_per_night as number}
                        totalPrice={h.total_price as number}
                        currency={(h.currency as string) ?? 'USD'}
                        checkIn={h.check_in as string}
                        checkOut={h.check_out as string}
                        selected={sel}
                        onClick={click}
                      />
                    ),
                  }),
                )}
                onConfirm={(label) => sendMessage(`I'll go with ${label}`)}
                disabled={isSending}
              />
            </div>
          );
        }
        if (tool_name === 'search_experiences' && Array.isArray(result)) {
          return (
            <div key={toolId} className={styles.resultCards}>
              <SelectableCardGroup
                items={(result as Array<Record<string, unknown>>).map(
                  (e, i) => ({
                    id: String(i),
                    label: `${e.name} (~$${e.estimated_cost ?? '?'})`,
                    node: (sel, click) => (
                      <ExperienceCard
                        name={e.name as string}
                        category={(e.category as string) ?? null}
                        photoRef={(e.photo_ref as string) ?? null}
                        rating={(e.rating as number) ?? null}
                        estimatedCost={(e.estimated_cost as number) ?? null}
                        selected={sel}
                        onClick={click}
                      />
                    ),
                  }),
                )}
                onConfirm={(label) => sendMessage(`I'd like to add ${label}`)}
                disabled={isSending}
              />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
```

- [ ] **Step 5: Add QuickReplyChips to last assistant message**

After the message rendering loop (after the streaming text block), before the booking actions, add quick reply detection. Find the `{streamingText && isSending && (` block and after its closing `)}`, add:

```tsx
{
  /* Quick reply chips for last assistant message */
}
{
  !isSending &&
    allMessages.length > 0 &&
    allMessages[allMessages.length - 1].role === 'assistant' &&
    (() => {
      const chips = parseQuickReplies(
        allMessages[allMessages.length - 1].content,
      );
      return chips ? (
        <QuickReplyChips
          chips={chips}
          onSelect={sendMessage}
          disabled={isSending}
        />
      ) : null;
    })();
}
```

- [ ] **Step 6: Add resultCards style**

In `ChatBox.module.scss`, add before the booking actions section:

```scss
/* — Result cards — */

.resultCards {
  margin-top: 12px;
  max-width: 100%;
  overflow-x: auto;
}
```

- [ ] **Step 7: Build and verify**

Run: `cd web-client && npx next build`
Expected: Compiles successfully

- [ ] **Step 8: Commit**

```bash
git add web-client/src/components/ChatBox/ChatBox.tsx web-client/src/components/ChatBox/ChatBox.module.scss
git commit -m "feat: wire FlightCard, HotelCard, ExperienceCard, QuickReplyChips into ChatBox"
```

---

## Phase 2: Visual Media

### Task 11: MapPreviewCard widget

**Files:**

- Create: `web-client/src/components/ChatBox/widgets/MapPreviewCard.tsx`
- Create: `web-client/src/components/ChatBox/widgets/MapPreviewCard.module.scss`

- [ ] **Step 1: Create MapPreviewCard**

Create `web-client/src/components/ChatBox/widgets/MapPreviewCard.tsx`:

```tsx
import styles from './MapPreviewCard.module.scss';

interface MapPreviewCardProps {
  latitude: number;
  longitude: number;
  name: string;
}

export function MapPreviewCard({
  latitude,
  longitude,
  name,
}: MapPreviewCardProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';
  const src = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=300x160&scale=2&markers=color:0x38bdf8|${latitude},${longitude}&style=feature:all|element:geometry|color:0x131926&style=feature:water|color:0x0a0e17&style=feature:road|color:0x1e2a3f&style=feature:poi|visibility:off&style=feature:all|element:labels.text.fill|color:0x7b8599&key=${apiKey}`;

  return (
    <div className={styles.card}>
      {apiKey ? (
        <img src={src} alt={`Map showing ${name}`} className={styles.map} />
      ) : (
        <div className={styles.fallback}>📍 {name}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create styles**

Create `web-client/src/components/ChatBox/widgets/MapPreviewCard.module.scss`:

```scss
.card {
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px solid var(--border-light);
  margin-top: 8px;
}

.map {
  display: block;
  width: 100%;
  height: auto;
  max-width: 300px;
}

.fallback {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: var(--foreground-muted);
  background: var(--surface-alt);
}
```

- [ ] **Step 3: Add map to HotelCard and ExperienceCard**

In `HotelCard.tsx`, add the MapPreviewCard import and props (`latitude`, `longitude`). After the body div, conditionally render:

```tsx
{
  latitude != null && longitude != null && (
    <MapPreviewCard latitude={latitude} longitude={longitude} name={name} />
  );
}
```

Do the same in `ExperienceCard.tsx`.

- [ ] **Step 4: Build to verify**

Run: `cd web-client && npx next build`
Expected: Compiles successfully

- [ ] **Step 5: Commit**

```bash
git add web-client/src/components/ChatBox/widgets/MapPreviewCard.tsx web-client/src/components/ChatBox/widgets/MapPreviewCard.module.scss web-client/src/components/ChatBox/widgets/HotelCard.tsx web-client/src/components/ChatBox/widgets/ExperienceCard.tsx
git commit -m "feat: add MapPreviewCard and integrate into hotel/experience cards"
```

---

## Phase 3: Inline Widgets

### Task 12: InlineBudgetBar widget

**Files:**

- Create: `web-client/src/components/ChatBox/widgets/InlineBudgetBar.tsx`
- Create: `web-client/src/components/ChatBox/widgets/InlineBudgetBar.module.scss`

- [ ] **Step 1: Create InlineBudgetBar**

Create `web-client/src/components/ChatBox/widgets/InlineBudgetBar.tsx`:

```tsx
import styles from './InlineBudgetBar.module.scss';

interface InlineBudgetBarProps {
  allocated: number;
  total: number;
  currency: string;
}

export function InlineBudgetBar({
  allocated,
  total,
  currency,
}: InlineBudgetBarProps) {
  const pct = Math.min((allocated / total) * 100, 100);
  const remaining = total - allocated;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className={styles.bar}>
      <div className={styles.track}>
        <div
          className={`${styles.fill} ${remaining < 0 ? styles.over : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={styles.labels}>
        <span>{fmt(allocated)} allocated</span>
        <span className={remaining < 0 ? styles.overText : ''}>
          {fmt(Math.abs(remaining))} {remaining < 0 ? 'over' : 'remaining'}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create styles**

Create `web-client/src/components/ChatBox/widgets/InlineBudgetBar.module.scss`:

```scss
.bar {
  padding: 12px 0;
  animation: fadeIn 0.3s var(--ease-out);
}

.track {
  height: 6px;
  border-radius: 3px;
  background: var(--surface-alt);
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: 3px;
  background: var(--accent);
  transition: width 0.5s var(--ease-out);

  &.over {
    background: var(--danger);
  }
}

.labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 12px;
  color: var(--foreground-muted);
}

.overText {
  color: var(--danger);
  font-weight: 600;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

- [ ] **Step 3: Integrate into ChatBox**

In `ChatBox.tsx`, import `InlineBudgetBar`. Pass trip budget data via new props on ChatBox: `budgetTotal?: number | null` and `budgetAllocated?: number | null` and `budgetCurrency?: string`.

After the tool result cards rendering, when there are completed tools and budget is set, render:

```tsx
{
  budgetTotal != null && budgetAllocated != null && budgetTotal > 0 && (
    <InlineBudgetBar
      allocated={budgetAllocated}
      total={budgetTotal}
      currency={budgetCurrency ?? 'USD'}
    />
  );
}
```

Update `ChatBoxProps` to accept these new props. Update the trip detail page to pass them from the trip query data.

- [ ] **Step 4: Build to verify**

Run: `cd web-client && npx next build`
Expected: Compiles successfully

- [ ] **Step 5: Commit**

```bash
git add web-client/src/components/ChatBox/widgets/InlineBudgetBar.tsx web-client/src/components/ChatBox/widgets/InlineBudgetBar.module.scss web-client/src/components/ChatBox/ChatBox.tsx web-client/src/app/\(protected\)/trips/\[id\]/page.tsx
git commit -m "feat: add InlineBudgetBar widget in chat"
```

---

### Task 13: ItineraryTimeline widget

**Files:**

- Create: `web-client/src/components/ChatBox/widgets/ItineraryTimeline.tsx`
- Create: `web-client/src/components/ChatBox/widgets/ItineraryTimeline.module.scss`

- [ ] **Step 1: Create ItineraryTimeline**

Create `web-client/src/components/ChatBox/widgets/ItineraryTimeline.tsx`:

```tsx
'use client';

import { useState } from 'react';

import styles from './ItineraryTimeline.module.scss';

interface DayPlan {
  dayNumber: number;
  title: string;
  items: string[];
}

interface ItineraryTimelineProps {
  days: DayPlan[];
}

export function ItineraryTimeline({ days }: ItineraryTimelineProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([1]));

  const toggle = (day: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });

  return (
    <div className={styles.timeline}>
      {days.map((day) => (
        <div key={day.dayNumber} className={styles.day}>
          <button
            type='button'
            className={styles.dayHeader}
            onClick={() => toggle(day.dayNumber)}
            aria-expanded={expanded.has(day.dayNumber)}
          >
            <span className={styles.dayBadge}>Day {day.dayNumber}</span>
            <span className={styles.dayTitle}>{day.title}</span>
            <span className={styles.chevron}>
              {expanded.has(day.dayNumber) ? '−' : '+'}
            </span>
          </button>
          {expanded.has(day.dayNumber) && (
            <ul className={styles.items}>
              {day.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Parse assistant text for day-by-day itinerary structure.
 * Returns null if no itinerary pattern is detected.
 */
export function parseItinerary(
  text: string,
): { before: string; days: DayPlan[]; after: string } | null {
  const lines = text.split('\n');
  const days: DayPlan[] = [];
  let currentDay: DayPlan | null = null;
  let itineraryStart = -1;
  let itineraryEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const dayMatch = line.match(/\*?\*?Day\s+(\d+)\s*[-—:]\s*(.+?)\*?\*?$/i);

    if (dayMatch) {
      if (itineraryStart === -1) itineraryStart = i;
      itineraryEnd = i;
      if (currentDay) days.push(currentDay);
      currentDay = {
        dayNumber: parseInt(dayMatch[1], 10),
        title: dayMatch[2].replace(/\*+/g, '').trim(),
        items: [],
      };
    } else if (
      currentDay &&
      (line.startsWith('•') || line.startsWith('-') || line.startsWith('*'))
    ) {
      currentDay.items.push(line.replace(/^[•\-*]\s*/, ''));
      itineraryEnd = i;
    } else if (currentDay && line === '') {
      // blank line inside itinerary, continue
    } else if (currentDay && !dayMatch) {
      // non-itinerary line after itinerary started — end
      break;
    }
  }
  if (currentDay) days.push(currentDay);

  if (days.length < 2) return null;

  const before = lines.slice(0, itineraryStart).join('\n').trimEnd();
  const after = lines
    .slice(itineraryEnd + 1)
    .join('\n')
    .trimStart();

  return { before, days, after };
}
```

- [ ] **Step 2: Create styles**

Create `web-client/src/components/ChatBox/widgets/ItineraryTimeline.module.scss`:

```scss
.timeline {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 0;
}

.day {
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--background);
}

.dayHeader {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  background: var(--surface-alt);
  border: none;
  cursor: pointer;
  font-family: var(--font-body);
  text-align: left;
  color: var(--foreground);
  transition: background var(--transition-fast);

  &:hover {
    background: var(--surface-hover);
  }
}

.dayBadge {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-text);
  padding: 2px 10px;
  background: var(--accent-light);
  border-radius: 100px;
  white-space: nowrap;
}

.dayTitle {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
}

.chevron {
  font-size: 16px;
  color: var(--foreground-muted);
  flex-shrink: 0;
}

.items {
  list-style: none;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  animation: slideDown 0.2s var(--ease-out);

  li {
    font-size: 13px;
    line-height: 1.5;
    color: var(--foreground);
    padding-left: 14px;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 8px;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--accent);
    }
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 3: Integrate into ChatBox message rendering**

In `ChatBox.tsx`, import `ItineraryTimeline` and `parseItinerary`. In the message rendering loop, after checking for `formData` (TripDetailsForm), add an itinerary check:

```tsx
const itineraryData =
  msg.role === 'assistant' ? parseItinerary(msg.content) : null;
```

Then in the bubble rendering, add another branch:

```tsx
{formData ? (
    // ... existing TripDetailsForm rendering
) : itineraryData ? (
    <>
        {renderText(itineraryData.before)}
        <ItineraryTimeline days={itineraryData.days} />
        {renderText(itineraryData.after)}
    </>
) : (
    renderText(msg.content)
)}
```

- [ ] **Step 4: Build to verify**

Run: `cd web-client && npx next build`
Expected: Compiles successfully

- [ ] **Step 5: Commit**

```bash
git add web-client/src/components/ChatBox/widgets/ItineraryTimeline.tsx web-client/src/components/ChatBox/widgets/ItineraryTimeline.module.scss web-client/src/components/ChatBox/ChatBox.tsx
git commit -m "feat: add ItineraryTimeline widget with day-by-day collapsible cards"
```

---

### Task 14: Deploy backend and frontend

- [ ] **Step 1: Deploy backend to Railway**

```bash
railway up --detach
```

Wait for build to complete. Verify health:

```bash
curl -s https://server-production-f028.up.railway.app/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 2: Deploy frontend to Vercel**

```bash
npx vercel --prod
```

Expected: Aliased to `https://interviewiangreenough.xyz`

- [ ] **Step 3: Commit deployment confirmation**

No code change needed. Verify the live site shows interactive cards when the agent returns search results.
