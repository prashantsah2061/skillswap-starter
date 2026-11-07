import { z } from "zod";
import { discoveryUuid } from "./discovery";

// Match PostgreSQL char_length, including non-BMP Unicode characters.
const text = (min: number, max: number) => z.string().trim().refine((value) => {
  const size = Array.from(value).length;
  return size >= min && size <= max;
});
export const publicProfileSchema = z.object({ display_name: text(2, 80), bio: text(0, 500), meeting_preference: z.enum(["online", "in_person", "either"]).nullable() }).strict();
export const publicSkillSchema = z.object({
  skill_id: discoveryUuid, direction: z.enum(["teach", "learn"]),
  level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  goal_level: z.enum(["beginner", "intermediate", "advanced"]).nullable().default(null),
}).strict();
