import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchCardByName, getCardImageUrl, type ScryfallCard } from '../api/scryfall'
import ScanInput, { type ScanResult } from '../components/ScanInput'
import SetSelector from '../components/SetSelector'
import { MTG_SETS } from '../data/sets'
import type { CardEntry } from '../types'

interface Props {
  cards: CardEntry[]
  onAdd: (card: CardEntry) => void
  onRemove: (id: string) => void
  onAddMultiple: (id: string, amount: number) => void
}

type Mode = 'manual' | 'scan'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const BULK_OPTIONS = Array.from({ length: 19 }, (_, i) => i + 2)

function AlphabetNav({ cards }: { cards: CardEntry[] }) {
  const available = useMemo(
    () => new Set(cards.map((c) => c.name[0].toUpperCase())),
    [cards],
  )

  function scrollTo(letter: string) {
    document.getElementById(`letter-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="fixed left-0 top-0 h-screen flex flex-col py-4 px-1.5 z-20 select-none">
      {ALPHABET.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => scrollTo(l)}
          disabled={!available.has(l)}
          style={{ fontSize: 10 }}
          className={`flex-1 flex items-center justify-center font-medium leading-none transition-colors ${
            available.has(l)
              ? 'text-[var(--color-text)] hover:text-[var(--color-text-bright)] cursor-pointer'
              : 'text-[var(--color-border)] cursor-default'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

export default function CardTracker({ cards, onAdd, onRemove, onAddMultiple }: Props) {
  const [mode, setMode] = useState<Mode>('manual')
  const [name, setName] = useState('')
  const [setCode, setSetCode] = useState(MTG_SETS[0].code)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Scan state
  const [scanKey, setScanKey] = useState(0)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [scannedCard, setScannedCard] = useState<ScryfallCard | null>(null)

  useEffect(() => {
    if (mode === 'manual') inputRef.current?.focus()
  }, [mode])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sortedCards = useMemo(
    () =>
      [...cards].sort((a, b) => {
        const nameCmp = a.name.localeCompare(b.name)
        return nameCmp !== 0 ? nameCmp : a.setName.localeCompare(b.setName)
      }),
    [cards],
  )

  function handleScanResult(result: ScanResult) {
    setCapturedImage(result.imageUrl)
    if (result.card) {
      setScannedCard(result.card)
      setName(result.card.name)
    } else {
      setScannedCard(null)
      // Pre-fill name with whatever OCR picked up for manual correction
      const firstLine = result.rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 2)[0] ?? ''
      setName(firstLine)
    }
  }

  function handleRescan() {
    setCapturedImage(null)
    setScannedCard(null)
    setName('')
    setError(null)
    setScanKey((k) => k + 1)
  }

  function handleModeSwitch(m: Mode) {
    setMode(m)
    setName('')
    setError(null)
    setCapturedImage(null)
    setScannedCard(null)
    setScanKey((k) => k + 1)
  }

  function makeEntry(data: ScryfallCard): CardEntry {
    return {
      id: crypto.randomUUID(),
      name: data.name,
      setCode: data.set.toUpperCase(),
      setName: data.set_name,
      addedAt: new Date().toISOString(),
      scryfallId: data.id,
      imageUrl: getCardImageUrl(data),
      priceUsd: data.prices.usd ? parseFloat(data.prices.usd) : undefined,
      colors: data.colors ?? data.color_identity,
      typeLine: data.type_line,
      cmc: data.cmc,
      count: 1,
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      // If we already have the full card from a successful scan, use it directly
      const data = scannedCard ?? await fetchCardByName(name.trim(), setCode)
      onAdd(makeEntry(data))
      setName('')
      if (mode === 'scan') handleRescan()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch card')
    } finally {
      setLoading(false)
      if (mode === 'manual') inputRef.current?.focus()
    }
  }

  return (
    <>
      <AlphabetNav cards={cards} />

      <div className="space-y-8">
        {/* Mode toggle + form */}
        <div className="space-y-3">
          <div className="flex gap-1 p-1 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg w-fit">
            {(['manual', 'scan'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeSwitch(m)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer capitalize ${
                  mode === m
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--color-text)] hover:text-[var(--color-text-bright)]'
                }`}
              >
                {m === 'manual' ? 'Type' : 'Scan'}
              </button>
            ))}
          </div>

          {mode === 'manual' ? (
            <form onSubmit={handleAdd} className="flex gap-3 flex-wrap">
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Card name…"
                className="flex-1 min-w-48 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-[var(--color-text-bright)] placeholder:text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              <SetSelector value={setCode} onChange={setSetCode} />
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 text-white px-5 py-2.5 rounded-lg font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? 'Adding…' : 'Add Card'}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {!capturedImage ? (
                <ScanInput key={scanKey} onResult={handleScanResult} />
              ) : scannedCard ? (
                // Full match — show card preview, no set selector needed
                <form onSubmit={handleAdd}>
                  <div className="flex gap-4 items-center p-4 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl">
                    {getCardImageUrl(scannedCard) && (
                      <img
                        src={getCardImageUrl(scannedCard)}
                        alt={scannedCard.name}
                        className="w-16 rounded-lg shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--color-text-bright)] font-medium truncate">{scannedCard.name}</p>
                      <p className="text-[var(--color-text)] text-sm">{scannedCard.set_name}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        {loading ? 'Adding…' : 'Add'}
                      </button>
                      <button
                        type="button"
                        onClick={handleRescan}
                        className="px-4 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-accent)] transition-colors cursor-pointer"
                      >
                        Rescan
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                // Fallback — OCR couldn't parse, let user correct manually
                <form onSubmit={handleAdd} className="space-y-3">
                  <p className="text-xs text-[var(--color-text)]">
                    Couldn't read collector number — correct the name and pick a set manually.
                  </p>
                  <div className="flex gap-4 items-start">
                    <img src={capturedImage} alt="Captured"
                      className="w-20 rounded-lg border border-[var(--color-border)] shrink-0" />
                    <div className="flex-1 space-y-2">
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="Card name…"
                        className="w-full bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-[var(--color-text-bright)] placeholder:text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] transition-colors" />
                      <div className="flex gap-2 flex-wrap">
                        <SetSelector value={setCode} onChange={setSetCode} />
                        <button type="submit" disabled={loading || !name.trim()}
                          className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 text-white px-5 py-2.5 rounded-lg font-medium transition-colors cursor-pointer disabled:cursor-not-allowed">
                          {loading ? 'Adding…' : 'Add Card'}
                        </button>
                        <button type="button" onClick={handleRescan}
                          className="px-5 py-2.5 rounded-lg text-sm font-medium border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-accent)] transition-colors cursor-pointer">
                          Rescan
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Card grid */}
        {sortedCards.length === 0 ? (
          <p className="text-[var(--color-text)] text-sm">No cards yet. Add one above.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
            {sortedCards.map((card, i) => {
              const letter = card.name[0].toUpperCase()
              const isFirstOfLetter = i === 0 || sortedCards[i - 1].name[0].toUpperCase() !== letter

              return (
                <div
                  key={card.id}
                  id={isFirstOfLetter ? `letter-${letter}` : undefined}
                  className="relative bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl overflow-hidden"
                >
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="w-full aspect-[5/7] object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-[5/7] flex items-center justify-center text-[var(--color-text)] text-xs p-2 text-center">
                      {card.name}
                    </div>
                  )}

                  <div className="p-2 space-y-1.5">
                    <div>
                      <p className="text-[var(--color-text-bright)] text-xs font-medium truncate">{card.name}</p>
                      <p className="text-[var(--color-text)] text-xs truncate">{card.setName}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex-1 flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => onAdd(card)}
                          className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-accent-muted)] text-[var(--color-text)] hover:text-[var(--color-text-bright)] rounded-sm text-xs leading-none px-1.5 py-0.5 transition-colors cursor-pointer"
                          aria-label="Add one"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(card.id)}
                          className="w-full bg-[var(--color-surface)] hover:bg-red-900/40 text-[var(--color-text)] hover:text-red-400 rounded-sm text-xs leading-none px-1.5 py-0.5 transition-colors cursor-pointer"
                          aria-label="Remove one"
                        >
                          −
                        </button>
                      </div>
                      <span className="text-[var(--color-text-bright)] text-xs font-semibold w-5 text-center">
                        {card.count}
                      </span>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const n = parseInt(e.target.value)
                          if (n) onAddMultiple(card.id, n)
                          e.target.value = ''
                        }}
                        className="flex-1 min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-sm text-[var(--color-text)] text-xs py-0.5 px-1 cursor-pointer focus:outline-none hover:border-[var(--color-accent)] transition-colors"
                        aria-label="Add multiple"
                      >
                        <option value="" disabled>+N</option>
                        {BULK_OPTIONS.map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
