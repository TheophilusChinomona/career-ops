import OpenAI from 'openai'
import type { LLMProvider } from '../types'
export function openaiProvider(apiKey: string, model = 'gpt-4o'): LLMProvider {
  const client = new OpenAI({ apiKey })
  return {
    async complete({ system, prompt, maxTokens = 4096 }) {
      const res = await client.chat.completions.create({
        model, max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      })
      return res.choices[0]?.message?.content ?? ''
    },
  }
}
