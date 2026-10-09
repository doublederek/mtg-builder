import { useEffect, useRef, useState } from 'react'
import { createWorker } from 'tesseract.js'
import { fetchCardByCollectorNumber, type ScryfallCard } from '../api/scryfall'
import { MTG_SETS } from '../data/sets'

// Build a regex that matches any known set code
const SET_CODE_PATTERN = new RegExp(
  `\\b(?<setCode>${MTG_SETS.map((s) => s.code).join('|')})\\b`,
  'i',
)

export interface ScanResult {
  card?: ScryfallCard
  rawText: string
  imageUrl: string
}

interface Props {
  onResult: (result: ScanResult) => void
}

type Phase = 'requesting' | 'live' | 'scanning' | 'error'

const CAMERA_PREF_KEY = 'mtg_preferred_camera'

interface ExtendedCapabilities extends MediaTrackCapabilities {
  focusMode?: string[]
  focusDistance?: { min: number; max: number; step: number }
  zoom?: { min: number; max: number; step: number }
  brightness?: { min: number; max: number; step: number }
  contrast?: { min: number; max: number; step: number }
  saturation?: { min: number; max: number; step: number }
  sharpness?: { min: number; max: number; step: number }
  exposureMode?: string[]
  exposureCompensation?: { min: number; max: number; step: number }
}

interface ExtendedSettings extends MediaTrackSettings {
  focusMode?: string
  focusDistance?: number
  zoom?: number
  brightness?: number
  contrast?: number
  saturation?: number
  sharpness?: number
  exposureMode?: string
  exposureCompensation?: number
}

function SliderControl({ label, value, range, onChange }: {
  label: string
  value: number
  range: { min: number; max: number; step: number }
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="text-[10px] text-[var(--color-text)]">{label}</span>
        <span className="text-[10px] text-[var(--color-text)]">{value.toFixed(1)}</span>
      </div>
      <input type="range" min={range.min} max={range.max} step={range.step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 accent-[var(--color-accent)] cursor-pointer" />
    </div>
  )
}

function parseCollectorInfo(text: string): { setCode: string; collectorNumber: string } | null {
  const upper = text.toUpperCase()

  // Primary: NNN/NNN pattern — unique to collector numbers, won't collide with copyright years
  const slashMatch = /\b(\d{1,4})\/\d{1,4}\b/.exec(upper)
  const setMatch = SET_CODE_PATTERN.exec(upper)

  if (slashMatch && setMatch?.groups?.setCode) {
    return {
      setCode: setMatch.groups.setCode.toUpperCase(),
      collectorNumber: slashMatch[1],
    }
  }

  // Fallback: known set code immediately followed by a number e.g. "ZEN 145"
  const modernMatch = /\b([A-Z0-9]{2,5})\s+(\d{1,4})\b/.exec(upper)
  if (modernMatch) {
    const potentialSet = modernMatch[1]
    if (MTG_SETS.some((s) => s.code === potentialSet)) {
      return { setCode: potentialSet, collectorNumber: modernMatch[2] }
    }
  }

  return null
}

export default function ScanInput({ onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<Phase>('requesting')
  const [statusText, setStatusText] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    () => localStorage.getItem(CAMERA_PREF_KEY) ?? '',
  )
  const [caps, setCaps] = useState<ExtendedCapabilities | null>(null)
  const [settings, setSettings] = useState<ExtendedSettings | null>(null)
  const [controlsOpen, setControlsOpen] = useState(false)

  async function applyConstraint(constraint: Record<string, unknown>) {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    await track.applyConstraints({ advanced: [constraint] } as MediaTrackConstraints)
    setSettings(track.getSettings() as ExtendedSettings)
  }

  async function startStream(deviceId: string) {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    const stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId
        ? { deviceId: { exact: deviceId }, width: { ideal: 1280 } }
        : { facingMode: 'environment', width: { ideal: 1280 } },
    })
    streamRef.current = stream
    if (videoRef.current) videoRef.current.srcObject = stream
    const track = stream.getVideoTracks()[0]
    setCaps(track.getCapabilities() as ExtendedCapabilities)
    setSettings(track.getSettings() as ExtendedSettings)
  }

  useEffect(() => {
    async function init() {
      try {
        await startStream(selectedDeviceId)
        const all = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = all.filter((d) => d.kind === 'videoinput')
        setDevices(videoDevices)
        const savedValid = selectedDeviceId && videoDevices.some((d) => d.deviceId === selectedDeviceId)
        if (!savedValid && videoDevices.length > 0) {
          const firstId = videoDevices[0].deviceId
          setSelectedDeviceId(firstId)
          await startStream(firstId)
        }
        setPhase('live')
      } catch (err) {
        setErrorMsg((err as Error).message ?? 'Could not access camera')
        setPhase('error')
      }
    }
    init()
    return () => streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  async function handleDeviceChange(deviceId: string) {
    setSelectedDeviceId(deviceId)
    localStorage.setItem(CAMERA_PREF_KEY, deviceId)
    setPhase('requesting')
    try {
      await startStream(deviceId)
      setPhase('live')
    } catch (err) {
      setErrorMsg((err as Error).message ?? 'Could not switch camera')
      setPhase('error')
    }
  }

  async function capture() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // Draw full frame
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const fullDataUrl = canvas.toDataURL('image/jpeg', 0.9)

    // Crop to bottom 20% — collector number lives here
    setPhase('scanning')
    setStatusText('Reading collector number…')
    const cropH = Math.floor(canvas.height * 0.20)
    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = canvas.width
    cropCanvas.height = cropH
    cropCanvas.getContext('2d')!.drawImage(
      canvas,
      0, canvas.height - cropH, canvas.width, cropH,
      0, 0, canvas.width, cropH,
    )

    let rawText = ''
    try {
      const worker = await createWorker('eng')
      const { data: { text } } = await worker.recognize(cropCanvas.toDataURL('image/jpeg', 0.95))
      await worker.terminate()
      rawText = text.trim()
    } catch {
      onResult({ rawText: '', imageUrl: fullDataUrl })
      return
    }

    const parsed = parseCollectorInfo(rawText)
    if (!parsed) {
      onResult({ rawText, imageUrl: fullDataUrl })
      return
    }

    setStatusText(`Found ${parsed.setCode} #${parsed.collectorNumber} — looking up…`)
    try {
      const card = await fetchCardByCollectorNumber(parsed.setCode, parsed.collectorNumber)
      onResult({ card, rawText, imageUrl: fullDataUrl })
    } catch {
      onResult({ rawText, imageUrl: fullDataUrl })
    }
  }

  const hasFocusMode = caps?.focusMode && caps.focusMode.length > 0
  const isManualFocus = settings?.focusMode === 'manual'
  const hasControls = hasFocusMode || caps?.zoom || caps?.brightness ||
    caps?.contrast || caps?.saturation || caps?.sharpness || caps?.exposureMode

  return (
    <div className="space-y-2">
      {devices.length > 1 && (
        <select value={selectedDeviceId} onChange={(e) => handleDeviceChange(e.target.value)}
          className="w-full bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-bright)] focus:outline-none focus:border-[var(--color-accent)] transition-colors cursor-pointer">
          {devices.map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>
          ))}
        </select>
      )}

      {(phase === 'requesting' || phase === 'scanning') && (
        <div className="flex flex-col items-center justify-center gap-2 h-48 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl">
          <p className="text-[var(--color-text)] text-sm animate-pulse">
            {phase === 'requesting' ? 'Starting camera…' : statusText || 'Scanning…'}
          </p>
        </div>
      )}

      {phase === 'error' && (
        <div className="flex items-center justify-center h-48 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl">
          <p className="text-red-400 text-sm">{errorMsg}</p>
        </div>
      )}

      <div className={phase === 'live' ? 'block' : 'hidden'}>
        <div className="relative rounded-xl overflow-hidden border border-[var(--color-border)]">
          <video ref={videoRef} autoPlay playsInline muted className="w-full block" />
          {/* Guide box at the bottom — collector number region */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute bottom-[12%] left-[5%] right-[5%] h-[15%] border-2 border-[var(--color-accent)] rounded opacity-70" />
            <p className="absolute bottom-[8%] left-0 right-0 text-center text-xs text-[var(--color-accent)] opacity-70">
              Align bottom of card within the box
            </p>
          </div>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <button type="button" onClick={capture}
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white px-6 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors">
              Capture
            </button>
          </div>
        </div>

        {hasControls && (
          <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
            <button type="button" onClick={() => setControlsOpen((o) => !o)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-[var(--color-text)] hover:text-[var(--color-text-bright)] transition-colors cursor-pointer">
              <span>Camera Controls</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${controlsOpen ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 8L1 3h10L6 8z" />
              </svg>
            </button>
            {controlsOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-[var(--color-border)]">
                {hasFocusMode && settings && (
                  <div className="space-y-2 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--color-text)]">Focus</span>
                      <div className="flex gap-1">
                        {['continuous', 'manual'].filter((m) => caps?.focusMode?.includes(m)).map((m) => (
                          <button key={m} type="button" onClick={() => applyConstraint({ focusMode: m })}
                            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors capitalize ${settings.focusMode === m ? 'bg-[var(--color-accent)] text-white' : 'border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-accent)]'}`}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    {isManualFocus && caps?.focusDistance && settings.focusDistance !== undefined && (
                      <SliderControl label="Focus Distance" value={settings.focusDistance} range={caps.focusDistance}
                        onChange={(v) => applyConstraint({ focusMode: 'manual', focusDistance: v })} />
                    )}
                  </div>
                )}
                {caps?.zoom && settings?.zoom !== undefined && (
                  <SliderControl label="Zoom" value={settings.zoom} range={caps.zoom}
                    onChange={(v) => applyConstraint({ zoom: v })} />
                )}
                {caps?.exposureMode && settings && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--color-text)]">Exposure</span>
                      <div className="flex gap-1">
                        {['continuous', 'manual'].filter((m) => caps?.exposureMode?.includes(m)).map((m) => (
                          <button key={m} type="button" onClick={() => applyConstraint({ exposureMode: m })}
                            className={`px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors capitalize ${settings.exposureMode === m ? 'bg-[var(--color-accent)] text-white' : 'border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-accent)]'}`}>
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    {caps.exposureCompensation && settings.exposureCompensation !== undefined && (
                      <SliderControl label="Exposure Compensation" value={settings.exposureCompensation} range={caps.exposureCompensation}
                        onChange={(v) => applyConstraint({ exposureCompensation: v })} />
                    )}
                  </div>
                )}
                {caps?.brightness && settings?.brightness !== undefined && (
                  <SliderControl label="Brightness" value={settings.brightness} range={caps.brightness}
                    onChange={(v) => applyConstraint({ brightness: v })} />
                )}
                {caps?.contrast && settings?.contrast !== undefined && (
                  <SliderControl label="Contrast" value={settings.contrast} range={caps.contrast}
                    onChange={(v) => applyConstraint({ contrast: v })} />
                )}
                {caps?.saturation && settings?.saturation !== undefined && (
                  <SliderControl label="Saturation" value={settings.saturation} range={caps.saturation}
                    onChange={(v) => applyConstraint({ saturation: v })} />
                )}
                {caps?.sharpness && settings?.sharpness !== undefined && (
                  <SliderControl label="Sharpness" value={settings.sharpness} range={caps.sharpness}
                    onChange={(v) => applyConstraint({ sharpness: v })} />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
