import type { Profile } from '@/generated/prisma'
import type { LLMProvider } from '@/llm/types'
import { runValidated } from '@/llm/run'
import { EvaluationSchema, type EvaluationOut } from '@/llm/schemas'
import { buildEvaluationPrompt } from '@/llm/prompts/evaluation'

export async function evaluateJob(args: {
  profile: Profile
  cvSummary: string
  jobJD: string
  provider: LLMProvider
}): Promise<EvaluationOut> {
  const { system, prompt } = buildEvaluationPrompt({
    profile: args.profile,
    cvSummary: args.cvSummary,
    jobJD: args.jobJD,
  })
  return runValidated(args.provider, EvaluationSchema, { system, prompt })
}
