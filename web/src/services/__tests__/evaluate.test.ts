import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Profile } from '@/generated/prisma'
import type { LLMProvider } from '@/llm/types'
import type { EvaluationOut } from '@/llm/schemas'

// Mock runValidated before importing evaluateJob
vi.mock('@/llm/run', () => ({
  runValidated: vi.fn(),
}))

import { evaluateJob } from '../evaluate'
import { runValidated } from '@/llm/run'

const mockRunValidated = runValidated as ReturnType<typeof vi.fn>

const fakeProfile: Profile = {
  id: 'profile-1',
  userId: 'user-1',
  fullName: 'Tino Maramba',
  email: 'tino@example.com',
  phone: null,
  location: 'Remote',
  linkedin: null,
  targetRoles: ['Software Engineer', 'Full Stack Developer'],
  compTarget: '$120k',
  narrative: 'Experienced full-stack developer',
  llmProvider: null,
  model: null,
}

const fakeEvaluation: EvaluationOut = {
  score: 4.2,
  legitimacy: 'High Confidence',
  recommendApply: true,
  blocks: {
    A: 'Role summary block',
    B: 'Match block',
    C: 'Level block',
    D: 'Comp block',
    E: 'Customisation block',
    F: 'Interview block',
    G: 'Legitimacy block',
  },
  notes: 'Strong match overall',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('evaluateJob', () => {
  it('builds evaluation prompt from jobJD and calls runValidated, returning EvaluationOut', async () => {
    mockRunValidated.mockResolvedValue(fakeEvaluation)

    const provider: LLMProvider = { complete: vi.fn() }
    const jobJD = 'We are looking for a senior full-stack developer with React and Node.js experience.'
    const cvSummary = 'Experienced developer with 5 years in React and Node.js.'

    const result = await evaluateJob({ profile: fakeProfile, cvSummary, jobJD, provider })

    // Assert runValidated was called
    expect(mockRunValidated).toHaveBeenCalledOnce()

    // Assert the JD text reached the prompt argument
    const [calledProvider, calledSchema, calledArgs] = mockRunValidated.mock.calls[0]
    expect(calledProvider).toBe(provider)
    expect(calledArgs.prompt).toContain(jobJD)
    expect(calledArgs.system).toBeTruthy()

    // Assert it returned the evaluation output
    expect(result).toEqual(fakeEvaluation)
    expect(result.score).toBe(4.2)
  })

  it('passes the cvSummary into the prompt', async () => {
    mockRunValidated.mockResolvedValue(fakeEvaluation)

    const provider: LLMProvider = { complete: vi.fn() }
    const jobJD = 'Senior role requirements'
    const cvSummary = 'My unique CV summary with proof points'

    await evaluateJob({ profile: fakeProfile, cvSummary, jobJD, provider })

    const [, , calledArgs] = mockRunValidated.mock.calls[0]
    expect(calledArgs.prompt).toContain(cvSummary)
  })
})
