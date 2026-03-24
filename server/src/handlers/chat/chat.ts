import type { Request, Response } from "express";

import type { TripContext } from "app/prompts/trip-context.js";
import {
  getMessagesByConversation,
  getOrCreateConversation,
  insertMessage,
} from "app/repositories/conversations/conversations.js";
import { getTripWithDetails } from "app/repositories/trips/trips.js";
import { runAgentLoop } from "app/services/agent.service.js";
import { logger } from "app/utils/logs/logger.js";

export async function chat(req: Request, res: Response) {
  const tripId = req.params.id;
  const userId = req.user!.id;
  const { message } = req.body;

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  // Load trip
  const trip = await getTripWithDetails(tripId, userId);
  if (!trip) {
    res.status(404).json({ error: "Trip not found" });
    return;
  }

  // Get or create conversation
  const conversation = await getOrCreateConversation(tripId);

  // Load conversation history
  const history = await getMessagesByConversation(conversation.id);

  // Build messages for Claude
  const claudeMessages = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content ?? "",
    }));

  // Add current message
  claudeMessages.push({ role: "user", content: message });

  // Build trip context for system prompt
  const tripContext: TripContext = {
    destination: trip.destination,
    origin: trip.origin ?? undefined,
    departure_date: trip.departure_date ?? undefined,
    return_date: trip.return_date ?? undefined,
    budget_total: trip.budget_total ?? undefined,
    budget_currency: trip.budget_currency ?? undefined,
    travelers: trip.travelers ?? undefined,
    selected_flights: trip.flights ?? [],
    selected_hotels: trip.hotels ?? [],
    selected_experiences: trip.experiences ?? [],
  };

  // Set up SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Persist user message
  await insertMessage({
    conversation_id: conversation.id,
    role: "user",
    content: message,
  });

  try {
    const result = await runAgentLoop(
      claudeMessages,
      tripContext,
      (event) => {
        const eventType = event.type;
        res.write(`event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`);
      },
      conversation.id,
    );

    // Persist assistant message
    await insertMessage({
      conversation_id: conversation.id,
      role: "assistant",
      content: result.response,
      tool_calls_json: result.tool_calls.length > 0 ? result.tool_calls : undefined,
      token_count: result.total_tokens.input + result.total_tokens.output,
    });

    // Send done event
    res.write(
      `event: done\ndata: ${JSON.stringify({ response: result.response, tool_calls: result.tool_calls })}\n\n`,
    );
  } catch (err) {
    logger.error({ err, tripId }, "Agent loop failed");
    res.write(`event: error\ndata: ${JSON.stringify({ error: "Agent encountered an error" })}\n\n`);
  }

  res.end();
}

export async function getMessages(req: Request, res: Response) {
  const tripId = req.params.id;
  const conversation = await getOrCreateConversation(tripId);
  const messages = await getMessagesByConversation(conversation.id);
  res.json({ messages });
}
