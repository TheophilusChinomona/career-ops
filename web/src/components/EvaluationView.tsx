import type { EvaluationOut } from '@/llm/schemas'

type EvaluationViewProps = {
  evaluation: EvaluationOut
}

const blockLabels: Record<keyof EvaluationOut['blocks'], string> = {
  A: 'Block A — Role Fit',
  B: 'Block B — Conditions',
  C: 'Block C — Company',
  D: 'Block D — Gaps',
  E: 'Block E — ATS',
  F: 'Block F — Negotiation',
  G: 'Block G — Legitimacy',
}

const blockKeys = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const

export default function EvaluationView({ evaluation }: EvaluationViewProps) {
  return (
    <div className="flex flex-col gap-4">
      {blockKeys.map((key) => (
        <div key={key} className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1">
            {blockLabels[key]}
          </h3>
          <p className="text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed">
            {evaluation.blocks[key]}
          </p>
        </div>
      ))}
    </div>
  )
}
