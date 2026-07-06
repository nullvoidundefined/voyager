import Anthropic from '@anthropic-ai/sdk';

import type { Persona, TranscriptEntry } from '../types.js';

// Lazy-init to ensure ANTHROPIC_API_KEY is loaded from dotenv before construction
let anthropic: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

function buildCustomerPrompt(persona: Persona): string {
  const budgetStr = persona.budget
    ? `$${persona.budget}`
    : 'no specific budget';
  const styleGuide: Record<string, string> = {
    conversational:
      'You chat naturally, share some details, ask questions back. Normal human conversation.',
    detailed:
      'You provide all information upfront in complete sentences. You are cooperative and thorough.',
    impatient:
      'You want things done fast. Skip categories you don\'t care about. Say "just skip that" for things you don\'t need.',
    terse:
      'You give short, minimal answers. One word or one sentence max. Make the agent work for information.',
  };

  return `You are a customer planning a trip. Stay in character throughout.

## Your Profile
- Destination: ${persona.destination}
- Origin: ${persona.origin}
- Dates: ${persona.departure_date}${persona.return_date ? ` to ${persona.return_date}` : ' (one-way)'}
- Budget: ${budgetStr}
- Travelers: ${persona.travelers}
- Travel party: ${persona.travel_party}

## Your Goals
${persona.goals.map((g) => `- ${g}`).join('\n')}

## Communication Style
${styleGuide[persona.communication_style] ?? styleGuide.conversational}

## Rules
- Never mention that you are an AI or a test persona.
- Respond naturally as a real customer would.
- If the agent asks a question you have the answer to, provide it in your style.
- If the agent shows you options (flights, hotels, etc.), pick one that matches your goals or ask for different options.
- When you feel the conversation has accomplished your goals (or you've given up), respond with exactly: DONE
- Do not say DONE until at least 2 categories have been addressed (selected or skipped).`;
}

export async function getCustomerResponse(
  persona: Persona,
  transcript: TranscriptEntry[],
): Promise<string> {
  // Swap roles: from the customer's perspective, the travel agent's messages
  // are "user" (incoming) and the customer's own messages are "assistant" (outgoing)
  const messages = transcript.map((t) => ({
    content: t.content,
    role: (t.role === 'user' ? 'assistant' : 'user') as 'user' | 'assistant',
  }));

  // The inverted history starts with the customer's own opener (assistant),
  // which the API rejects as the first message. Seed a user turn so every
  // request is valid; without this, every customer reply silently fell back
  // to canned strings.
  if (messages[0]?.role === 'assistant') {
    messages.unshift({
      content:
        '[You reached the Voyager travel agent. Start or continue the conversation.]',
      role: 'user',
    });
  }

  const response = await getClient().messages.create({
    max_tokens: 300,
    messages,
    model: 'claude-sonnet-4-6',
    system: buildCustomerPrompt(persona),
  });

  const text =
    response.content[0]?.type === 'text' ? response.content[0].text : '';
  return text.trim();
}
