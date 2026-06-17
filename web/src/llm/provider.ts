import type { LLMProvider } from './types'
import { claudeProvider } from './providers/claude'
import { openaiProvider } from './providers/openai'
import { geminiProvider } from './providers/gemini'

type Keys = { ANTHROPIC_API_KEY?: string; OPENAI_API_KEY?: string; GEMINI_API_KEY?: string }
export function getProvider(name: 'claude' | 'openai' | 'gemini', keys: Keys, model?: string): LLMProvider {
  if (name === 'claude') {
    if (!keys.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing')
    return claudeProvider(keys.ANTHROPIC_API_KEY, model)
  }
  if (name === 'openai') {
    if (!keys.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY missing')
    return openaiProvider(keys.OPENAI_API_KEY, model)
  }
  if (!keys.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing')
  return geminiProvider(keys.GEMINI_API_KEY, model)
}
