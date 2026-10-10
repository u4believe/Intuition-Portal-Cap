/**
 * Which model backend the AI Analyst uses.
 *   AI_PROVIDER=openai     (default) any OpenAI-compatible Chat Completions API —
 *                          OpenRouter, Groq, Together, DeepInfra, a self-hosted
 *                          Ollama/vLLM… configured with AI_BASE_URL, AI_API_KEY, AI_MODEL.
 *   AI_PROVIDER=anthropic  Claude via ANTHROPIC_API_KEY.
 * Conversations remember the provider they were started with, because each
 * stores its history in that provider's message format.
 */
export type AiProvider = 'openai' | 'anthropic'

export function currentProvider(): AiProvider {
  return process.env.AI_PROVIDER === 'anthropic' ? 'anthropic' : 'openai'
}
