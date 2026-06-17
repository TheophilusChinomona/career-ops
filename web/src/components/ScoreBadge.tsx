type ScoreBadgeProps = {
  score: number
}

function getBandClass(score: number): string {
  if (score >= 4) return 'badge-green'
  if (score >= 3) return 'badge-amber'
  return 'badge-red'
}

const bandStyles: Record<string, string> = {
  'badge-green': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'badge-amber': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  'badge-red': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function ScoreBadge({ score }: ScoreBadgeProps) {
  const bandClass = getBandClass(score)
  return (
    <span
      className={[
        bandClass,
        bandStyles[bandClass],
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
      ].join(' ')}
    >
      {score.toFixed(1)}/5
    </span>
  )
}
