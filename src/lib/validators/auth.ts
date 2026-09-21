import { z } from "zod";
export const signupSchema=z.object({email:z.email(),password:z.string().min(12).max(128)}).strict();
export const loginSchema=z.object({email:z.email(),password:z.string().min(1).max(128)}).strict();
