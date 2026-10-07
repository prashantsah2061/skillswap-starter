import { z } from "zod";
export const messageSchema=z.object({body:z.string().trim().min(1).max(2000)}).strict();
