/**
 * FAQ page. Server-renders static answers to common product questions with SEO
 * metadata, giving prospective users a no-auth reference before they sign up.
 */
import type { Metadata } from 'next';
import Link from 'next/link';

import { DemoBanner } from '@/components/DemoBanner/DemoBanner';
import { APP_NAME } from '@/constants';

import styles from './faq.module.scss';

export const metadata: Metadata = {
  title: `FAQ — ${APP_NAME} | AI Trip Planner`,
  description: `Frequently asked questions about ${APP_NAME}, the AI-powered travel planning agent. Learn how it works, pricing, data sources, and more.`,
  openGraph: {
    title: `FAQ — ${APP_NAME} | AI Trip Planner`,
    description: `Learn how ${APP_NAME} uses AI to plan trips with real flight, hotel, and experience data — all within your budget.`,
    type: 'website',
  },
  alternates: {
    canonical: '/faq',
  },
};

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_SECTIONS: { heading: string; items: FaqItem[] }[] = [
  {
    heading: `How ${APP_NAME} Works`,
    items: [
      {
        question: `What is ${APP_NAME}?`,
        answer: `${APP_NAME} is an AI-powered travel planning agent. You describe your trip — destination, dates, budget, and preferences — and the agent searches real APIs for flights, hotels, and experiences to assemble a complete, budget-aware itinerary. You can then iterate conversationally to refine the plan.`,
      },
      {
        question: 'How does the AI agent work?',
        answer: `${APP_NAME} uses a multi-step tool-use loop powered by Claude. When you describe a trip, the agent reasons about your requirements and calls real APIs 3-8 times per turn — searching flights, comparing hotels, finding experiences, and tracking your budget between each step. Unlike simple chatbots, the agent makes decisions based on the results it gets back, just like a human travel advisor would.`,
      },
      {
        question: 'Where does the travel data come from?',
        answer:
          'Flight and hotel data comes from live Google Flights and Google Hotels results, fetched via SerpApi at the moment you search. Experience and restaurant recommendations come from the Google Places API. Every price you see is a real, searchable result, not a language-model guess.',
      },
      {
        question: 'How accurate are the prices?',
        answer: `Prices are pulled from live APIs at the time of your search and reflect real availability. However, travel prices change frequently — a price shown during planning may shift by the time you book. ${APP_NAME} is a planning tool, not a booking engine. We always recommend verifying the final price when you book through the airline or hotel directly.`,
      },
      {
        question: `Can I book flights and hotels through ${APP_NAME}?`,
        answer: `Not yet. ${APP_NAME} is currently a planning and itinerary tool. It helps you find the best options within your budget and organizes them into a day-by-day plan. Booking integration is on our roadmap.`,
      },
    ],
  },
  {
    heading: 'Pricing & Status',
    items: [
      {
        question: `Is ${APP_NAME} free to use?`,
        answer: `${APP_NAME} is a portfolio demo. It is free to use, there is no paid tier, and there is no intent to monetize it as a commercial product. Every API call the agent makes (Anthropic, SerpApi, Google Places) is paid for by the author as a technical demonstration.`,
      },
      {
        question: `How does ${APP_NAME} make money?`,
        answer: `${APP_NAME} does not make money. It is a technical demonstration of an agentic AI travel planning pattern, built as a portfolio piece. There is no business model, no subscription, no affiliate commission, and no advertising. The per-trip cost structure is analyzed honestly in the published Criticism audit.`,
      },
      {
        question: 'Will recommendations be biased toward partners?',
        answer: `No. ${APP_NAME} has no partnerships, no affiliate links, and no pay-for-placement deals. The agent optimizes purely for your stated preferences and budget. What you see is what the APIs return, filtered by your criteria.`,
      },
    ],
  },
  {
    heading: 'Privacy & Data',
    items: [
      {
        question: `What data does ${APP_NAME} store?`,
        answer:
          'We store your account information (email, name), your saved trips and itineraries, and conversation history so you can pick up where you left off. We cache API responses briefly to improve performance but do not store raw travel search data long-term.',
      },
      {
        question: 'Is my data shared with third parties?',
        answer:
          "Your data is never sold. We send search queries to SerpApi (which aggregates Google Flights and Google Hotels) and to the Google Places API to fulfill your requests. Those queries contain trip parameters (dates, destinations) but not your personal identity. Conversations are processed by Anthropic's Claude API under their data usage policies.",
      },
      {
        question: 'Can I delete my account and data?',
        answer:
          'Yes. To delete your account and associated data, email ian.greenough.developer@gmail.com. We will process your request within 30 days per GDPR requirements.',
      },
    ],
  },
  {
    heading: 'Technical Details',
    items: [
      {
        question: `What AI model powers ${APP_NAME}?`,
        answer: `${APP_NAME} is powered by Anthropic's Claude, using the tool-use API. The agent has access to structured tools for searching flights, hotels, experiences, calculating budgets, and looking up destination information. It decides which tools to call and in what order based on your request.`,
      },
      {
        question: 'What is the "tool-use loop"?',
        answer: `Traditional chatbots generate a single text response. ${APP_NAME} uses an agentic loop: the AI receives your message, decides to call a tool (like searching flights), reads the result, reasons about it, then decides the next action. This loop continues until the agent has enough information to present a complete plan. A single turn may involve 3-8 tool calls with reasoning between each one.`,
      },
      {
        question: 'Is there a limit on how many searches the agent can do?',
        answer:
          'The agent is limited to 15 tool calls per turn as a safety measure. In practice, most trip plans require 4-8 calls. If you need more detail, you can ask follow-up questions and the agent will make additional searches.',
      },
      {
        question: 'What happens if an API is down?',
        answer:
          "If a data source is temporarily unavailable, the agent will let you know which part of the search couldn't be completed and offer to try again. It won't fabricate data — if it can't reach the flight API, it will say so rather than making up prices.",
      },
    ],
  },
];

function generateFaqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_SECTIONS.flatMap((section) =>
      section.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    ),
  };
}

export default function FaqPage() {
  const jsonLd = generateFaqJsonLd();

  return (
    <>
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className={styles.page}>
        <DemoBanner />
        <header className={styles.hero}>
          <h1>Frequently Asked Questions</h1>
          <p>
            Everything you need to know about how {APP_NAME} plans your trips.
          </p>
        </header>

        {FAQ_SECTIONS.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h2>{section.heading}</h2>
            <div className={styles.items}>
              {section.items.map((item) => (
                <details key={item.question} className={styles.item}>
                  <summary className={styles.question}>{item.question}</summary>
                  <p className={styles.answer}>{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <div className={styles.cta}>
          <p>Ready to plan your next trip?</p>
          <Link href='/login' className={styles.ctaButton}>
            Get Started
          </Link>
        </div>
      </div>
    </>
  );
}
