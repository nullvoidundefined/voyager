/** format_response tool: the required final tool call carrying the turn's reply. */
import type { ToolModule } from 'app/tools/registry/toolModule.js';
import { z } from 'zod';

const citationSchema = z.object({
  id: z.string(),
  label: z.string(),
  url: z.string().optional(),
  // Enum (not a free string) so the validator enforces the same closed set the
  // model is shown; previously the model saw the enum but Zod accepted any
  // string, letting unlisted source types through unvalidated.
  source_type: z
    .enum(['travel_advisory', 'visa_info', 'weather', 'vaccination', 'general'])
    .optional(),
});

const advisorySchema = z
  .object({
    severity: z.enum(['info', 'warning', 'critical']),
    title: z.string(),
    body: z.string(),
  })
  .describe(
    'Escalated travel advisory when you detect contextual risk factors (e.g. families traveling to high-risk areas, health concerns). Only use when auto-enrichment baseline is insufficient.',
  );

export const formatResponseSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe('Your markdown-formatted response text to the user.'),
  citations: z
    .array(citationSchema)
    .optional()
    .describe(
      'References backing claims in your text. Each citation needs an id (e.g. "1"), label (display text), and either a url (external link) or source_type.',
    ),
  quick_replies: z
    .array(z.string())
    .optional()
    .describe(
      'Suggested next actions for the user (2-4 short options). Only include when there are clear next steps. Do NOT suggest specific origin cities (e.g. "From New York", "From Los Angeles"); the user enters their own origin. Do NOT suggest flexible date options; the TripDetailsForm has a dedicated flexible dates toggle.',
    ),
  advisory: advisorySchema.optional(),
  skip_category: z
    .enum(['flights', 'hotels', 'car_rental', 'experiences'])
    .optional()
    .describe(
      'Set to the category name when the user declines it (e.g., "car_rental" when the user says "No, I don\'t need a car"). The system will mark this category as skipped.',
    ),
  // looseObject (not z.unknown) so the derived JSON Schema keeps type:'object';
  // the card is always an object, validated leniently to allow evolving fields.
  plan_card: z
    .looseObject({})
    .optional()
    .describe(
      'Trip plan card to present to the user. Emit ONLY during the PLAN_TRIP phase. Contains category toggles and sub-options the user can adjust before confirming.',
    ),
});

export const formatResponseTool: ToolModule = {
  description:
    'REQUIRED: Call this as your LAST tool call every turn. Provides your text response, citations, suggested quick replies, and optional advisory escalation. Do NOT write text outside of this tool. All your text goes in the text field.',
  name: 'format_response',
  schema: formatResponseSchema,
};
