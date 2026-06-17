export interface LLMProvider {
  /** Returns raw text completion for a single user prompt + system prompt. */
  complete(args: { system: string; prompt: string; maxTokens?: number }): Promise<string>
}
