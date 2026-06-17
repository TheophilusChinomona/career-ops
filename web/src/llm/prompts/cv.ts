import type { CvMaster } from '@/generated/prisma'

export function buildTailoredCvPrompt(input: {
  cvMaster: CvMaster
  jobJD: string
  archetype: string
}) {
  const { cvMaster, jobJD, archetype } = input

  const system = [
    'You are a CV tailoring specialist. Your job is to tailor the provided master CV to the job description.',
    '',
    'STRICT RULES:',
    '  - Only reword real experience already present in the master CV. Never invent new experience, roles, metrics, or skills.',
    '  - Reword bullets and summaries to mirror the JD vocabulary and keywords — but do not fabricate.',
    '  - Use active voice, short sentences, concrete specifics. No clichés, no passive constructions.',
    '  - Adapt framing for the detected archetype: ' + archetype,
    '',
    'OUTPUT: Return ONLY valid JSON matching the TailoredCv shape exactly:',
    '{',
    '  "roleTag": <string — concise title variant matching the JD>,',
    '  "summary": <string — 2-3 sentence professional summary tailored to the JD>,',
    '  "competencies": [<string>, ...],   // 4-10 core competency phrases drawn from real experience',
    '  "experience": [',
    '    {',
    '      "company": <string>,',
    '      "role": <string>,',
    '      "location": <string optional>,',
    '      "period": <string>,',
    '      "bullets": [<string>, ...]',
    '    }',
    '  ],',
    '  "education": [{ "title": <string>, "org": <string>, "period": <string>, "desc": <string optional> }],',
    '  "certs": [<string>, ...],',
    '  "skills": [{ "category": <string>, "items": [<string>, ...] }]',
    '}',
    '',
    'Return ONLY the JSON object — no markdown fences, no preamble, no commentary.',
  ].join('\n')

  const prompt = [
    'MASTER CV (JSON):',
    JSON.stringify(cvMaster, null, 2),
    '',
    'JOB DESCRIPTION:',
    jobJD,
    '',
    'Return the tailored CV JSON now.',
  ].join('\n')

  return { system, prompt }
}
