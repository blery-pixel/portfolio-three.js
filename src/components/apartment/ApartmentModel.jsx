import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { loadApartment } from './loadApartment'
import { WORLD_SIZE } from './config'

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()))

/** Every texture referenced by any material in the scene. */
function collectTextures(scene) {
  const set = new Set()
  scene.traverse((o) => {
    if (!o.material) return
    for (const m of [].concat(o.material)) {
      for (const k in m) {
        const v = m[k]
        if (v && v.isTexture) set.add(v)
      }
    }
  })
  return set
}

/**
 * Pushes textures to the GPU *before* the first frame, in small time-boxed slices, so the user
 * sees a progress bar instead of a frozen tab, then pre-compiles shaders (async when supported).
 * Nothing is resized, dropped or re-encoded: this only changes *when* the upload happens.
 */
async function warmUp(scene, gl, camera, report, isCancelled) {
  const textures = [...collectTextures(scene)]
  const maxAniso = gl.capabilities.getMaxAnisotropy()
  let done = 0
  let sliceStart = performance.now()
  for (const t of textures) {
    t.anisotropy = Math.min(8, maxAniso) // crisper floors / walls at grazing angles
    gl.initTexture(t)
    done++
    if (performance.now() - sliceStart > 10) {
      report(done / textures.length)
      await nextFrame()
      if (isCancelled()) return
      sliceStart = performance.now()
    }
  }
  report(1)

  // Free the decoded CPU copies (the GPU now owns the pixels). With the raw 4K PNG model this
  // returns ~2 GB of RAM, which is what keeps tabs alive on weaker machines.
  const bitmaps = new Set()
  for (const t of textures) {
    const d = t.source?.data
    if (typeof ImageBitmap !== 'undefined' && d instanceof ImageBitmap) bitmaps.add(d)
  }
  bitmaps.forEach((b) => b.close())

  try {
    await gl.compileAsync(scene, camera)
  } catch {
    /* programs will simply compile on first draw */
  }
}

export default function ApartmentModel({ url, onProgress, onStage, onReady, onError, paused, reducedMotion }) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const [model, setModel] = useState(null)
  const mixer = useRef(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        onStage('download')
        const gltf = await loadApartment(url, gl, onProgress)
        if (cancelled) return

        const scene = gltf.scene
        scene.updateMatrixWorld(true)

        // Skinned meshes are culled with their bind-pose bounds: disable culling so animated parts never pop out.
        scene.traverse((o) => {
          if (o.isSkinnedMesh) o.frustumCulled = false
        })

        // Normalise: centre on the origin and scale so the longest side = WORLD_SIZE.
        const box = new THREE.Box3().setFromObject(scene)
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const scale = WORLD_SIZE / Math.max(size.x, size.y, size.z)

        onStage('gpu')
        await warmUp(scene, gl, camera, (p) => onProgress({ phase: 'gpu', ratio: p }), () => cancelled)
        if (cancelled) return

        if (gltf.animations?.length) {
          const m = new THREE.AnimationMixer(scene)
          gltf.animations.forEach((clip) => m.clipAction(clip).play())
          mixer.current = m
        }

        setModel({ scene, scale, offset: center.multiplyScalar(-scale), size: size.multiplyScalar(scale) })
        onReady({ size: size.clone() })
      } catch (e) {
        if (!cancelled) onError(e)
      }
    })()
    return () => {
      cancelled = true
      mixer.current?.stopAllAction()
      mixer.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, gl])

  useFrame((_, dt) => {
    if (mixer.current && !paused && !reducedMotion) mixer.current.update(Math.min(dt, 0.05))
  })

  if (!model) return null
  return (
    <group scale={model.scale} position={model.offset}>
      <primitive object={model.scene} />
    </group>
  )
}
