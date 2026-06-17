type ActionBarProps = {
  onEvaluate?: () => void
  onTailorCv?: () => void
  onCoverLetter?: () => void
  onApply?: () => void
}

export default function ActionBar({
  onEvaluate,
  onTailorCv,
  onCoverLetter,
  onApply,
}: ActionBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onEvaluate}
        className="rounded px-3 py-1.5 text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 transition-colors"
      >
        Evaluate
      </button>
      <button
        type="button"
        onClick={onTailorCv}
        className="rounded px-3 py-1.5 text-sm font-medium bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 transition-colors"
      >
        Tailor CV
      </button>
      <button
        type="button"
        onClick={onCoverLetter}
        className="rounded px-3 py-1.5 text-sm font-medium bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 transition-colors"
      >
        Cover Letter
      </button>
      <button
        type="button"
        onClick={onApply}
        className="rounded px-3 py-1.5 text-sm font-medium bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 transition-colors"
      >
        Apply
      </button>
    </div>
  )
}
