import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import ApartmentModel from './ApartmentModel'
import CameraRig from './CameraRig'
import Lights from './Lights'
import { Credit, CloseButton, ErrorOverlay, Hint, LoadingOverlay } from './Overlays'
import { IconCollapse, IconExpand, IconPause, IconPlay, IconReset, IconRotate } from './Icons'
import { CREDIT, WORLD_SIZE } from './config'

/**
 * The interactive scene. This file (and three / r3f / drei) is only downloaded when the visitor
 * asks for the 3D experience — see ApartmentSection.jsx.
 */
export default function ApartmentViewer({ url, expectedMB, profile, onClose }) {
  const wrap = useRef(null)
  const api = useRef(null)
  const raf = useRef(0)
  const latest = useRef({})
  const failed = useRef(false)

  const [attempt, setAttempt] = useState(0)
  const [stage, setStage] = useState('download') // download | gpu | ready | error
  const [progress, setProgress] = useState({ loaded: 0, total: 0, ratio: 0 })
  const [size, setSize] = useState(null)
  const [error, setError] = useState(null)

  const [visible, setVisible] = useState(true)
  const [engaged, setEngaged] = useState(false)
  const [immersive, setImmersive] = useState(false)
  const [autoRotate, setAutoRotate] = useState(!profile.prefersReducedMotion)
  const [animPlaying, setAnimPlaying] = useState(true)
  const [hintVisible, setHintVisible] = useState(true)

  const maxDpr = profile.constrained ? 1.5 : 2
  const [dpr, setDpr] = useState(Math.min(window.devicePixelRatio || 1, maxDpr))

  // throttle download progress to one React update per frame
  const onProgress = useCallback((p) => {
    latest.current = { ...latest.current, ...p }
    if (raf.current) return
    raf.current = requestAnimationFrame(() => {
      raf.current = 0
      setProgress((prev) => ({ ...prev, ...latest.current }))
    })
  }, [])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  // stop rendering while off-screen
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.02 })
    io.observe(wrap.current)
    return () => io.disconnect()
  }, [])

  // "engaged" = the visitor clicked/tapped into the scene (zoom / one-finger drag are enabled)
  useEffect(() => {
    const down = (e) => {
      if (wrap.current?.contains(e.target) && !e.target.closest('.apt-ui')) setEngaged(true)
      else if (!wrap.current?.contains(e.target) && !immersive) setEngaged(false)
    }
    const esc = (e) => e.key === 'Escape' && !document.fullscreenElement && (setImmersive(false), setEngaged(false))
    document.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      window.removeEventListener('keydown', esc)
    }
  }, [immersive])

  // immersive mode: native fullscreen when available, otherwise a CSS full-viewport fallback
  const toggleImmersive = useCallback(async () => {
    const el = wrap.current
    if (!immersive) {
      setImmersive(true)
      setEngaged(true)
      document.documentElement.classList.add('apt-noscroll')
      try { await el.requestFullscreen?.({ navigationUI: 'hide' }) } catch { /* CSS fallback is already active */ }
    } else {
      setImmersive(false)
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    }
  }, [immersive])
  useEffect(() => {
    if (!immersive) document.documentElement.classList.remove('apt-noscroll')
    return () => document.documentElement.classList.remove('apt-noscroll')
  }, [immersive])
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setImmersive(false) }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const retry = () => {
    failed.current = false
    setError(null); setStage('download'); setProgress({ loaded: 0, total: 0, ratio: 0 }); latest.current = {}
    setAttempt((n) => n + 1)
  }
  const fail = useCallback((e) => {
    if (failed.current) return // keep the *first* (root-cause) error
    failed.current = true
    console.error('[Apartment] load failed', e)
    setError(e)
    setStage('error')
  }, [])

  const ready = stage === 'ready'
  // model dimensions in world units (stable reference so CameraRig's memoised pose isn't recomputed every render)
  const worldSize = useMemo(
    () => (size ? size.clone().multiplyScalar(WORLD_SIZE / Math.max(size.x, size.y, size.z)) : null),
    [size],
  )
  return (
    <div
      ref={wrap}
      className={`apt-viewer${immersive ? ' is-immersive' : ''}${ready ? ' is-ready' : ''}`}
      tabIndex={0}
      role="application"
      aria-label={`Interactive 3D model: ${CREDIT.title}. Use arrow keys to move, mouse or touch to orbit and zoom.`}
    >
      {stage !== 'error' && (
        <Canvas
          key={attempt}
          className="apt-canvas"
          frameloop={visible ? 'always' : 'never'}
          dpr={dpr}
          performance={{ min: profile.constrained ? 0.55 : 0.75 }}
          camera={{ fov: 38, near: 0.03, far: 400, position: [8, 8, 10] }}
          gl={{
            antialias: !(profile.constrained && (window.devicePixelRatio || 1) >= 2),
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping
            gl.toneMappingExposure = 1
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault()
              fail(new Error('WebGL context lost (out of GPU memory)'))
            })
          }}
        >
          <PerformanceMonitor
            flipflops={3}
            onChange={({ factor }) => setDpr(Math.round(THREE.MathUtils.lerp(1, maxDpr, factor) * 4) / 4)}
          />
          <AdaptiveDpr />
          <Lights />
          <Suspense fallback={null}>
            <ApartmentModel
              url={url}
              paused={!animPlaying}
              reducedMotion={profile.prefersReducedMotion}
              onProgress={onProgress}
              onStage={setStage}
              onReady={({ size: s }) => { setSize(s); setStage('ready') }}
              onError={fail}
            />
          </Suspense>
          <CameraRig
            size={worldSize}
            ready={ready}
            engaged={engaged || immersive}
            isTouch={profile.isTouch}
            autoRotate={autoRotate}
            reducedMotion={profile.prefersReducedMotion}
            apiRef={api}
            onInteract={() => setHintVisible(false)}
          />
        </Canvas>
      )}

      {(stage === 'download' || stage === 'gpu') && (
        <LoadingOverlay stage={stage} progress={progress} expectedMB={expectedMB} onCancel={onClose} />
      )}
      {stage === 'error' && <ErrorOverlay error={error} onRetry={retry} onClose={onClose} />}

      {ready && (
        <>
          <div className="apt-ui apt-top">
            <div className="apt-title">
              <span className="apt-eyebrow">Interactive 3D</span>
              <strong>{CREDIT.title}</strong>
            </div>
            {!immersive && <CloseButton onClick={onClose} />}
          </div>

          <Hint isTouch={profile.isTouch} engaged={engaged || immersive} visible={hintVisible} />

          <div className="apt-ui apt-toolbar" role="toolbar" aria-label="3D viewer controls">
            <button type="button" className="apt-iconbtn" onClick={() => api.current?.reset()} title="Reset view" aria-label="Reset view">
              <IconReset />
            </button>
            <button
              type="button" className={`apt-iconbtn${autoRotate ? ' is-on' : ''}`} onClick={() => setAutoRotate((v) => !v)}
              title="Auto-rotate when idle" aria-label="Auto-rotate when idle" aria-pressed={autoRotate}
            >
              <IconRotate />
            </button>
            <button
              type="button" className="apt-iconbtn" onClick={() => setAnimPlaying((v) => !v)}
              title={animPlaying ? 'Pause animation' : 'Play animation'} aria-label={animPlaying ? 'Pause animation' : 'Play animation'}
            >
              {animPlaying ? <IconPause /> : <IconPlay />}
            </button>
            <button type="button" className="apt-iconbtn" onClick={toggleImmersive} title={immersive ? 'Exit full screen' : 'Full screen'} aria-label={immersive ? 'Exit full screen' : 'Full screen'}>
              {immersive ? <IconCollapse /> : <IconExpand />}
            </button>
          </div>
          <div className="apt-ui apt-creditwrap"><Credit /></div>
        </>
      )}
    </div>
  )
}
