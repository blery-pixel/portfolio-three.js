# Portfolio — Lovecraft's Apartment 3D viewer

React + Vite + Three.js (`@react-three/fiber`, `@react-three/drei`).

## Run

```bash
npm install
# put the model here (it is git-ignored: 474 MB is above GitHub's 100 MB file limit)
cp /path/to/lovecrafts_apartment.glb public/models/lovecrafts_apartment.glb
npm run dev          # http://localhost:5173
npm run build && npm run preview
```

## Add it to an existing site

Copy `src/components/apartment/` and `public/draco/`, `public/basis/` into your project, then:

```bash
npm i three @react-three/fiber @react-three/drei
```
```jsx
import ApartmentSection from './components/apartment/ApartmentSection'
// anywhere in your page:
<ApartmentSection />
```
Theme with CSS variables on `.apt-section` (`--apt-bg`, `--apt-accent`, `--apt-text`, `--apt-radius`, `--apt-font`).

## Configuration (`.env`, see `.env.example`)

| Variable | Purpose |
|---|---|
| `VITE_APARTMENT_MODEL_URL` | Model URL (CDN URL or `/models/...`). |
| `VITE_APARTMENT_MODEL_URL_MOBILE` | Optional lighter GLB served to touch devices. |
| `VITE_APARTMENT_AUTOLOAD=true` | Start loading when the section scrolls into view (use only with the optimised file). |
| `VITE_APARTMENT_MODEL_SIZE_MB` | Size shown before the HEAD request answers. |

## Loading strategy

1. Nothing 3D is in the main bundle (`index-*.js` ≈ 230 kB). three/r3f/drei live in the lazy `ApartmentViewer` chunk.
2. The chunk is prefetched at idle when the section nears the viewport; the model is fetched only after "Enter the apartment" (or on scroll with `AUTOLOAD`).
3. Phones / low-memory / Save-Data devices get a confirmation before a very large download.
4. Textures are uploaded to the GPU in time-boxed slices behind a progress bar, then CPU copies are released.

## The model is very large — optimise before shipping

The original GLB: 474 MB, 82 textures (18 × 4096², 40 × 2048², PNG), 453 k triangles, ~2.6 GB of GPU memory once decoded.
That is fine for a fast desktop with a good GPU; it will crash most phones and integrated GPUs, and it is slow over the network.
Nothing is removed or re-styled by the viewer. To shrink the file **without dropping any texture or material**:

```bash
# needs Node 18+, toktx (https://github.com/KhronosGroup/KTX-Software/releases), ~8 GB free RAM
npm run optimize:model                 # -> public/models/lovecrafts_apartment.opt.glb
MOBILE=1 npm run optimize:model        # also builds a 2048px .mobile.glb for phones
```
It converts textures to KTX2/Basis (ETC1S for colour, UASTC for normal/ORM/occlusion), compresses geometry with Meshopt,
and keeps every mesh, material and the animation. KTX2 also keeps textures compressed in VRAM (≈4-6× less).
The viewer already decodes KTX2, Meshopt and Draco, so just point `VITE_APARTMENT_MODEL_URL` at the new file.
Inspect the result against the original before publishing; raise `--quality` / use UASTC for everything if you see banding.

Host the GLB on a CDN (Cloudflare R2, S3, Bunny…) with gzip/brotli off for `.glb` and `Accept-Ranges` on, and CORS if cross-origin.

## Credit

"Lovecraft's Apartment" by [Gnossiennes](https://sketchfab.com/Gnossiennes), CC BY 4.0 — attribution is shown in the viewer.
