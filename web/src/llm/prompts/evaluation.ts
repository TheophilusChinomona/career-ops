import type { Profile } from '@/generated/prisma'

export function buildEvaluationPrompt(input: { profile: Profile; cvSummary: string; jobJD: string }) {
  const { profile, cvSummary, jobJD } = input

  const system = [
    'You are a rigorous career evaluator. Score a job offer against a candidate using six blocks A-G.',
    '',
    'Blocks A-F (scored 1-5 each):',
    '  A — Role Summary: archetype, domain, function, seniority, remote policy, team size, TL;DR.',
    '  B — Match with CV: map each JD requirement to exact lines in the CV; identify gaps with mitigation plans.',
    '  C — Level & Strategy: detected level vs candidate level; "sell senior without lying" plan; downlevel contingency.',
    '  D — Comp & Demand: salary vs market data (Glassdoor / Levels.fyi / Blind); demand trend.',
    '  E — Customisation Plan: top-5 CV changes + top-5 LinkedIn changes to maximise match.',
    '  F — Interview Plan: 6-10 STAR+R stories mapped to JD requirements; recommended case study; red-flag Q&A.',
    '',
    'Block G — Posting Legitimacy (NOT part of the 1-5 score; qualitative only):',
    '  Assess whether this is a real, active opening.',
    '  Tier must be exactly one of: "High Confidence" | "Proceed with Caution" | "Suspicious".',
    '  Key signals: posting freshness, apply-button state, JD specificity, layoff/freeze news, reposting pattern.',
    '  Present observations — never accusations. Always note legitimate explanations for concerning signals.',
    '',
    'Scoring rubric for the Global score (1-5 weighted average of A-F):',
    '  4.5+  → Strong match — recommend applying immediately.',
    '  4.0-4.4 → Good match — worth applying.',
    '  3.5-3.9 → Decent but not ideal — apply only if specific reason.',
    '  < 3.5  → Recommend against applying.',
    '',
    'ABSOLUTE RULES:',
    '  - NEVER invent experience or metrics not present in the CV / proof points.',
    '  - NEVER hardcode numbers — use only what is provided.',
    '  - Output ONLY valid JSON matching this shape:',
    '    { "score": <number 1-5>, "legitimacy": <tier string>, "recommendApply": <boolean>,',
    '      "blocks": { "A": <string>, "B": <string>, "C": <string>, "D": <string>, "E": <string>, "F": <string>, "G": <string> },',
    '      "notes": <string optional> }',
  ].join('\n')

  const prompt = [
    `CANDIDATE: ${profile.fullName}`,
    `TARGET ROLES: ${(profile.targetRoles || []).join(', ')}`,
    `LOCATION: ${profile.location ?? ''} | COMP TARGET: ${profile.compTarget ?? ''}`,
    `NARRATIVE: ${profile.narrative ?? ''}`,
    `CV SUMMARY / PROOF POINTS:\n${cvSummary}`,
    `\nJOB DESCRIPTION:\n${jobJD}`,
    '\nReturn the JSON now.',
  ].join('\n')

  return { system, prompt }
}
