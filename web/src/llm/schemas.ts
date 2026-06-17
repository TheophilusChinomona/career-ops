import { z } from 'zod'
export const EvaluationSchema = z.object({
  score: z.number().min(1).max(5),
  legitimacy: z.enum(['High Confidence', 'Proceed with Caution', 'Suspicious']),
  recommendApply: z.boolean(),
  blocks: z.object({
    A: z.string(), B: z.string(), C: z.string(),
    D: z.string(), E: z.string(), F: z.string(), G: z.string(),
  }),
  notes: z.string().optional(),
})
export type EvaluationOut = z.infer<typeof EvaluationSchema>

export const ExperienceItem = z.object({
  company: z.string(), role: z.string(), location: z.string().optional(),
  period: z.string(), bullets: z.array(z.string()),
})
export const TailoredCvSchema = z.object({
  roleTag: z.string(),
  summary: z.string(),
  competencies: z.array(z.string()).min(4).max(10),
  experience: z.array(ExperienceItem),
  education: z.array(z.object({ title: z.string(), org: z.string(), period: z.string(), desc: z.string().optional() })),
  certs: z.array(z.string()),
  skills: z.array(z.object({ category: z.string(), items: z.array(z.string()) })),
})
export type TailoredCvOut = z.infer<typeof TailoredCvSchema>

export const JobExtractSchema = z.object({
  company: z.string(),
  role: z.string(),
  location: z.string().optional(),
})
export type JobExtractOut = z.infer<typeof JobExtractSchema>
