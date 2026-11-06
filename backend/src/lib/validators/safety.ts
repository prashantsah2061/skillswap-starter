import { z } from "zod";
import { discoveryUuid } from "./discovery";

export const blockSchema = z.object({ target_id: discoveryUuid, action: z.enum(["block", "unblock"]) }).strict();
export const reportSchema = z.object({
  reported_id: discoveryUuid,
  match_id: discoveryUuid.nullable().optional(),
  reason: z.enum(["spam", "harassment", "unsafe", "impersonation", "other"]),
  details: z.string().trim().max(2000).default(""),
}).strict();
