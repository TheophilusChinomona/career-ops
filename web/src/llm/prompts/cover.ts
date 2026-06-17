import type { Profile } from '@/generated/prisma'

interface Job {
  company: string
  roleTitle: string
  jd: string
}

export function buildCoverLetterPrompt(input: {
  profile: Profile
  cvSummary: string
  job: Job
}) {
  const { profile, cvSummary, job } = input

  const system = [
    'You are an expert cover letter writer. Write a compelling, authentic cover letter for the candidate.',
    '',
    'OUTPUT FORMAT:',
    '  - Return plain text only — no JSON, no markdown, no schema.',
    '  - One page maximum (approximately 300-400 words).',
    '  - Standard business letter format: greeting, opening paragraph, body (2-3 paragraphs), closing.',
    '',
    'WRITING RULES:',
    '  - Active voice, short sentences, concrete specifics. No filler, no fluff.',
    '  - Mirror language and keywords from the JD naturally.',
    '  - Open with a strong, specific hook tied to the role — not "I am writing to apply for...".',
    '  - Map the candidate\'s real proof points directly to JD requirements.',
    '  - Close with a confident, direct call to action.',
    '',
    'BANNED PHRASES (do not use any of these):',
    '  - "passionate about" — instead say what specifically drives you or show it through evidence.',
    '  - "leveraged" — use "used", "applied", or name the specific tool/approach.',
    '  - "spearheaded" — use "led", "ran", "started", or "built".',
    '  - "facilitated" — use "ran" or "set up".',
    '  - "results-oriented" / "proven track record" / "best practices" / "synergies".',
    '  - "in today\'s fast-paced world" / "cutting-edge" / "innovative" / "seamless" / "robust".',
    '  - "demonstrated ability to" — show, don\'t tell.',
    '',
    'ABSOLUTE RULES:',
    '  - NEVER invent experience, metrics, or achievements not present in the candidate profile or CV summary.',
    '  - NEVER use passive voice for achievement statements.',
    '  - No longer than one page (1 page max, plain text only, no JSON output).',
  ].join('\n')

  const prompt = [
    `CANDIDATE: ${profile.fullName ?? ''}`,
    `NARRATIVE: ${profile.narrative ?? ''}`,
    `TARGET ROLES: ${(profile.targetRoles || []).join(', ')}`,
    '',
    `CV SUMMARY / PROOF POINTS:\n${cvSummary}`,
    '',
    `COMPANY: ${job.company}`,
    `ROLE: ${job.roleTitle}`,
    '',
    `JOB DESCRIPTION:\n${job.jd}`,
    '',
    'Write the cover letter now. Plain text only — no JSON, no markdown headers.',
  ].join('\n')

  return { system, prompt }
}
