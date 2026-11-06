import { z } from "zod";
import { discoveryUuid } from "./discovery";
export const swipeSchema = z.object({ target_id: discoveryUuid, decision: z.enum(["like", "pass"]) }).strict();
