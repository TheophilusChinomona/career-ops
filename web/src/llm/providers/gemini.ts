import { GoogleGenerativeAI } from '@google/generative-ai'
import type { LLMProvider } from '../types'
export function geminiProvider(apiKey: string, model = 'gemini-2.5-flash'): LLMProvider {
  const genAI = new GoogleGenerativeAI(apiKey)
  return {
    async complete({ system, prompt }) {
      const m = genAI.getGenerativeModel({ model, systemInstruction: system })
      const res = await m.generateContent(prompt)
      return res.response.text()
    },
  }
}
