import { useEffect, useRef, useState } from 'react'
import { MTG_SETS } from '../data/sets'

interface Props {
  value: string
  onChange: (code: string) => void
}

export default function SetSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = MTG_SETS.find((s) => s.code === value)

  const filtered = MTG_SETS.filter((s) => {
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
  })

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function select(code: string) {
    onChange(code)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-[var(--color-text-bright)] hover:border-[var(--color-accent)] focus:outline-none focus:border-[var(--color-accent)] transition-colors cursor-pointer min-w-52"
      >
        {selected && (
          <img
            src={`https://svgs.scryfall.io/sets/${selected.code.toLowerCase()}.svg`}
            alt=""
            className="w-4 h-4 shrink-0 invert opacity-70"
          />
        )}
        <span className="flex-1 text-left text-sm truncate">
          {selected ? `${selected.name} (${selected.year})` : 'Select set…'}
        </span>
        <svg className="w-3.5 h-3.5 shrink-0 opacity-50" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 8L1 3h10L6 8z" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-72 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[var(--color-border)]">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sets…"
              className="w-full bg-[var(--color-surface)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-bright)] placeholder:text-[var(--color-text)] focus:outline-none"
            />
          </div>
          <ul className="overflow-y-auto max-h-60">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-[var(--color-text)]">No sets found</li>
            )}
            {filtered.map((s) => (
              <li key={s.code}>
                <button
                  type="button"
                  onClick={() => select(s.code)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors cursor-pointer hover:bg-[var(--color-accent-muted)] ${
                    s.code === value ? 'text-[var(--color-text-bright)]' : 'text-[var(--color-text)]'
                  }`}
                >
                  <img
                    src={`https://svgs.scryfall.io/sets/${s.code.toLowerCase()}.svg`}
                    alt=""
                    className="w-4 h-4 shrink-0 invert opacity-60"
                  />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-xs opacity-40">{s.year}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
