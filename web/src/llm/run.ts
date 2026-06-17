import type { z } from 'zod'
import type { LLMProvider } from './types'

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.indexOf('{'); const end = body.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON object found')
  return JSON.parse(body.slice(start, end + 1))
}

export async function runValidated<T>(
  provider: LLMProvider, schema: z.ZodType<T>,
  args: { system: string; prompt: string; maxTokens?: number },
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await provider.complete(args)
    try { return schema.parse(extractJson(raw)) }
    catch (e) { lastErr = e; args = { ...args, prompt: args.prompt + '\n\nReturn ONLY valid JSON matching the schema.' } }
  }
  throw new Error(`LLM output failed validation after retry: ${String(lastErr)}`)
}
