import { z } from 'zod'

const Schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().default('http://localhost:3000'),
  APP_ENCRYPTION_KEY: z.string().length(32, 'APP_ENCRYPTION_KEY must be 32 chars'),
  LLM_PROVIDER: z.enum(['claude', 'openai', 'gemini']).default('claude'),
  LLM_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
})
export type Env = z.infer<typeof Schema>
export function parseEnv(src: NodeJS.ProcessEnv | Record<string, string | undefined>): Env {
  return Schema.parse(src)
}

// Lazy singleton: evaluated on first access so unit tests that import only
// `parseEnv` do not trigger eager validation against the test process.env.
let _env: Env | undefined
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    if (!_env) _env = parseEnv(process.env)
    return (_env as Record<string | symbol, unknown>)[prop]
  },
})
