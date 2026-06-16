/**
 * Zod schema for the plan confirmation payload persisted to the booking_state
 * JSONB column. Exists to bound every nested collection and string from
 * untrusted client input so a malicious payload cannot inflate the row.
 */
import { z } from 'zod';

// SEC-04: planConfirmation arrives from the client and is persisted to
// the booking_state JSONB column. Bound every nested collection so a
// malicious payload cannot inflate the row, and cap per-value strings
// so an attacker cannot smuggle large prompt-injection blobs through.
const MAX_CATEGORIES = 10;
const MAX_SUB_OPTIONS = 3;
const MAX_VALUES = 20;
const MAX_VALUE_LEN = 100;
const MAX_LABEL_LEN = 200;

const optionSchema = z.object({
  id: z.string().min(1).max(MAX_VALUE_LEN),
  label: z.string().min(1).max(MAX_LABEL_LEN),
});

const radioSubOptionSchema = z.object({
  type: z.literal('radio'),
  id: z.string().min(1).max(MAX_VALUE_LEN),
  label: z.string().min(1).max(MAX_LABEL_LEN),
  options: z.array(optionSchema).max(MAX_VALUES),
  value: z.string().max(MAX_VALUE_LEN),
});

const multiSubOptionSchema = z.object({
  type: z.literal('multi'),
  id: z.string().min(1).max(MAX_VALUE_LEN),
  label: z.string().min(1).max(MAX_LABEL_LEN),
  options: z.array(optionSchema).max(MAX_VALUES),
  values: z.array(z.string().max(MAX_VALUE_LEN)).max(MAX_VALUES),
});

const subOptionSchema = z.discriminatedUnion('type', [
  radioSubOptionSchema,
  multiSubOptionSchema,
]);

const categoryIdSchema = z.enum([
  'flights',
  'hotels',
  'car_rental',
  'experiences',
]);

const categorySchema = z.object({
  id: categoryIdSchema,
  label: z.string().min(1).max(MAX_LABEL_LEN),
  enabled: z.boolean(),
  not_applicable: z.boolean(),
  not_applicable_reason: z.string().max(MAX_LABEL_LEN).optional(),
  sub_options: z.array(subOptionSchema).max(MAX_SUB_OPTIONS).optional(),
});

export const planCardSchema = z.object({
  categories: z.array(categorySchema).min(1).max(MAX_CATEGORIES),
});

export type ParsedPlanCard = z.infer<typeof planCardSchema>;
