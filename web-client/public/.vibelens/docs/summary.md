<!-- vibelens format:1 -->

# Voyager -- AI Travel Concierge

## What It Does

Voyager is an AI-powered travel planning application. Users describe a trip -- destination, dates, budget, and preferences -- and an AI agent powered by Anthropic Claude searches real travel APIs to assemble a complete, budget-aware itinerary. The agent calls 3-8 tools per conversational turn, reasoning about results between each call, and users refine the plan through natural conversation.

## The Problem It Solves

Planning a trip involves juggling multiple booking sites, mentally tracking budgets across flights, hotels, activities, and car rentals, and making trade-offs without clear cost visibility. Voyager consolidates this into a single conversational interface where an AI agent handles the search, comparison, and budget math -- presenting options as interactive cards that users can select with a click.

## How It Works (User Perspective)

1. **Create a trip** -- Click "New Trip" and the app creates a blank trip record and drops you into a chat with the Voyager AI concierge.
2. **Describe your trip** -- Tell the agent where you want to go, your dates, and your budget. The agent renders an inline form to collect structured details (origin, dates, budget, travelers).
3. **Agent searches** -- The agent calls `get_destination_info` to resolve IATA codes, then `search_flights` (SerpApi Google Flights), `search_hotels` (SerpApi Google Hotels), `search_car_rentals` (SerpApi Google Car Rentals), and `search_experiences` (Google Places). Results appear as interactive cards.
4. **Auto-enrichment** -- When a destination is recognized, the app automatically fetches travel advisories (US State Dept + UK FCDO), a 7-day weather forecast (Open-Meteo), visa requirements, and local driving rules -- displayed as advisory and weather cards alongside the search results.
5. **Select and confirm** -- Click a card to select it, then "Confirm Selection." The agent acknowledges, calls `calculate_remaining_budget`, and moves to the next category.
6. **Review and book** -- After all categories are filled, the agent presents the full itinerary. Click "Book This Trip" to open the BookingConfirmation modal, which shows a cost breakdown and transitions through review, booking, and confirmed states.
7. **Iterate** -- At any point, send another message to adjust the plan. Quick reply chips appear for common follow-up actions. The agent respects user preferences (dietary restrictions, travel intensity, social style) loaded from the account settings.

## Key Features

- **Agentic tool-use loop**: Claude calls tools iteratively (up to 15 per turn), reasoning between each call. This is not single-pass -- the agent plans its tool calls based on prior results.
- **Real API data**: Flights from Google Flights via SerpApi, hotels from Google Hotels via SerpApi, car rentals from Google Car Rentals via SerpApi, experiences from Google Places API. No hallucinated prices.
- **Car rental search**: The `search_car_rentals` tool finds available vehicles with pricing, car type, features, and pickup/dropoff details -- fully integrated into the budget tracking flow.
- **Auto-enrichment**: When a trip destination is set, the server automatically fetches travel advisories (US State Dept + UK FCDO), a 7-day weather forecast (Open-Meteo), visa requirements (matrix lookup by origin/destination country), and driving requirements -- no extra tool calls needed from the agent.
- **Typed chat protocol**: Every message is stored and streamed as an ordered array of typed `ChatNode` objects (text, flight_tiles, hotel_tiles, car_rental_tiles, experience_tiles, advisory, weather_forecast, budget_bar, quick_replies, tool_progress, itinerary, travel_plan_form). The server controls what the UI renders; adding new node types requires no protocol changes.
- **Budget tracking**: The `calculate_remaining_budget` tool computes exact spend breakdowns. The frontend shows a `BudgetBar` node and a cost breakdown card on the trip detail page.
- **Interactive result cards**: `FlightTiles`, `HotelTiles`, `CarRentalTiles`, and `ExperienceTiles` render search results visually. Selection and confirmation are handled per tile group.
- **SSE streaming**: The chat endpoint (`POST /trips/:id/chat`) streams typed node events and the final response via Server-Sent Events. The frontend reads the stream with the `useSSEChat` hook and updates UI in real time.
- **User preferences**: Dietary restrictions, travel intensity (relaxed/moderate/active), and social style (solo/couple/group/family) are stored per user and injected into the system prompt.
- **Conversation persistence**: All messages are stored in PostgreSQL as `ChatNode[]` arrays. Returning to a trip restores the full visual conversation history -- including cards, advisories, and weather forecasts -- exactly as they were rendered.
- **Redis caching**: SerpApi and Google Places responses are cached for 1 hour to conserve the 250 searches/month SerpApi free tier.
- **Topic guardrail**: The system prompt restricts the agent to travel-related topics only.

## Target Users

Travelers who want a fast, conversational way to plan a complete trip with real pricing data, travel advisories, and budget constraints, without switching between multiple booking sites.
