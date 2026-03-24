import { z } from "zod";

export const DIETARY_OPTIONS = [
  "vegetarian",
  "vegan",
  "halal",
  "kosher",
  "gluten-free",
  "dairy-free",
  "nut-free",
  "none",
] as const;

export const INTENSITY_OPTIONS = ["relaxed", "moderate", "active"] as const;
export const SOCIAL_OPTIONS = ["solo", "couple", "group", "family"] as const;

export const userPreferencesSchema = z.object({
  dietary: z.array(z.enum(DIETARY_OPTIONS)).default([]),
  intensity: z.enum(INTENSITY_OPTIONS).default("moderate"),
  social: z.enum(SOCIAL_OPTIONS).default("couple"),
});

export type UserPreferencesInput = z.infer<typeof userPreferencesSchema>;

export interface UserPreferences {
  id: string;
  user_id: string;
  dietary: string[];
  intensity: string;
  social: string;
  created_at: Date;
  updated_at: Date;
}
