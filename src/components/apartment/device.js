// Small, dependency-free device / capability probes.

export function getDeviceProfile() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const memory = navigator.deviceMemory // Chromium only (GB, capped at 8)
  const conn = navigator.connection
  const saveData = !!conn?.saveData
  const slowNet = ['slow-2g', '2g', '3g'].includes(conn?.effectiveType)
  const lowMemory = typeof memory === 'number' && memory <= 4
  return {
    isTouch: coarse,
    lowMemory,
    saveData,
    slowNet,
    // "constrained" devices get a warning before a very large download and a lower pixel ratio cap
    constrained: coarse || lowMemory || saveData || slowNet,
    prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  }
}

export function hasWebGL2() {
  try {
    const c = document.createElement('canvas')
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'))
  } catch {
    return false
  }
}

/**
 * HEAD request to learn whether the model exists and how big it is.
 * Guards against SPA dev-servers answering 200 + index.html for a missing file.
 */
export async function fetchModelInfo(url, signal) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal })
    const type = res.headers.get('content-type') || ''
    if (!res.ok || type.includes('text/html')) return { exists: false, sizeMB: null }
    const len = Number(res.headers.get('content-length'))
    return { exists: true, sizeMB: len ? len / 1024 / 1024 : null }
  } catch (e) {
    if (e?.name === 'AbortError') return { exists: true, sizeMB: null, aborted: true }
    // network / CORS: we can't know, let the real load decide
    return { exists: true, sizeMB: null }
  }
}
