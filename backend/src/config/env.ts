import { z } from 'zod'

import {
  BACKGROUND_REMOVAL_PROVIDERS,
  DEFAULT_BACKGROUND_REMOVAL_PROVIDER,
} from '../lib/background-removal'
import { DEFAULT_REMBG_MODEL, REMBG_MODELS } from '../lib/rembg'
import { getRuntimeEnv } from './runtime-env'

const DEFAULT_REMBG_MAX_UPLOAD_BYTES = 1_572_864

const optionalNonEmptyString = z.preprocess(
  value => (typeof value === 'string' && !value.trim() ? undefined : value),
  z.string().min(1).optional(),
)

const optionalUrl = z.preprocess(
  value => (typeof value === 'string' && !value.trim() ? undefined : value),
  z.string().url().optional(),
)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET is required'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3001'),
  CORS_ORIGIN: z.string().default('http://localhost:3300'),
  UNSPLASH_ACCESS_KEY: optionalNonEmptyString,
  PAYSTACK_SECRET_KEY: optionalNonEmptyString,
  PAYSTACK_CURRENCY: z
    .string()
    .trim()
    .length(3, 'PAYSTACK_CURRENCY must be a 3-letter code')
    .transform(value => value.toUpperCase())
    .default('NGN'),
  PAYSTACK_ALLOWED_CURRENCIES: z
    .string()
    .trim()
    .default('')
    .transform(value =>
      Array.from(
        new Set(
          value
            .split(',')
            .map(currency => currency.trim().toUpperCase())
            .filter(currency => /^[A-Z]{3}$/.test(currency)),
        ),
      ),
    )
    .transform(currencies => (currencies.length > 0 ? currencies : ['NGN'])),
  BACKGROUND_REMOVAL_PROVIDER: z
    .enum(BACKGROUND_REMOVAL_PROVIDERS)
    .default(DEFAULT_BACKGROUND_REMOVAL_PROVIDER),
  BRIA_RMBG_URL: optionalUrl,
  REMBG_URL: optionalUrl,
  REMBG_DEFAULT_MODEL: z.enum(REMBG_MODELS).default(DEFAULT_REMBG_MODEL),
  REMBG_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  REMBG_MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_REMBG_MAX_UPLOAD_BYTES),
})

export const env = envSchema.parse(getRuntimeEnv())

export type Env = typeof env
