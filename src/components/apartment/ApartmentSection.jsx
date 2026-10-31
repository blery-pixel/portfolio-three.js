import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import ErrorBoundary from './ErrorBoundary'
import { AUTO_LOAD, CREDIT, FALLBACK_SIZE_MB, MOBILE_MODEL_URL, MODEL_URL } from './config'
import { fetchModelInfo, getDeviceProfile, hasWebGL2 } from './device'
import { IconDoor } from './Icons'
import './apartment.css'

// three + @react-three/fiber + drei are inside this lazy chunk: none of it is in the main bundle.
const importViewer = () => import('./ApartmentViewer')
const ApartmentViewer = lazy(importViewer)

const SIZE_WARN_MB = 60

/**
 * Drop-in section. Usage:  <ApartmentSection />
 *
 * Loading strategy (nothing 3D touches first paint):
 *  1. Teaser (pure HTML/CSS, ~2 KB).
 *  2. When the teaser nears the viewport, the small viewer JS chunk is prefetched (idle).
 *  3. The model itself (hundreds of MB) is fetched only after the visitor presses "Enter".
 *     Set VITE_APARTMENT_AUTOLOAD=true once you ship the optimised file to start on scroll instead.
 */
export default function ApartmentSection({ id = 'apartment', className = '' }) {
  const root = useRef(null)
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [info, setInfo] = useState({ exists: true, sizeMB: null })
  const [supported, setSupported] = useState(true)
  const profile = useMemo(getDeviceProfile, [])
  const url = profile.isTouch && MOBILE_MODEL_URL ? MOBILE_MODEL_URL : MODEL_URL

  useEffect(() => setSupported(hasWebGL2()), [])

  // prefetch the (small) viewer chunk + learn the model size when the section approaches the viewport
  useEffect(() => {
    const el = root.current
    if (!el) return
    const ctrl = new AbortController()
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200))
        idle(() => {
          if (!profile.saveData) importViewer().catch(() => {})
          fetchModelInfo(url, ctrl.signal).then((r) => {
            if (r.aborted) return
            setInfo(r)
            if (AUTO_LOAD && r.exists && !profile.saveData) setOpen(true)
          })
        })
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => { io.disconnect(); ctrl.abort() }
  }, [url, profile.saveData])

  const sizeMB = info.sizeMB ?? FALLBACK_SIZE_MB
  const heavy = sizeMB > SIZE_WARN_MB
  const sizeLabel = sizeMB >= 1000 ? `${(sizeMB / 1024).toFixed(1)} GB` : `${Math.round(sizeMB)} MB`

  const enter = () => {
    // very large file on a phone / metered / low-memory device: ask first
    if (heavy && profile.constrained && !confirm) return setConfirm(true)
    setOpen(true)
  }
  const close = () => { setOpen(false); setConfirm(false) }

  const fallbackNode = (err, reset) => (
    <div className="apt-fallback" role="alert">
      <p>The 3D viewer couldn’t start.</p>
      <div className="apt-error__actions">
        <button className="apt-btn apt-btn--primary" onClick={reset}>Retry</button>
        <button className="apt-btn" onClick={close}>Back</button>
      </div>
    </div>
  )

  return (
    <section id={id} ref={root} className={`apt-section ${className}`} aria-labelledby={`${id}-title`}>
      <div className="apt-section__head">
        <p className="apt-kicker">Interactive 3D</p>
        <h2 id={`${id}-title`}>{CREDIT.title}</h2>
        <p className="apt-lede">
          Step into a fully textured, explorable reconstruction of the writer’s study — books, relics and all.
          Orbit, zoom and look around in your browser.
        </p>
      </div>

      <div className="apt-stage">
        {open ? (
          <ErrorBoundary fallback={fallbackNode}>
            <Suspense fallback={<div className="apt-viewer apt-viewer--boot"><div className="apt-spinner" aria-label="Loading viewer" /></div>}>
              <ApartmentViewer url={url} expectedMB={info.sizeMB} profile={profile} onClose={close} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <div className="apt-teaser">
            <div className="apt-teaser__art" aria-hidden="true">
              <i className="apt-teaser__glow" />
              <i className="apt-teaser__plan" />
            </div>
            <div className="apt-teaser__body">
              {!supported ? (
                <p className="apt-note">Your browser doesn’t support WebGL 2, which is needed for the 3D viewer.
                  <br /><a href={CREDIT.sourceUrl} target="_blank" rel="noreferrer noopener">View the model on Sketchfab ↗</a></p>
              ) : !info.exists ? (
                <p className="apt-note">The 3D model file wasn’t found at <code>{url}</code>.<br />
                  Place <code>lovecrafts_apartment.glb</code> in <code>public/models/</code> (see README).</p>
              ) : confirm ? (
                <>
                  <p className="apt-note"><strong>Heads up:</strong> this scene is about {sizeLabel}. On a phone or a metered connection it may be slow
                    or run out of memory.</p>
                  <div className="apt-error__actions">
                    <button type="button" className="apt-btn apt-btn--primary" onClick={enter}>Load anyway</button>
                    <button type="button" className="apt-btn" onClick={() => setConfirm(false)}>Not now</button>
                  </div>
                </>
              ) : (
                <>
                  <button type="button" className="apt-cta" onClick={enter} onPointerEnter={() => importViewer().catch(() => {})}>
                    <span className="apt-cta__icon"><IconDoor /></span>
                    <span className="apt-cta__text"><strong>Enter the apartment</strong><small>{sizeLabel} · loads on demand</small></span>
                  </button>
                  <p className="apt-teaser__meta">Drag to orbit · scroll or pinch to zoom</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
