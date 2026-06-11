/**
 * HTTP client for the Voyager API. Handles auth (register/login with sid cookie),
 * trip CRUD, and SSE-reading chat. Designed for the eval seeder: no browser,
 * no Playwright required.
 */

export interface Trip {
  id: string;
  destination: string;
  transport_mode?: string;
  [key: string]: unknown;
}

export interface ChatDoneEvent {
  type: 'done';
  message: {
    id: string;
    role: 'assistant';
    nodes: unknown[];
    sequence: number;
    created_at: string;
  };
}

export interface CreateTripParams {
  destination: string;
  origin?: string;
  departure_date?: string;
  return_date?: string;
  budget_total?: number;
  budget_currency?: string;
  travelers?: number;
  preferences?: string;
}

export interface UpdateTripParams {
  transport_mode?: 'flying' | 'driving';
  trip_type?: string;
  flexible_dates?: boolean;
  status?: string;
}

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
};

export class VoyagerApiClient {
  private readonly baseUrl: string;
  private cookie: string = '';

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private extractSidCookie(setCookieHeader: string | null): string {
    if (!setCookieHeader) return '';
    const match = setCookieHeader.match(/sid=([^;]+)/);
    return match ? `sid=${match[1]}` : '';
  }

  private requestHeaders(
    extra?: Record<string, string>,
  ): Record<string, string> {
    return {
      ...DEFAULT_HEADERS,
      ...(this.cookie ? { Cookie: this.cookie } : {}),
      ...extra,
    };
  }

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      }),
    });
    if (res.status === 409) {
      // Already registered -- fall through to login
      return;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`register failed ${res.status}: ${body}`);
    }
    this.cookie = this.extractSidCookie(res.headers.get('set-cookie'));
  }

  async login(email: string, password: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`login failed ${res.status}: ${body}`);
    }
    this.cookie = this.extractSidCookie(res.headers.get('set-cookie'));
  }

  /** Register if not yet registered, then login to ensure a valid session. */
  async ensureSession(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<void> {
    await this.register(email, password, firstName, lastName);
    if (!this.cookie) {
      await this.login(email, password);
    }
  }

  async createTrip(params: CreateTripParams): Promise<Trip> {
    const res = await fetch(`${this.baseUrl}/trips`, {
      method: 'POST',
      headers: this.requestHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`createTrip failed ${res.status}: ${body}`);
    }
    const data = (await res.json()) as { trip: Trip };
    return data.trip;
  }

  async updateTrip(tripId: string, params: UpdateTripParams): Promise<Trip> {
    const res = await fetch(`${this.baseUrl}/trips/${tripId}`, {
      method: 'PUT',
      headers: this.requestHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`updateTrip failed ${res.status}: ${body}`);
    }
    const data = (await res.json()) as { trip: Trip };
    return data.trip;
  }

  /**
   * POST a chat message and read the SSE stream to completion.
   * Returns the parsed done-event payload, or null on agent error.
   */
  async sendChatMessage(
    tripId: string,
    message: string,
  ): Promise<ChatDoneEvent | null> {
    const res = await fetch(`${this.baseUrl}/trips/${tripId}/chat`, {
      method: 'POST',
      headers: this.requestHeaders({ Accept: 'text/event-stream' }),
      body: JSON.stringify({ message }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`chat failed ${res.status}: ${body}`);
    }

    if (!res.body) {
      throw new Error('chat response has no body');
    }

    return readSseStream(res.body);
  }
}

interface SseBlock {
  event: string;
  payload: { type: string };
}

interface BufferDrainResult {
  remaining: string;
  terminal?: ChatDoneEvent | null;
  lastEvent?: string;
}

function parseSseBlock(block: string): SseBlock | null {
  const eventMatch = block.match(/^event: (\w+)/m);
  const dataMatch = block.match(/^data: (.+)/m);
  if (!eventMatch || !dataMatch) return null;
  return {
    event: eventMatch[1],
    payload: JSON.parse(dataMatch[1]) as { type: string },
  };
}

function drainSseBuffer(buffer: string): BufferDrainResult {
  const blocks = buffer.split('\n\n');
  const remaining = blocks.pop() ?? '';
  let lastEvent: string | undefined;

  for (const raw of blocks) {
    const parsed = parseSseBlock(raw);
    if (!parsed) continue;
    lastEvent = parsed.event;
    if (parsed.payload.type === 'done')
      return {
        remaining,
        terminal: parsed.payload as ChatDoneEvent,
        lastEvent,
      };
    if (parsed.payload.type === 'error') {
      console.error('  agent error event:', JSON.stringify(parsed.payload));
      return { remaining, terminal: null, lastEvent };
    }
  }
  return { remaining, lastEvent };
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
): Promise<ChatDoneEvent | null> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastEvent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const drain = drainSseBuffer(buffer);
      buffer = drain.remaining;
      if (drain.lastEvent) lastEvent = drain.lastEvent;
      if ('terminal' in drain) return drain.terminal ?? null;
    }
  } finally {
    reader.releaseLock();
  }

  if (lastEvent !== 'done')
    console.warn(`  SSE stream ended without done event (last: ${lastEvent})`);
  return null;
}
