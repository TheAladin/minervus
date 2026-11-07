const GRADIENTS = [
  'from-sky-400 to-blue-600',
  'from-violet-400 to-indigo-600',
  'from-orange-300 to-orange-500',
  'from-emerald-400 to-green-600',
  'from-fuchsia-400 to-purple-600',
  'from-rose-400 to-pink-600',
  'from-cyan-400 to-teal-600',
  'from-amber-300 to-yellow-500',
]

/** A colored tile with the deck's first letter. Each deck keeps its color. */
export default function DeckIcon({ deck, className = 'size-10 rounded-[0.6875rem] text-title-3' }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center bg-linear-to-b font-semibold text-white shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.08)] ${GRADIENTS[deck.id % GRADIENTS.length]} ${className}`}
    >
      {[...deck.name.trim()][0]?.toLocaleUpperCase()}
    </span>
  )
}
