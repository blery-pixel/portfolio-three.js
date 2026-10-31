// Central configuration for the Lovecraft's Apartment viewer.
// Everything that depends on your hosting / asset layout lives here.

const env = import.meta.env

/** Desktop model. Absolute CDN URL, or a path served from /public. */
export const MODEL_URL =
  (import.meta.env.DEV && new URLSearchParams(window.location.search).get('model')) ||
  env.VITE_APARTMENT_MODEL_URL ||
  '/models/lovecrafts_apartment.glb'

/** Optional lighter GLB (e.g. 2K KTX2) served to touch devices. Empty = use MODEL_URL. */
export const MOBILE_MODEL_URL = env.VITE_APARTMENT_MODEL_URL_MOBILE || ''

/** Load the model automatically as soon as the section is visible (only sensible once optimised). */
export const AUTO_LOAD = env.VITE_APARTMENT_AUTOLOAD === 'true'

/** Approximate size shown before the HEAD request answers. */
export const FALLBACK_SIZE_MB = Number(env.VITE_APARTMENT_MODEL_SIZE_MB) || 474

/** Decoder locations (copied from three/examples/jsm/libs into /public). */
export const DRACO_PATH = `${import.meta.env.BASE_URL}draco/gltf/`
export const BASIS_PATH = `${import.meta.env.BASE_URL}basis/`

export const CREDIT = {
  title: "Lovecraft's Apartment",
  author: 'Gnossiennes',
  authorUrl: 'https://sketchfab.com/Gnossiennes',
  sourceUrl: 'https://sketchfab.com/3d-models/lovecrafts-apartment-e2e1da547a814dfb946e26b64ab98e65',
  license: 'CC BY 4.0',
  licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
}

/** The scene is normalised so its largest side equals this many world units. */
export const WORLD_SIZE = 10

/** Initial camera pose (degrees). Azimuth 0 = looking from +Z, positive turns towards +X. */
export const HOME_VIEW = { azimuth: 35, polar: 62, fov: 38, fit: 0.92 }
