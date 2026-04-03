# Voyager — User Stories

Every testable user-facing flow in the application.

---

## Public Pages

### US-1: Home page discovery

**As a** visitor
**I want to** see the home page with hero images, feature highlights, a live demo chat, and clear CTAs
**So that** I understand what Voyager does and feel inspired to sign up

**Acceptance criteria:**

- Hero carousel rotates through 5 destination photos
- Feature cards (Real Flights, Curated Hotels, Local Experiences, Budget-Aware) are visible
- MockChatBox demo plays through a Monterey trip conversation
- "Get Started" and "Discover destinations" CTAs are prominent

---

### US-2: Browse destinations

**As a** visitor
**I want to** see a grid of 30 curated destination cards on the Explore page
**So that** I can discover places to travel

**Acceptance criteria:**

- 30 destination cards displayed in a responsive grid
- Each card shows: photo, city name, country, price indicator, best season, category tags
- Cards link to individual destination detail pages

---

### US-3: Filter destinations by category

**As a** visitor
**I want to** filter destinations by interest (Beach, City, Adventure, Romantic, Food & Wine, etc.)
**So that** I find destinations that match my travel style

**Acceptance criteria:**

- Category pill buttons displayed above the grid
- Clicking a category filters the grid instantly (client-side)
- "All" resets the filter
- Filtered count is less than total count

---

### US-4: Read a destination guide

**As a** visitor
**I want to** view a detailed destination page with experiences, dining, neighborhoods, weather, and visa info
**So that** I can learn about a destination before committing to a trip

**Acceptance criteria:**

- Hero image with city name and country
- Quick stats bar (currency, language, best season, daily budget, visa)
- About section with 2-3 paragraphs
- Top 10 Experiences with estimated costs
- Dining Highlights with cuisine and price level
- Neighborhoods with character descriptions
- Weather chart (12 months)
- Travel advisories (visa summary)
- "Plan a trip to [city]" CTA button

---

### US-5: Start a trip from a destination page

**As a** visitor viewing a destination
**I want to** click "Plan a trip" and be prompted to log in
**So that** I can start booking a trip to that destination

**Acceptance criteria:**

- "Plan a trip to [city]" CTA visible on detail page
- Clicking as unauthenticated user → redirected to /login
- After login, redirected to trip creation with destination pre-filled

---

### US-6: Read the FAQ

**As a** visitor
**I want to** read frequently asked questions
**So that** I understand how Voyager works before signing up

**Acceptance criteria:**

- FAQ page loads at /faq
- Questions are displayed (expandable or listed)

---

### US-7: Public navigation

**As a** visitor
**I want to** see Explore, FAQ, and Sign In links in the header
**So that** I can navigate the public areas of the app

**Acceptance criteria:**

- Header shows: Voyager logo, Explore, FAQ, Sign In
- All links navigate to the correct pages

---

## Authentication

### US-8: Register a new account

**As a** visitor
**I want to** create an account with my email and password
**So that** I can start planning trips

**Acceptance criteria:**

- Registration form accepts: first name, last name, email, password
- Successful registration opens the Preferences Wizard
- Account is created in the database

---

### US-9: Log in

**As a** registered user
**I want to** log in with my email and password
**So that** I can access my trips and account

**Acceptance criteria:**

- Login form accepts email and password
- Successful login redirects to /trips
- Header updates to show authenticated links (My Trips, Account, Sign Out)

---

### US-10: Failed login

**As a** visitor
**I want to** see an error message when I enter wrong credentials
**So that** I know what went wrong

**Acceptance criteria:**

- Error message displayed (e.g., "Invalid credentials")
- User stays on login page
- Form is not cleared

---

### US-11: Log out

**As a** logged-in user
**I want to** log out
**So that** my session is ended securely

**Acceptance criteria:**

- Sign Out button in header
- Clicking it clears the session
- User is redirected to home page
- Sign In link reappears in header

---

### US-12: Protected route redirect

**As an** unauthenticated user
**I want to** be redirected to login when accessing protected pages
**So that** my data is secure

**Acceptance criteria:**

- Accessing /trips, /account, /trips/new → redirected to /login
- After login, redirected back to the original page

---

## Trip Management

### US-13: View my trips

**As a** user
**I want to** see a list of all my trips
**So that** I can manage and continue planning them

**Acceptance criteria:**

- My Trips page shows trip cards or empty state
- Each card shows: destination image, city name, dates, budget, status badge
- "New Trip" button is visible

---

### US-14: Create a new trip

**As a** user
**I want to** create a new trip and start planning
**So that** I can begin my travel planning conversation

**Acceptance criteria:**

- Clicking "New Trip" creates a trip and redirects to /trips/[id]
- The trip detail page loads with the chat interface
- A welcome message or trip details form is visible

---

### US-15: View trip detail page

**As a** user
**I want to** see my trip's details including destination hero, budget, itinerary, and chat
**So that** I have a complete view of my trip planning

**Acceptance criteria:**

- Destination hero image (if destination is known)
- Budget card showing total and allocated
- Itinerary items (flights, hotels, experiences) if selected
- Chat section with input field
- "Back to trips" link

---

### US-16: Delete a trip

**As a** user
**I want to** delete a trip I no longer want
**So that** my trips list stays clean

**Acceptance criteria:**

- Delete button on each trip card
- Clicking delete removes the trip
- Trip disappears from the list

---

### US-17: Trip cards with images

**As a** user
**I want to** see beautiful destination images on my trip cards
**So that** my trips list is visually appealing

**Acceptance criteria:**

- Known destinations show Unsplash photos
- Unknown destinations show gradient fallback with city name
- Images are responsive

---

## Chat & Booking Flow

### US-18: Welcome message on new trip

**As a** user opening a new trip
**I want to** see a friendly welcome message asking for trip details
**So that** I know how to start planning

**Acceptance criteria:**

- Welcome text from Voyager visible
- Trip details form shown (if details are missing)
- Input field ready for messages

---

### US-19: Fill trip details form

**As a** user
**I want to** fill in my trip details (origin, dates, budget, travelers) via the form
**So that** the agent has the information needed to start searching

**Acceptance criteria:**

- Form fields for: origin, departure date, return date, budget, travelers
- Submitting the form sends structured data to the API
- Trip is updated in the database
- Form shows only missing fields (not already-provided ones)

---

### US-20: Send a chat message

**As a** user
**I want to** type a message and see it appear immediately in the chat
**So that** the conversation feels responsive

**Acceptance criteria:**

- Message appears in chat immediately after pressing Send (optimistic)
- User message styled as user bubble
- Input field clears after sending
- Send button disabled while processing

---

### US-21: See agent response

**As a** user
**I want to** see the agent's response with tool progress indicators
**So that** I know the agent is working and what it's doing

**Acceptance criteria:**

- Tool progress indicators (searching flights, etc.) appear during processing
- Agent response appears with Voyager role badge
- Response may include text, tiles, quick replies, or other nodes

---

### US-22: Browse tile cards (flights, hotels, cars, experiences)

**As a** user
**I want to** see interactive tile cards for search results
**So that** I can browse and compare options visually

**Acceptance criteria:**

- Flight cards show: airline, route, time, price
- Hotel cards show: name, star rating, price per night, total
- Car rental cards show: provider, car type, price per day, total
- Experience cards show: name, category, rating, estimated cost

---

### US-23: Select and confirm a tile card

**As a** user
**I want to** select an option from the tile cards and confirm it
**So that** my choice is saved to the trip

**Acceptance criteria:**

- Clicking a card selects it (visual highlight)
- "Confirm Selection" button appears
- Clicking confirm sends the selection to the agent
- Selection is persisted to the trip record

---

### US-24: Use quick reply chips

**As a** user
**I want to** click quick reply suggestions instead of typing
**So that** I can respond faster

**Acceptance criteria:**

- Quick reply chips visible below agent messages
- Clicking a chip sends it as a user message
- The chat advances based on the selected option

---

## Checkout & Booking Confirmation

### US-25: Open booking confirmation modal

**As a** user who has completed all booking categories
**I want to** click "Confirm booking" to review my selections
**So that** I can finalize my trip

**Acceptance criteria:**

- "Confirm booking" quick reply or button triggers the modal
- BookingConfirmation modal opens with destination photo header

---

### US-26: Review itemized breakdown

**As a** user in the booking confirmation modal
**I want to** see an itemized breakdown of all my selections with total cost
**So that** I can verify everything before confirming

**Acceptance criteria:**

- Flights, hotels, car rentals, and experiences listed with prices
- Total cost displayed
- Comparison against budget (under/over)

---

### US-27: Confirm and book the trip

**As a** user
**I want to** click "Confirm" to mark my trip as booked
**So that** my trip planning is complete

**Acceptance criteria:**

- Clicking Confirm transitions trip status to "saved"
- Booking animation plays (checkmark)
- Trip is now "booked"

---

### US-28: Booked trip locked state

**As a** user viewing a booked trip
**I want to** see a "Booked" badge and the chat input locked
**So that** I know this trip is finalized

**Acceptance criteria:**

- "Booked" badge visible on trip detail page
- Chat input disabled with "Trip booked! Enjoy your adventure." placeholder
- Trip card on /trips shows "Booked" status badge

---

## User Preferences

### US-29: Preferences wizard after registration

**As a** newly registered user
**I want to** be guided through travel preference questions
**So that** my trips are personalized from the start

**Acceptance criteria:**

- Wizard opens automatically after registration
- Shows the first preference step (Accommodation)

---

### US-30: Navigate through wizard steps

**As a** user in the preferences wizard
**I want to** move through all 6 steps (Accommodation, Travel Pace, Dining, Activities, Travel Party, Budget)
**So that** I can set all my preferences

**Acceptance criteria:**

- Next button advances to the next step
- Back button goes to previous step
- Skip button marks the step as visited without selecting
- Progress bar shows completed steps
- Each step saves immediately via API

---

### US-31: Edit preferences from account page

**As a** user
**I want to** edit my travel preferences at any time
**So that** my preferences stay up to date

**Acceptance criteria:**

- "Edit Preferences" button on account page
- Clicking it opens the wizard modal
- Wizard shows only unanswered steps (completed steps have checkmarks)

---

### US-32: Incomplete preferences badge

**As a** user with incomplete preferences
**I want to** see a subtle badge on the Account nav link
**So that** I'm reminded to complete my profile

**Acceptance criteria:**

- Small coral dot visible next to "Account" in the header
- Badge disappears when all 6 steps are completed

---

### US-33: View preferences on account page

**As a** user
**I want to** see my current preference selections on the account page
**So that** I can review what I've set

**Acceptance criteria:**

- All 7 preference categories displayed
- Each shows the current value or "Not set"
- Completion count shown (e.g., "4 of 6 categories completed")

---

## Account

### US-34: View account details

**As a** user
**I want to** see my account information (name, email)
**So that** I can verify my profile

**Acceptance criteria:**

- Account page shows user's name and email
- Account heading visible

---

### US-35: View preference completion status

**As a** user
**I want to** see how many preference categories I've completed
**So that** I know if my profile is complete

**Acceptance criteria:**

- Completion count displayed (e.g., "4 of 6 categories completed")
- Individual category values shown

---

## Summary

| Domain          | Stories             | Test File                           |
| --------------- | ------------------- | ----------------------------------- |
| Public Pages    | US-1 through US-7   | `public.spec.ts`, `explore.spec.ts` |
| Authentication  | US-8 through US-12  | `auth.spec.ts`                      |
| Trip Management | US-13 through US-17 | `trips.spec.ts`                     |
| Chat & Booking  | US-18 through US-24 | `chat.spec.ts`                      |
| Checkout        | US-25 through US-28 | `checkout.spec.ts`                  |
| Preferences     | US-29 through US-33 | `preferences.spec.ts`               |
| Account         | US-34, US-35        | `account.spec.ts`                   |
| **Total**       | **35 stories**      | **8 test files**                    |
