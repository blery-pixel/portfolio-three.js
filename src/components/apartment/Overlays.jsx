import { CREDIT } from './config'
import { IconClose } from './Icons'

const fmtMB = (b) => (b / 1024 / 1024).toFixed(b > 1e8 ? 0 : 1)

export function LoadingOverlay({ stage, progress, expectedMB, onCancel }) {
  let ratio = 0
  let label = 'Opening the door…'
  let detail = ''
  if (stage === 'download') {
    const total = progress.total || (expectedMB ? expectedMB * 1024 * 1024 : 0)
    ratio = total ? Math.min(progress.loaded / total, 1) * 0.8 : 0
    label = 'Downloading the apartment'
    detail = total ? `${fmtMB(progress.loaded)} / ${fmtMB(total)} MB` : progress.loaded ? `${fmtMB(progress.loaded)} MB` : 'Connecting…'
    if (total && progress.loaded >= total) {
      label = 'Decoding textures'
      detail = 'This can take a moment on large files'
    }
  } else if (stage === 'gpu') {
    ratio = 0.8 + (progress.ratio || 0) * 0.2
    label = 'Preparing materials'
    detail = 'Uploading textures to the GPU'
  }
  const pct = Math.round(ratio * 100)
  return (
    <div className="apt-overlay apt-loading" role="status" aria-live="polite">
      <div className="apt-loading__card">
        <div className="apt-loading__pct" aria-hidden="true">
          {stage === 'download' && !ratio ? <span className="apt-spinner" /> : <>{pct}<small>%</small></>}
        </div>
        <p className="apt-loading__label">{label}</p>
        <div className="apt-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <i style={{ transform: `scaleX(${Math.max(ratio, 0.02)})` }} />
        </div>
        <p className="apt-loading__detail">{detail}</p>
        <button type="button" className="apt-link" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export function ErrorOverlay({ error, onRetry, onClose }) {
  const msg = error?.message || String(error || '')
  const missing = /not found/i.test(msg)
  const oom = !missing && /memory|alloc|array buffer|context lost/i.test(msg)
  return (
    <div className="apt-overlay apt-error" role="alert">
      <div className="apt-error__card">
        <h3>The apartment couldn’t be opened</h3>
        <p>
          {missing
            ? 'The 3D model file is missing on the server. Place lovecrafts_apartment.glb in public/models/ (or set VITE_APARTMENT_MODEL_URL).'
            : oom
              ? 'Your device ran out of memory while loading this very large scene. Try a desktop browser, or use the lighter version of the model.'
              : 'The 3D scene failed to load. Check your connection and try again.'}
        </p>
        {msg && <code className="apt-error__code">{msg.slice(0, 160)}</code>}
        <div className="apt-error__actions">
          <button type="button" className="apt-btn apt-btn--primary" onClick={onRetry}>Try again</button>
          <button type="button" className="apt-btn" onClick={onClose}>Back</button>
          <a className="apt-btn" href={CREDIT.sourceUrl} target="_blank" rel="noreferrer noopener">View on Sketchfab ↗</a>
        </div>
      </div>
    </div>
  )
}

export function Hint({ isTouch, engaged, visible }) {
  if (!visible) return null
  return (
    <div className="apt-hint" aria-hidden="true">
      {isTouch ? (
        engaged ? <span>Drag to look around · Pinch to zoom · Two fingers to pan</span> : <span>Tap the scene to explore</span>
      ) : engaged ? (
        <span>Drag to orbit · Scroll to zoom · Right-drag to pan · Double-click to reset</span>
      ) : (
        <span>Click the scene to enable zoom</span>
      )}
    </div>
  )
}

export function Credit() {
  return (
    <p className="apt-credit">
      <a href={CREDIT.sourceUrl} target="_blank" rel="noreferrer noopener">“{CREDIT.title}”</a> by{' '}
      <a href={CREDIT.authorUrl} target="_blank" rel="noreferrer noopener">{CREDIT.author}</a> ·{' '}
      <a href={CREDIT.licenseUrl} target="_blank" rel="noreferrer noopener">{CREDIT.license}</a>
    </p>
  )
}

export function CloseButton({ onClick }) {
  return (
    <button type="button" className="apt-iconbtn apt-close" onClick={onClick} aria-label="Close 3D viewer" title="Close">
      <IconClose />
    </button>
  )
}
