'use client';

/**
 * Dispatches a single chat node to its matching presentational component. Exists
 * to keep the node-type-to-widget mapping in one switch so the transcript
 * renderer stays agnostic of the growing set of node variants.
 */
import type { ChatNode, OfferKind, TripPlanCard } from '@repo/types';

import { TripDetailsForm } from './TripDetailsForm';
import { AdvisoryCard } from './nodes/AdvisoryCard';
import { BookingPrompt } from './nodes/BookingPrompt';
import { BudgetBar } from './nodes/BudgetBar';
import { MarkdownText } from './nodes/MarkdownText';
import { OfferTiles } from './nodes/OfferTiles';
import { WeatherForecast } from './nodes/WeatherForecast';
import { ItineraryTimeline } from './widgets/ItineraryTimeline';
import { QuickReplyChips } from './widgets/QuickReplyChips';
import { TripPlanWidget } from './widgets/TripPlanWidget';

export interface NodeRendererCallbacks {
  onConfirmOffer?: (
    kind: OfferKind,
    label: string,
    data: Record<string, unknown>,
  ) => void;
  /** Dead plumbing carried over from the legacy confirmed*Id props: no
   *  producer exists today (P3 todo: wire or delete). */
  confirmedOfferIds?: Partial<Record<OfferKind, string | null>>;
  onConfirmPlan?: (confirmedCard: TripPlanCard, summaryMessage: string) => void;
  onQuickReply?: (text: string) => void;
  onBookNow?: () => void;
  onFormSubmit?: (
    structuredData: Record<string, string>,
    displayMessage: string,
  ) => void;
  onFormValuesChange?: (values: Record<string, string>) => void;
  initialValues?: Record<string, string>;
  disabled?: boolean;
}

interface NodeRendererProps {
  node: ChatNode;
  callbacks?: NodeRendererCallbacks;
}

export function NodeRenderer({ callbacks = {}, node }: NodeRendererProps) {
  const cb: NodeRendererCallbacks = callbacks;

  switch (node.type) {
    case 'text':
      return <MarkdownText node={node} />;

    case 'offer_tiles':
      return (
        <OfferTiles
          node={node}
          onConfirm={(label, data) =>
            cb.onConfirmOffer?.(node.offer_kind, label, data)
          }
          disabled={cb.disabled}
          confirmedId={cb.confirmedOfferIds?.[node.offer_kind]}
        />
      );

    case 'itinerary': {
      // Adapt types DayPlan (field: day) to ItineraryTimeline (field: dayNumber)
      const adaptedDays = node.days.map((d) => ({
        dayNumber: d.day,
        items: d.items,
        title: d.title,
      }));
      return <ItineraryTimeline days={adaptedDays} />;
    }

    case 'advisory':
      return <AdvisoryCard node={node} />;

    case 'weather_forecast':
      return <WeatherForecast node={node} />;

    case 'budget_bar':
      return <BudgetBar node={node} />;

    case 'quick_replies':
      return (
        <QuickReplyChips
          chips={node.options}
          onSelect={cb.onQuickReply ?? (() => {})}
          disabled={cb.disabled}
        />
      );

    case 'tool_progress':
      // Rendered as part of a consolidated ChatProgressBar by VirtualizedChat.
      // Returning null here prevents per-node chip rendering. See invariant 6.
      return null;

    case 'travel_plan_form': {
      // Map FormField to TripField for the TripDetailsForm component
      const tripFields = node.fields.map((f) => ({
        label: f.label,
        type: f.name as
          | 'destination'
          | 'origin'
          | 'departure_date'
          | 'return_date'
          | 'budget'
          | 'travelers'
          | 'trip_type'
          | 'flexible_dates',
      }));
      return (
        <TripDetailsForm
          fields={tripFields}
          onSubmit={cb.onFormSubmit ?? (() => {})}
          onValuesChange={cb.onFormValuesChange}
          initialValues={cb.initialValues}
          disabled={cb.disabled}
        />
      );
    }

    case 'booking_prompt':
      return (
        <BookingPrompt
          experiencesEmpty={node.experiences_empty}
          carRentalsEmpty={node.car_rentals_empty}
          onBookNow={cb.onBookNow ?? (() => {})}
          onQuickReply={cb.onQuickReply ?? (() => {})}
        />
      );

    case 'plan_card':
      return (
        <TripPlanWidget
          planCard={node.plan_card}
          onConfirm={cb.onConfirmPlan ?? (() => {})}
          disabled={cb.disabled}
          confirmed={node.confirmed}
        />
      );

    default: {
      // Exhaustive check — TypeScript will error if a node type is unhandled
      const _exhaustive: never = node;
      void _exhaustive;
      return null;
    }
  }
}
