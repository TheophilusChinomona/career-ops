import Anthropic from '@anthropic-ai/sdk'
import type { LLMProvider } from '../types'
export function claudeProvider(apiKey: string, model = 'claude-sonnet-4-6'): LLMProvider {
  const client = new Anthropic({ apiKey })
  return {
    async complete({ system, prompt, maxTokens = 4096 }) {
      const res = await client.messages.create({
        model, max_tokens: maxTokens, system,
        messages: [{ role: 'user', content: prompt }],
      })
      return res.content.filter(c => c.type === 'text').map(c => (c as any).text).join('')
    },
  }
}
