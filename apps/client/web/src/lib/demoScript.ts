/**
 * Drives the scripted demo conversation on the landing page, emitting canned
 * user messages on a timer so visitors see the chat flow without an account.
 * Returns a cancel function so the caller can stop playback on unmount.
 */

const SCRIPT = [
  'I want to plan a 7-day trip to Barcelona for 2 people in August with a $5,000 budget.',
  'We prefer boutique hotels near the Gothic Quarter.',
  'We love architecture, food markets, and day trips to nearby towns.',
  'Can you build us a day-by-day itinerary?',
];

interface DemoOptions {
  intervalMs?: number;
}

export function runDemoScript(
  onMessage: (message: string) => void,
  options: DemoOptions = {},
): () => void {
  const { intervalMs = 3500 } = options;
  let index = 0;
  let stopped = false;

  function next() {
    if (stopped || index >= SCRIPT.length) return;
    onMessage(SCRIPT[index]!);
    index += 1;
    if (index < SCRIPT.length) {
      setTimeout(next, intervalMs);
    }
  }

  setTimeout(next, intervalMs);

  return () => {
    stopped = true;
  };
}
