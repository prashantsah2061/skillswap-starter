import { z } from "zod";
import { discoveryUuid } from "./discovery";

const futureDate = z.string().datetime({ offset: true });
export const sessionActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("propose"), match_id: discoveryUuid, scheduled_at: futureDate,
    duration_minutes: z.number().int().min(15).max(240), notes: z.string().trim().max(1000),
  }).strict(),
  z.object({ action: z.literal("accept"), session_id: discoveryUuid }).strict(),
  z.object({ action: z.literal("reschedule"), session_id: discoveryUuid, scheduled_at: futureDate }).strict(),
  z.object({ action: z.literal("cancel"), session_id: discoveryUuid }).strict(),
  z.object({ action: z.literal("complete"), session_id: discoveryUuid }).strict(),
]);
export type SessionAction = z.infer<typeof sessionActionSchema>;
