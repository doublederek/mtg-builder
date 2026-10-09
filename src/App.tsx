import { useEffect, useState } from 'react'
import { addCard, addMultiple, loadCards, removeCard } from './data/storage'
import type { CardEntry, ViewMode } from './types'
import CardPrices from './views/CardPrices'
import CardTracker from './views/CardTracker'
import DeckBuilder from './views/DeckBuilder'

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'tracker', label: 'Card Tracker' },
  { id: 'prices', label: 'Card Prices' },
  { id: 'builder', label: 'Deck Builder' },
]

export default function App() {
  const [view, setView] = useState<ViewMode>('tracker')
  const [cards, setCards] = useState<CardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCards().then((data) => {
      setCards(data)
      setLoading(false)
    })
  }, [])

  async function handleAdd(card: CardEntry) {
    setCards(await addCard(cards, card))
  }

  async function handleRemove(id: string) {
    setCards(await removeCard(cards, id))
  }

  async function handleAddMultiple(id: string, amount: number) {
    setCards(await addMultiple(cards, id, amount))
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
        <h1 className="text-[var(--color-text-bright)] font-semibold tracking-tight">
          MTG Builder
        </h1>
        <nav className="flex gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                view === v.id
                  ? 'bg-[var(--color-accent-muted)] text-[var(--color-text-bright)]'
                  : 'text-[var(--color-text)] hover:text-[var(--color-text-bright)]'
              }`}
            >
              {v.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        {loading ? (
          <p className="text-[var(--color-text)] text-sm">Loading collection…</p>
        ) : (
          <>
            {view === 'tracker' && (
              <CardTracker cards={cards} onAdd={handleAdd} onRemove={handleRemove} onAddMultiple={handleAddMultiple} />
            )}
            {view === 'prices' && <CardPrices cards={cards} />}
            {view === 'builder' && <DeckBuilder cards={cards} />}
          </>
        )}
      </main>
    </div>
  )
}
