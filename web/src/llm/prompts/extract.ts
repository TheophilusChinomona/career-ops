export function buildJobExtractPrompt(input: { markdown: string; pageTitle: string }): { system: string; prompt: string } {
  const { markdown, pageTitle } = input

  const system = [
    'Extract the hiring company, the job role/title, and the location from this job posting.',
    'Return ONLY JSON {company, role, location}.',
    'If a field is unknown use an empty string.',
    'Do not invent.',
  ].join(' ')

  // Truncate markdown to ~6000 chars to bound tokens
  const truncated = markdown.length > 6000 ? markdown.slice(0, 6000) + '\n...[truncated]' : markdown

  const prompt = [
    `Page title: ${pageTitle}`,
    '',
    'Job posting content:',
    truncated,
    '',
    'Return ONLY valid JSON matching: {company, role, location}',
  ].join('\n')

  return { system, prompt }
}
