import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { BASIS_PATH, DRACO_PATH } from './config'

// Module-level cache: survives React StrictMode double-mounts and remounts,
// so a 400+ MB file is never downloaded twice.
const cache = new Map()

/**
 * Downloads + parses the GLB.
 * Supports plain GLBs as well as Draco / Meshopt / KTX2 (Basis) compressed ones,
 * so the optimised file can be dropped in with no code change.
 */
export function loadApartment(url, gl, onProgress) {
  if (cache.has(url)) {
    const entry = cache.get(url)
    entry.listeners.add(onProgress)
    return entry.promise
  }

  const listeners = new Set([onProgress])
  const emit = (p) => listeners.forEach((fn) => fn?.(p))

  const draco = new DRACOLoader().setDecoderPath(DRACO_PATH)
  const ktx2 = new KTX2Loader().setTranscoderPath(BASIS_PATH).detectSupport(gl)
  const loader = new GLTFLoader()
    .setDRACOLoader(draco)
    .setKTX2Loader(ktx2)
    .setMeshoptDecoder(MeshoptDecoder)

  const promise = new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        draco.dispose()
        ktx2.dispose()
        resolve(gltf)
      },
      (e) => emit({ phase: 'download', loaded: e.loaded, total: e.lengthComputable ? e.total : 0 }),
      (err) => {
        const msg = String(err?.message || err)
        // A static host / SPA dev server answers a missing file with index.html -> JSON parse error
        if (/Unexpected token '<'|is not valid JSON|404|Not Found/i.test(msg)) {
          return reject(new Error(`Model file not found at ${url}`))
        }
        reject(err instanceof Error ? err : new Error(msg))
      },
    )
  })

  // a failed load must be retryable
  promise.catch(() => cache.delete(url))
  cache.set(url, { promise, listeners })
  return promise
}

export function clearApartmentCache(url) {
  cache.delete(url)
}
