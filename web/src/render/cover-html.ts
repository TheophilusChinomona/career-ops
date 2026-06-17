export interface CoverContact {
  name: string
  email?: string
  phone?: string
  linkedin?: string
  location?: string
  roleTag?: string
}

export interface CoverRecipient {
  company: string
  hiringTeam?: string
}

export interface CoverLetterInput {
  contact: CoverContact
  recipient: CoverRecipient
  date: string
  body: string
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderCoverHtml({ contact, recipient, date, body }: CoverLetterInput): string {
  // Split body on blank lines into paragraphs
  const paragraphs = body.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
  const pTags = paragraphs.map(p => `  <p>${esc(p)}</p>`).join('\n')

  const contactItems: string[] = []
  if (contact.email) contactItems.push(`<span><span class="ico">&#10003;</span>${esc(contact.email)}</span>`)
  if (contact.phone) contactItems.push(`<span><span class="ico">&#9990;</span>${esc(contact.phone)}</span>`)
  if (contact.linkedin) contactItems.push(`<a href="https://${esc(contact.linkedin)}"><span class="ico">in</span>${esc(contact.linkedin)}</a>`)
  if (contact.location) contactItems.push(`<span><span class="ico">&#9760;</span>${esc(contact.location)}</span>`)

  const roleTagHtml = contact.roleTag
    ? `\n  <div class="role-tag">${esc(contact.roleTag)}</div>`
    : ''

  const recipientBlock = recipient.hiringTeam
    ? `<strong>${esc(recipient.company)}</strong><br>${esc(recipient.hiringTeam)}`
    : `<strong>${esc(recipient.company)}</strong>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(contact.name)} — Cover Letter</title>
<style>
  @font-face { font-family:'Space Grotesk'; src:url('./fonts/space-grotesk-latin.woff2') format('woff2'); font-weight:300 700; font-style:normal; font-display:swap; }
  @font-face { font-family:'Space Grotesk'; src:url('./fonts/space-grotesk-latin-ext.woff2') format('woff2'); font-weight:300 700; font-style:normal; font-display:swap; }
  @font-face { font-family:'DM Sans'; src:url('./fonts/dm-sans-latin.woff2') format('woff2'); font-weight:100 1000; font-style:normal; font-display:swap; }
  @font-face { font-family:'DM Sans'; src:url('./fonts/dm-sans-latin-ext.woff2') format('woff2'); font-weight:100 1000; font-style:normal; font-display:swap; }
  :root{ --ink:#141414; --body:#33333d; --muted:#6f6f78; --primary:#2b2b2b; --accent:#565656; --line:#e4e4e4; --tint:#f3f3f3; }
  *{margin:0;padding:0;box-sizing:border-box;}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  body{font-family:'DM Sans',sans-serif;font-size:11px;line-height:1.6;color:var(--body);background:#fff;}
  .page{max-width:210mm;margin:0 auto;}
  .header h1{font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:700;color:var(--ink);letter-spacing:-0.02em;line-height:1;margin-bottom:3px;}
  .role-tag{font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:500;color:var(--accent);}
  .header-gradient{height:3px;border-radius:2px;margin:9px 0 8px;background:linear-gradient(to right,var(--primary),var(--accent) 70%);}
  .contact-row{display:flex;flex-wrap:wrap;gap:5px 12px;font-size:10px;color:var(--muted);}
  .contact-row a{color:var(--muted);text-decoration:none;}
  .contact-row .ico{color:var(--primary);font-weight:700;margin-right:3px;}
  .meta{margin:18px 0 14px;font-size:10.5px;color:var(--muted);}
  .recipient{margin-bottom:14px;font-size:11px;color:var(--ink);}
  .recipient strong{font-weight:600;}
  p{margin-bottom:10px;}
  .salutation{margin-bottom:10px;}
  .signoff{margin-top:16px;}
  .signoff .name{font-family:'Space Grotesk',sans-serif;font-weight:600;color:var(--ink);font-size:12px;margin-top:2px;}
  strong{color:var(--ink);font-weight:600;}
</style>
</head>
<body>
<div class="page">
  <div class="header">
  <h1>${esc(contact.name)}</h1>${roleTagHtml}
  <div class="header-gradient"></div>
  <div class="contact-row">
    ${contactItems.join('\n    ')}
  </div>
  </div>

  <div class="meta">${esc(date)}</div>
  <div class="recipient">${recipientBlock}</div>

  <div class="salutation">Dear Hiring Team,</div>

${pTags}

  <div class="signoff">
    Kind regards,
    <div class="name">${esc(contact.name)}</div>
  </div>
</div>
</body>
</html>`
}
