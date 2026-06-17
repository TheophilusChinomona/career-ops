import type { TailoredCvOut } from '@/llm/schemas'

export interface CvContact {
  name: string
  email: string
  phone?: string
  linkedin?: string
  location?: string
  availability?: string
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderCvHtml(cv: TailoredCvOut, contact: CvContact): string {
  const contactItems: string[] = []
  if (contact.email) contactItems.push(`<span><span class="ico">✉</span>${esc(contact.email)}</span>`)
  if (contact.phone) contactItems.push(`<span><span class="ico">☎</span>${esc(contact.phone)}</span>`)
  if (contact.linkedin) {
    const href = /^https?:\/\//i.test(contact.linkedin) ? contact.linkedin : `https://${contact.linkedin}`
    contactItems.push(`<a href="${esc(href)}"><span class="ico">in</span>${esc(contact.linkedin)}</a>`)
  }
  if (contact.location) contactItems.push(`<span><span class="ico">⚲</span>${esc(contact.location)}</span>`)

  const availBadge = contact.availability
    ? `<span class="avail">${esc(contact.availability)}</span>`
    : ''

  const competencyTags = cv.competencies.map((comp, i) =>
    `<span class="comp-tag${i === 0 ? ' lead' : ''}">${esc(comp)}</span>`
  ).join('\n      ')

  const experienceBlocks = cv.experience.map(job => {
    const bullets = job.bullets.map(b => `<li>${esc(b)}</li>`).join('\n          ')
    const locSpan = job.location ? ` <span class="loc">· ${esc(job.location)}</span>` : ''
    return `    <div class="job">
      <div class="job-head">
        <span class="job-company">${esc(job.company)}</span>
        <span class="job-period">${esc(job.period)}</span>
      </div>
      <div class="job-role">${esc(job.role)}${locSpan}</div>
      <ul>
          ${bullets}
      </ul>
    </div>`
  }).join('\n')

  const educationBlocks = cv.education.map(edu => {
    const desc = edu.desc ? `\n      <div class="edu-desc">${esc(edu.desc)}</div>` : ''
    return `    <div class="edu-item">
      <div class="edu-head">
        <span class="edu-title">${esc(edu.title)} — <span class="org">${esc(edu.org)}</span></span>
        <span class="edu-year">${esc(edu.period)}</span>
      </div>${desc}
    </div>`
  }).join('\n')

  const certChips = cv.certs.map(cert =>
    `<span class="cert-chip">${esc(cert)}</span>`
  ).join('\n      ')

  const skillLines = cv.skills.map(skill =>
    `<div class="skill-line"><span class="cat">${esc(skill.category)}:</span> ${skill.items.map(esc).join(' · ')}</div>`
  ).join('\n      ')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(contact.name)} — CV</title>
<style>
  @font-face {
    font-family: 'Space Grotesk';
    src: url('./fonts/space-grotesk-latin.woff2') format('woff2');
    font-weight: 300 700; font-style: normal; font-display: swap;
  }
  @font-face {
    font-family: 'Space Grotesk';
    src: url('./fonts/space-grotesk-latin-ext.woff2') format('woff2');
    font-weight: 300 700; font-style: normal; font-display: swap;
  }
  @font-face {
    font-family: 'DM Sans';
    src: url('./fonts/dm-sans-latin.woff2') format('woff2');
    font-weight: 100 1000; font-style: normal; font-display: swap;
  }
  @font-face {
    font-family: 'DM Sans';
    src: url('./fonts/dm-sans-latin-ext.woff2') format('woff2');
    font-weight: 100 1000; font-style: normal; font-display: swap;
  }

  :root {
    --primary: #2b2b2b;
    --primary-soft: #6a6a6a;
    --accent: #565656;
    --ink: #141414;
    --body: #3a3a3a;
    --muted: #767676;
    --line: #e4e4e4;
    --tint: #f3f3f3;
    --tint-border: #dcdcdc;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: 'DM Sans', sans-serif;
    font-size: 10.8px; line-height: 1.5; color: var(--body);
    background: #fff;
  }
  .page { width: 100%; max-width: 210mm; margin: 0 auto; }

  /* HEADER */
  .header { margin-bottom: 14px; }
  .header-top {
    display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
  }
  .name-block h1 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 30px; font-weight: 700; color: var(--ink);
    letter-spacing: -0.025em; line-height: 1; margin-bottom: 4px;
  }
  .role-tag {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12.5px; font-weight: 500; letter-spacing: 0.02em;
    color: var(--accent);
  }
  .avail {
    font-size: 9.5px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--primary);
    background: var(--tint); border: 1px solid var(--tint-border);
    padding: 4px 9px; border-radius: 20px; white-space: nowrap;
  }
  .header-gradient {
    height: 3px; border-radius: 2px; margin: 9px 0 8px;
    background: linear-gradient(to right, var(--primary), var(--accent) 70%, var(--accent));
  }
  .contact-row {
    display: flex; flex-wrap: wrap; gap: 5px 12px;
    font-size: 10px; color: var(--muted);
  }
  .contact-row a { color: var(--muted); text-decoration: none; }
  .contact-row .ico { color: var(--primary); font-weight: 700; margin-right: 3px; }

  /* SECTIONS */
  .section { margin-bottom: 12px; }
  .section-title {
    display: flex; align-items: center; gap: 8px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--primary);
    margin-bottom: 8px;
  }
  .section-title::before {
    content: ""; width: 12px; height: 12px; flex: none;
    border-radius: 3px;
    background: linear-gradient(135deg, var(--primary), var(--accent));
  }
  .section-title::after {
    content: ""; flex: 1; height: 1.5px; background: var(--line);
  }

  /* SUMMARY */
  .summary {
    font-size: 10.8px; line-height: 1.62; color: var(--body);
    border-left: 3px solid var(--tint-border);
    padding-left: 11px;
  }
  .summary strong { color: var(--ink); font-weight: 600; }

  /* COMPETENCIES */
  .comp-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .comp-tag {
    font-size: 9.6px; font-weight: 500; color: var(--primary);
    background: var(--tint); border: 1px solid var(--tint-border);
    padding: 3.5px 9px; border-radius: 4px;
  }
  .comp-tag.lead {
    color: #fff; border-color: transparent;
    background: linear-gradient(135deg, var(--primary), var(--accent));
  }

  /* EXPERIENCE */
  .job { margin-bottom: 10px; }
  .job-head {
    display: flex; justify-content: space-between; align-items: baseline; gap: 10px;
  }
  .job-company {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12px; font-weight: 600; color: var(--ink);
    display: flex; align-items: baseline; gap: 7px;
  }
  .job-company::before {
    content: ""; width: 6px; height: 6px; border-radius: 50%;
    background: var(--accent); flex: none; transform: translateY(-1px);
  }
  .job-period {
    font-size: 9px; font-weight: 600; color: var(--primary);
    background: var(--tint); padding: 2px 8px; border-radius: 20px;
    white-space: nowrap;
  }
  .job-role {
    font-size: 10.5px; font-weight: 600; color: var(--accent);
    margin: 1px 0 3px 13px;
  }
  .job-role .loc { color: var(--muted); font-weight: 400; }
  .job ul { list-style: none; margin-left: 13px; }
  .job li {
    position: relative; padding-left: 13px;
    font-size: 10.3px; line-height: 1.5; color: var(--body); margin-bottom: 2.5px;
  }
  .job li::before {
    content: ""; position: absolute; left: 0; top: 6px;
    width: 4px; height: 4px; border-radius: 1px; background: var(--primary-soft);
  }
  .job li strong { color: var(--ink); font-weight: 600; }

  /* EDUCATION */
  .edu-head {
    display: flex; justify-content: space-between; align-items: baseline; gap: 10px;
  }
  .edu-title { font-weight: 600; font-size: 11px; color: var(--ink); }
  .edu-title .org { color: var(--accent); font-weight: 500; }
  .edu-year {
    font-size: 9px; font-weight: 600; color: var(--primary);
    background: var(--tint); padding: 2px 8px; border-radius: 20px; white-space: nowrap;
  }
  .edu-desc { font-size: 9.8px; color: var(--muted); margin-top: 1px; }

  /* CERTIFICATIONS */
  .cert-row { display: flex; flex-wrap: wrap; gap: 6px 8px; }
  .cert-chip {
    font-size: 9.8px; color: var(--body);
    border: 1px solid var(--line); border-left: 3px solid var(--primary-soft);
    padding: 3px 10px; border-radius: 3px; background: #fafafb;
  }

  /* SKILLS */
  .skills { display: flex; flex-direction: column; gap: 4px; }
  .skill-line { font-size: 10.3px; color: var(--body); }
  .skill-line .cat {
    font-family: 'Space Grotesk', sans-serif;
    font-weight: 600; color: var(--ink); font-size: 10.3px;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  .section, .job, .edu-item { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <header class="header">
    <div class="header-top">
      <div class="name-block">
        <h1>${esc(contact.name)}</h1>
        <div class="role-tag">${esc(cv.roleTag)}</div>
      </div>
      ${availBadge}
    </div>
    <div class="header-gradient"></div>
    <div class="contact-row">
      ${contactItems.join('\n      ')}
    </div>
  </header>

  <!-- SUMMARY -->
  <section class="section">
    <div class="section-title">Professional Summary</div>
    <div class="summary">${esc(cv.summary)}</div>
  </section>

  <!-- CORE COMPETENCIES -->
  <section class="section">
    <div class="section-title">Core Competencies</div>
    <div class="comp-grid">
      ${competencyTags}
    </div>
  </section>

  <!-- EXPERIENCE -->
  <section class="section">
    <div class="section-title">Work Experience</div>
${experienceBlocks}
  </section>

  <!-- EDUCATION -->
  <section class="section">
    <div class="section-title">Education</div>
${educationBlocks}
  </section>

  <!-- CERTIFICATIONS -->
  ${cv.certs.length > 0 ? `<section class="section">
    <div class="section-title">Certifications</div>
    <div class="cert-row">
      ${certChips}
    </div>
  </section>` : ''}

  <!-- SKILLS -->
  ${cv.skills.length > 0 ? `<section class="section">
    <div class="section-title">Skills</div>
    <div class="skills">
      ${skillLines}
    </div>
  </section>` : ''}

</div>
</body>
</html>`
}
