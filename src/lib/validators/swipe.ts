import { z } from "zod";
export const swipeSchema=z.object({target_id:z.uuid(),decision:z.enum(["like","pass"])}).strict();
