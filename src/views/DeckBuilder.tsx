import { useEffect, useMemo, useState } from 'react'
import type { CardEntry } from '../types'
import { MTG_COLOR_NAMES, MTG_COLORS } from '../types'

interface Props {
  cards: CardEntry[]
}

const COMMON_TYPES = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land']

export default function DeckBuilder({ cards }: Props) {
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [collectionPath, setCollectionPath] = useState<string>('collection.json')
  const [prompt, setPrompt] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/info')
      .then((r) => r.json())
      .then((d: { collectionPath: string }) => setCollectionPath(d.collectionPath))
      .catch(() => {})
  }, [])

  function toggleColor(c: string) {
    setSelectedColors((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    )
    setPrompt(null)
  }

  function toggleType(t: string) {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    )
    setPrompt(null)
  }

  const pool = useMemo(() => {
    let p = [...cards]
    if (selectedColors.length > 0) {
      p = p.filter((c) => c.colors && c.colors.some((col) => selectedColors.includes(col)))
    }
    if (selectedTypes.length > 0) {
      p = p.filter((c) => c.typeLine && selectedTypes.some((t) => c.typeLine!.includes(t)))
    }
    return p
  }, [cards, selectedColors, selectedTypes])

  const uniqueNames = useMemo(() => new Set(pool.map((c) => c.name)).size, [pool])

  function generatePrompt() {
    const colorLine = selectedColors.length > 0
      ? `- Colors: ${selectedColors.map((c) => MTG_COLOR_NAMES[c]).join(', ')}`
      : null
    const typeLine = selectedTypes.length > 0
      ? `- Card types: ${selectedTypes.join(', ')}`
      : null
    const constraints = [colorLine, typeLine].filter(Boolean)

    const p = [
      `Read the MTG card collection from this file:`,
      `  ${collectionPath}`,
      ``,
      `Each entry has: name, setCode, setName, colors (W/U/B/R/G symbols), typeLine, cmc, scryfallId, priceUsd, imageUrl.`,
      ``,
      `To assess card synergies, fetch oracle text from Scryfall for any cards you need:`,
      `  GET https://api.scryfall.com/cards/{scryfallId}`,
      ``,
      `Build the best possible 60-card Magic: The Gathering deck from this collection.`,
      ...(constraints.length > 0 ? [``, `Constraints:`, ...constraints] : []),
      ``,
      `Rules:`,
      `- Maximum 4 copies of any single card (by name)`,
      `- Include ~22–24 lands appropriate for the chosen colors`,
      `- Prioritise synergy — groups of cards that make each other better — over raw individual card power`,
      ``,
      `Return:`,
      `1. The full 60-card deck list with quantities (e.g. "4x Lightning Bolt (LEA)")`,
      `2. A 2–3 sentence description of the deck's overall strategy`,
      `3. The key synergy packages — which specific cards work together and why`,
    ].join('\n')

    setPrompt(p)
    setCopied(false)
  }

  async function copyPrompt() {
    if (!prompt) return
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (cards.length === 0) {
    return (
      <p className="text-[var(--color-text)] text-sm">
        No cards in your collection yet. Add some in Card Tracker.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="space-y-4">
        <div>
          <p className="text-xs text-[var(--color-text)] mb-2">Colors</p>
          <div className="flex gap-2 flex-wrap">
            {MTG_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => toggleColor(c)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
                  selectedColors.includes(c)
                    ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                    : 'bg-transparent border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-accent)]'
                }`}
              >
                {MTG_COLOR_NAMES[c]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text)] mb-2">Card Types</p>
          <div className="flex gap-2 flex-wrap">
            {COMMON_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border ${
                  selectedTypes.includes(t)
                    ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                    : 'bg-transparent border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-accent)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Pool summary + generate */}
      <div className="flex items-center justify-between gap-4 p-4 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl">
        <div>
          <p className="text-[var(--color-text-bright)] text-sm font-medium">
            {pool.length} cards &middot; {uniqueNames} unique
          </p>
          <p className="text-[var(--color-text)] text-xs mt-0.5">
            {selectedColors.length === 0 && selectedTypes.length === 0
              ? 'Full collection — apply filters to narrow the pool'
              : 'Matching your current filters'}
          </p>
        </div>
        <button
          onClick={generatePrompt}
          disabled={pool.length === 0}
          className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
        >
          Generate Prompt
        </button>
      </div>

      {/* Prompt output */}
      {prompt && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--color-text)]">
              Copy this prompt and paste it into Claude Code
            </p>
            <button
              onClick={copyPrompt}
              className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-bright)] hover:border-[var(--color-accent)] transition-colors cursor-pointer"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl p-4 text-xs text-[var(--color-text)] whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
            {prompt}
          </pre>
        </div>
      )}
    </div>
  )
}
