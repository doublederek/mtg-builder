/**
 * One-time script: downloads SVG set icons from Scryfall for every set
 * defined in src/data/sets.ts and saves them to public/set-icons/{code}.svg
 *
 * Run with: node scripts/fetch-set-icons.mjs
 */

import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const OUT_DIR = resolve(process.cwd(), 'public/set-icons')
mkdirSync(OUT_DIR, { recursive: true })

// Keep in sync with src/data/sets.ts
const SET_CODES = [
  'LEA','LEB','2ED','ARN','ATQ','3ED','LEG','DRK','FEM','4ED',
  'ICE','CHR','HML','ALL','MIR','5ED','VIS','WTH','TMP','STH',
  'EXO','USG','ULG','6ED','UDS','MMQ','NEM','PCY','INV','7ED',
  'PLS','APC','ODY','TOR','JUD','ONS','LGN','SCG','MRD','8ED',
  'DST','5DN','CHK','BOK','SOK','9ED','RAV','GPT','DIS','CSP',
  'TSP','PLC','FUT','10E','LRW','MOR','SHM','EVE','ALA','CON',
  'ARB','M10','ZEN','WWK','ROE','M11',
]

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const HEADERS = { 'User-Agent': 'mtg-builder/1.0 (local dev tool)' }

  console.log('Fetching Scryfall sets list…')
  const res = await fetch('https://api.scryfall.com/sets', { headers: HEADERS })
  const { data } = await res.json()

  // Build code → icon_svg_uri map (Scryfall codes are lowercase)
  const iconMap = new Map(data.map((s) => [s.code.toUpperCase(), s.icon_svg_uri]))

  let saved = 0
  let missing = 0

  for (const code of SET_CODES) {
    const iconUrl = iconMap.get(code)
    if (!iconUrl) {
      console.warn(`  ⚠ No icon found for ${code}`)
      missing++
      continue
    }

    const svgRes = await fetch(iconUrl, { headers: HEADERS })
    if (!svgRes.ok) {
      console.warn(`  ⚠ Failed to fetch icon for ${code} (${svgRes.status})`)
      missing++
      continue
    }

    const svg = await svgRes.text()
    writeFileSync(resolve(OUT_DIR, `${code.toLowerCase()}.svg`), svg)
    console.log(`  ✓ ${code}`)
    saved++

    // Respect Scryfall's rate limit (max 10 req/s)
    await sleep(120)
  }

  console.log(`\nDone: ${saved} saved, ${missing} missing.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
