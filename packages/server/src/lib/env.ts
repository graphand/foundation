import { z } from "zod";

// Define schema for environment variables
const envSchema = z.object({
  APP_NAME: z.string().min(1),
  WILDCARD_DOMAIN: z.string().optional(),
  DEFAULT_ENV: z.string().min(1).default("main"),
  // MongoDB connection
  DATABASE_MONGO_URI: z.string().min(1),
  DATABASE_MONGO_USERNAME: z.string().optional(),
  DATABASE_MONGO_PASSWORD: z.string().optional(),
});

export const env = envSchema.parse(process.env);
