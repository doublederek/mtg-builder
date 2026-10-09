import { useMemo, useState } from 'react'
import type { CardEntry } from '../types'

interface Props {
  cards: CardEntry[]
}

export default function CardPrices({ cards }: Props) {
  const [search, setSearch] = useState('')

  const withPrices = cards.filter((c) => c.priceUsd !== undefined)
  const totalValue = withPrices.reduce((sum, c) => sum + (c.priceUsd ?? 0), 0)

  const grouped = useMemo(() => {
    const map = new Map<string, CardEntry[]>()
    for (const card of cards) {
      const key = card.name
      const existing = map.get(key) ?? []
      map.set(key, [...existing, card])
    }
    return map
  }, [cards])

  const topCards = useMemo(
    () =>
      [...cards]
        .filter((c) => c.priceUsd !== undefined)
        .sort((a, b) => (b.priceUsd ?? 0) - (a.priceUsd ?? 0))
        .slice(0, 5),
    [cards],
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return [...grouped.entries()]
    const q = search.toLowerCase()
    return [...grouped.entries()].filter(([name]) => name.toLowerCase().includes(q))
  }, [grouped, search])

  if (cards.length === 0) {
    return (
      <p className="text-[var(--color-text)] text-sm">
        No cards in your collection yet. Add some in Card Tracker.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Total Cards" value={cards.length.toString()} />
        <StatCard label="Unique Cards" value={grouped.size.toString()} />
        <StatCard
          label="Collection Value"
          value={`$${totalValue.toFixed(2)}`}
          highlight
        />
      </div>

      {/* Top cards */}
      {topCards.length > 0 && (
        <div>
          <h2 className="text-[var(--color-text-bright)] font-medium mb-3">Top 5 by Value</h2>
          <div className="space-y-2">
            {topCards.map((card) => (
              <PriceRow key={card.id} card={card} />
            ))}
          </div>
        </div>
      )}

      {/* Search + full list */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3">
          <h2 className="text-[var(--color-text-bright)] font-medium">All Cards</h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-bright)] placeholder:text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors w-48"
          />
        </div>
        <div className="space-y-1">
          {filtered.map(([name, copies]) => (
            <div
              key={name}
              className="flex items-center gap-3 px-4 py-2.5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg"
            >
              <span className="flex-1 text-[var(--color-text-bright)] text-sm">{name}</span>
              <div className="flex gap-3 flex-wrap justify-end">
                {copies.map((c) => (
                  <span key={c.id} className="text-xs text-[var(--color-text)]">
                    {c.setName}
                    {c.priceUsd !== undefined && (
                      <span className="ml-1.5 text-emerald-400">${c.priceUsd.toFixed(2)}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl p-4">
      <p className="text-[var(--color-text)] text-xs mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${highlight ? 'text-emerald-400' : 'text-[var(--color-text-bright)]'}`}>
        {value}
      </p>
    </div>
  )
}

function PriceRow({ card }: { card: CardEntry }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg">
      <span className="flex-1 text-[var(--color-text-bright)] text-sm">{card.name}</span>
      <span className="text-xs text-[var(--color-text)]">{card.setName}</span>
      <span className="text-emerald-400 font-medium text-sm">${card.priceUsd!.toFixed(2)}</span>
    </div>
  )
}
