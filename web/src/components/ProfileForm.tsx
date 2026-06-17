'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Type shapes matching Prisma Profile + CvMaster ─────────────────────────

interface ProfileData {
  id?: string
  userId?: string
  fullName: string
  email: string
  phone?: string | null
  location?: string | null
  linkedin?: string | null
  targetRoles?: string[]
  compTarget?: string | null
  narrative?: string | null
  llmProvider?: string | null
  model?: string | null
}

interface ExperienceItem {
  company: string
  role: string
  location: string
  period: string
  bullets: string[]
}

interface EducationItem {
  title: string
  org: string
  period: string
  desc?: string
}

interface SkillGroup {
  category: string
  items: string[]
}

interface CvMasterData {
  id?: string
  userId?: string
  summary: string
  experience: ExperienceItem[]
  education: EducationItem[]
  certs: string[]
  skills: SkillGroup[]
}

// ── Props ───────────────────────────────────────────────────────────────────

interface ProfileFormProps {
  initialProfile: ProfileData | null
  initialCvMaster: CvMasterData | null
}

// ── Default blank shapes ────────────────────────────────────────────────────

const blankProfile: ProfileData = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  linkedin: '',
  targetRoles: [],
  compTarget: '',
  narrative: '',
  llmProvider: '',
  model: '',
}

const blankCv: CvMasterData = {
  summary: '',
  experience: [],
  education: [],
  certs: [],
  skills: [],
}

function toArray<T>(val: T[] | unknown): T[] {
  return Array.isArray(val) ? val : []
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ProfileForm({ initialProfile, initialCvMaster }: ProfileFormProps) {
  const router = useRouter()

  // Profile state
  const [profile, setProfile] = useState<ProfileData>(() => ({
    ...blankProfile,
    ...(initialProfile ?? {}),
  }))

  // CV state
  const [cv, setCv] = useState<CvMasterData>(() => ({
    ...blankCv,
    ...(initialCvMaster ?? {}),
    experience: toArray<ExperienceItem>((initialCvMaster as CvMasterData | null)?.experience),
    education: toArray<EducationItem>((initialCvMaster as CvMasterData | null)?.education),
    certs: toArray<string>((initialCvMaster as CvMasterData | null)?.certs),
    skills: toArray<SkillGroup>((initialCvMaster as CvMasterData | null)?.skills),
  }))

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [seedStatus, setSeedStatus] = useState<'idle' | 'seeding' | 'done' | 'error'>('idle')

  // ── Handlers ─────────────────────────────────────────────────────────────

  function setProfileField<K extends keyof ProfileData>(key: K, value: ProfileData[K]) {
    setProfile((p) => ({ ...p, [key]: value }))
  }

  function setCvField<K extends keyof CvMasterData>(key: K, value: CvMasterData[K]) {
    setCv((c) => ({ ...c, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setErrorMsg('')
    try {
      const payload = {
        // Profile fields
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone ?? undefined,
        location: profile.location ?? undefined,
        linkedin: profile.linkedin ?? undefined,
        targetRoles: profile.targetRoles ?? [],
        compTarget: profile.compTarget ?? undefined,
        narrative: profile.narrative ?? undefined,
        llmProvider: profile.llmProvider ?? undefined,
        model: profile.model ?? undefined,
        // CvMaster fields
        summary: cv.summary,
        experience: cv.experience,
        education: cv.education,
        certs: cv.certs,
        skills: cv.skills,
      }
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to save')
      }
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  async function handleSeed() {
    setSeedStatus('seeding')
    try {
      const res = await fetch('/api/profile/seed', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Seed failed')
      }
      setSeedStatus('done')
      router.refresh()
      setTimeout(() => setSeedStatus('idle'), 3000)
    } catch (err) {
      setSeedStatus('error')
      console.error(err)
    }
  }

  // ── Dynamic list helpers ──────────────────────────────────────────────────

  function addExperience() {
    setCv((c) => ({
      ...c,
      experience: [
        ...c.experience,
        { company: '', role: '', location: '', period: '', bullets: [''] },
      ],
    }))
  }

  function updateExperience(idx: number, field: keyof ExperienceItem, value: string | string[]) {
    setCv((c) => {
      const exp = [...c.experience]
      exp[idx] = { ...exp[idx], [field]: value }
      return { ...c, experience: exp }
    })
  }

  function removeExperience(idx: number) {
    setCv((c) => ({ ...c, experience: c.experience.filter((_, i) => i !== idx) }))
  }

  function addEducation() {
    setCv((c) => ({
      ...c,
      education: [...c.education, { title: '', org: '', period: '', desc: '' }],
    }))
  }

  function updateEducation(idx: number, field: keyof EducationItem, value: string) {
    setCv((c) => {
      const edu = [...c.education]
      edu[idx] = { ...edu[idx], [field]: value }
      return { ...c, education: edu }
    })
  }

  function removeEducation(idx: number) {
    setCv((c) => ({ ...c, education: c.education.filter((_, i) => i !== idx) }))
  }

  function addCert() {
    setCv((c) => ({ ...c, certs: [...c.certs, ''] }))
  }

  function updateCert(idx: number, value: string) {
    setCv((c) => {
      const certs = [...c.certs]
      certs[idx] = value
      return { ...c, certs }
    })
  }

  function removeCert(idx: number) {
    setCv((c) => ({ ...c, certs: c.certs.filter((_, i) => i !== idx) }))
  }

  function addSkillGroup() {
    setCv((c) => ({ ...c, skills: [...c.skills, { category: '', items: [] }] }))
  }

  function updateSkillGroup(idx: number, field: keyof SkillGroup, value: string | string[]) {
    setCv((c) => {
      const skills = [...c.skills]
      skills[idx] = { ...skills[idx], [field]: value }
      return { ...c, skills }
    })
  }

  function removeSkillGroup(idx: number) {
    setCv((c) => ({ ...c, skills: c.skills.filter((_, i) => i !== idx) }))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-3xl">

      {/* Status banner */}
      {status === 'saved' && (
        <div className="rounded bg-green-50 border border-green-200 text-green-800 px-4 py-2 text-sm">
          Saved successfully.
        </div>
      )}
      {status === 'error' && (
        <div className="rounded bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
          Error: {errorMsg}
        </div>
      )}

      {/* ── Profile Section ── */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-4">
          Profile
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={profile.fullName}
              onChange={(e) => setProfileField('fullName', e.target.value)}
              className="w-full rounded border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfileField('email', e.target.value)}
              className="w-full rounded border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={profile.phone ?? ''}
              onChange={(e) => setProfileField('phone', e.target.value)}
              className="w-full rounded border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Location
            </label>
            <input
              id="location"
              type="text"
              value={profile.location ?? ''}
              onChange={(e) => setProfileField('location', e.target.value)}
              className="w-full rounded border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label htmlFor="linkedin" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              LinkedIn
            </label>
            <input
              id="linkedin"
              type="url"
              value={profile.linkedin ?? ''}
              onChange={(e) => setProfileField('linkedin', e.target.value)}
              className="w-full rounded border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label htmlFor="compTarget" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Compensation Target
            </label>
            <input
              id="compTarget"
              type="text"
              value={profile.compTarget ?? ''}
              onChange={(e) => setProfileField('compTarget', e.target.value)}
              className="w-full rounded border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="targetRoles" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Target Roles (comma-separated)
            </label>
            <input
              id="targetRoles"
              type="text"
              value={(profile.targetRoles ?? []).join(', ')}
              onChange={(e) =>
                setProfileField(
                  'targetRoles',
                  e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                )
              }
              className="w-full rounded border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="narrative" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Narrative
            </label>
            <textarea
              id="narrative"
              rows={3}
              value={profile.narrative ?? ''}
              onChange={(e) => setProfileField('narrative', e.target.value)}
              className="w-full rounded border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <label htmlFor="llmProvider" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              LLM Provider
            </label>
            <select
              id="llmProvider"
              value={profile.llmProvider ?? ''}
              onChange={(e) => setProfileField('llmProvider', e.target.value)}
              className="w-full rounded border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            >
              <option value="">Default</option>
              <option value="claude">Claude (Anthropic)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
            </select>
          </div>

          <div>
            <label htmlFor="model" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Model
            </label>
            <input
              id="model"
              type="text"
              value={profile.model ?? ''}
              onChange={(e) => setProfileField('model', e.target.value)}
              placeholder="e.g. claude-opus-4-5"
              className="w-full rounded border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>
      </section>

      {/* ── CV Section ── */}
      <section>
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-4">
          CV / Resume
        </h2>

        {/* Summary */}
        <div className="mb-6">
          <label htmlFor="summary" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Summary
          </label>
          <textarea
            id="summary"
            rows={4}
            value={cv.summary}
            onChange={(e) => setCvField('summary', e.target.value)}
            className="w-full rounded border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
          />
        </div>

        {/* Experience */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-neutral-700 dark:text-neutral-300">Experience</h3>
            <button
              type="button"
              onClick={addExperience}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              + Add Role
            </button>
          </div>
          {cv.experience.map((exp, idx) => (
            <div key={idx} className="border border-neutral-200 dark:border-neutral-700 rounded p-4 mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label={`Experience ${idx + 1} Company`}
                  type="text"
                  placeholder="Company"
                  value={exp.company}
                  onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                  className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <input
                  aria-label={`Experience ${idx + 1} Role`}
                  type="text"
                  placeholder="Role / Title"
                  value={exp.role}
                  onChange={(e) => updateExperience(idx, 'role', e.target.value)}
                  className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <input
                  aria-label={`Experience ${idx + 1} Location`}
                  type="text"
                  placeholder="Location"
                  value={exp.location}
                  onChange={(e) => updateExperience(idx, 'location', e.target.value)}
                  className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <input
                  aria-label={`Experience ${idx + 1} Period`}
                  type="text"
                  placeholder="Period (e.g. 2020–2024)"
                  value={exp.period}
                  onChange={(e) => updateExperience(idx, 'period', e.target.value)}
                  className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              <textarea
                aria-label={`Experience ${idx + 1} Bullets`}
                rows={3}
                placeholder="Bullet points (one per line)"
                value={exp.bullets.join('\n')}
                onChange={(e) =>
                  updateExperience(idx, 'bullets', e.target.value.split('\n'))
                }
                className="w-full rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              />
              <button
                type="button"
                onClick={() => removeExperience(idx)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* Education */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-neutral-700 dark:text-neutral-300">Education</h3>
            <button
              type="button"
              onClick={addEducation}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              + Add Education
            </button>
          </div>
          {cv.education.map((edu, idx) => (
            <div key={idx} className="border border-neutral-200 dark:border-neutral-700 rounded p-4 mb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label={`Education ${idx + 1} Title`}
                  type="text"
                  placeholder="Degree / Qualification"
                  value={edu.title}
                  onChange={(e) => updateEducation(idx, 'title', e.target.value)}
                  className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <input
                  aria-label={`Education ${idx + 1} Org`}
                  type="text"
                  placeholder="Institution"
                  value={edu.org}
                  onChange={(e) => updateEducation(idx, 'org', e.target.value)}
                  className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <input
                  aria-label={`Education ${idx + 1} Period`}
                  type="text"
                  placeholder="Period"
                  value={edu.period}
                  onChange={(e) => updateEducation(idx, 'period', e.target.value)}
                  className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
                <input
                  aria-label={`Education ${idx + 1} Description`}
                  type="text"
                  placeholder="Notes / Description (optional)"
                  value={edu.desc ?? ''}
                  onChange={(e) => updateEducation(idx, 'desc', e.target.value)}
                  className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                />
              </div>
              <button
                type="button"
                onClick={() => removeEducation(idx)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* Certifications */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-neutral-700 dark:text-neutral-300">Certifications</h3>
            <button
              type="button"
              onClick={addCert}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              + Add Cert
            </button>
          </div>
          {cv.certs.map((cert, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input
                aria-label={`Certification ${idx + 1}`}
                type="text"
                value={cert}
                onChange={(e) => updateCert(idx, e.target.value)}
                placeholder="Certification name"
                className="flex-1 rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              />
              <button
                type="button"
                onClick={() => removeCert(idx)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        {/* Skills */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-neutral-700 dark:text-neutral-300">Skills</h3>
            <button
              type="button"
              onClick={addSkillGroup}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
            >
              + Add Skill Group
            </button>
          </div>
          {cv.skills.map((group, idx) => (
            <div key={idx} className="border border-neutral-200 dark:border-neutral-700 rounded p-4 mb-3 space-y-2">
              <input
                aria-label={`Skill Group ${idx + 1} Category`}
                type="text"
                placeholder="Category (e.g. Project Management)"
                value={group.category}
                onChange={(e) => updateSkillGroup(idx, 'category', e.target.value)}
                className="w-full rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              />
              <input
                aria-label={`Skill Group ${idx + 1} Items`}
                type="text"
                placeholder="Items (comma-separated)"
                value={group.items.join(', ')}
                onChange={(e) =>
                  updateSkillGroup(
                    idx,
                    'items',
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  )
                }
                className="w-full rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              />
              <button
                type="button"
                onClick={() => removeSkillGroup(idx)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Actions ── */}
      <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="px-5 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
        >
          {status === 'saving' ? 'Saving…' : 'Save Profile'}
        </button>

        <button
          type="button"
          onClick={handleSeed}
          disabled={seedStatus === 'seeding'}
          className="px-5 py-2 rounded border border-neutral-300 dark:border-neutral-600 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-60"
        >
          {seedStatus === 'seeding' ? 'Seeding…' : seedStatus === 'done' ? 'Seeded!' : 'Seed from Repo Files'}
        </button>
      </div>

      {seedStatus === 'error' && (
        <p className="text-sm text-red-600 mt-2">Seed failed. Make sure config/profile.yml and cv.md exist.</p>
      )}
    </form>
  )
}
