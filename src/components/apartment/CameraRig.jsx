import { useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { HOME_VIEW, WORLD_SIZE } from './config'

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) // easeInOutCubic
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))
const IDLE_MS = 5000

/**
 * Camera behaviour: cinematic fly-in, damped orbit/zoom/pan, bounded target, idle auto-rotation,
 * animated "reset view", scroll-trap protection (see `engaged`), keyboard support.
 */
export default function CameraRig({ size, ready, engaged, isTouch, autoRotate, reducedMotion, apiRef, onInteract }) {
  const controls = useRef()
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const viewport = useThree((s) => s.size)
  const tween = useRef(null)
  const idleTimer = useRef(0)
  const interacted = useRef(false)

  // radius of the model's bounding sphere (world units, model is normalised to WORLD_SIZE)
  const dims = useMemo(() => size ?? new THREE.Vector3(WORLD_SIZE, WORLD_SIZE * 0.4, WORLD_SIZE), [size])
  const radius = useMemo(() => dims.length() / 2, [dims])

  /** Home pose, recomputed for the current aspect ratio so the whole apartment always fits. */
  const home = useMemo(() => {
    const aspect = viewport.width / Math.max(1, viewport.height)
    const vfov = THREE.MathUtils.degToRad(HOME_VIEW.fov)
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect)
    const dist = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * HOME_VIEW.fit * 0.78
    return {
      target: new THREE.Vector3(0, -dims.y * 0.04, 0),
      sph: new THREE.Spherical(
        dist,
        THREE.MathUtils.degToRad(HOME_VIEW.polar),
        THREE.MathUtils.degToRad(HOME_VIEW.azimuth),
      ),
    }
  }, [viewport.width, viewport.height, radius, dims])

  const fly = (to, duration, from) => {
    const c = controls.current
    if (!c) return
    const fromTarget = (from?.target ?? c.target).clone()
    const fromSph = from?.sph ?? new THREE.Spherical().setFromVector3(camera.position.clone().sub(c.target))
    if (reducedMotion) duration = 0
    tween.current = { fromTarget, fromSph: fromSph.clone(), to, t: 0, duration }
    if (duration === 0) applyTween(1)
  }

  const applyTween = (k) => {
    const c = controls.current
    const tw = tween.current
    if (!c || !tw) return
    const e = ease(k)
    c.target.lerpVectors(tw.fromTarget, tw.to.target, e)
    const s = new THREE.Spherical(
      THREE.MathUtils.lerp(tw.fromSph.radius, tw.to.sph.radius, e),
      THREE.MathUtils.lerp(tw.fromSph.phi, tw.to.sph.phi, e),
      tw.fromSph.theta + wrapAngle(tw.to.sph.theta - tw.fromSph.theta) * e,
    )
    camera.position.setFromSpherical(s).add(c.target)
    c.update()
    if (k >= 1) tween.current = null
  }

  useImperativeHandle(apiRef, () => ({ reset: () => fly(home, 1.4) }), [home]) // eslint-disable-line

  // cinematic intro: start far away and swing in
  useEffect(() => {
    if (!ready || !controls.current) return
    const start = new THREE.Spherical(home.sph.radius * 1.9, THREE.MathUtils.degToRad(40), home.sph.theta - 0.9)
    const c = controls.current
    c.target.copy(home.target)
    camera.position.setFromSpherical(start).add(c.target)
    c.update()
    fly(home, 3.2, { target: home.target, sph: start })
  }, [ready]) // eslint-disable-line

  // keep the camera sensible before the model is ready
  useEffect(() => {
    if (ready) return
    camera.position.setFromSpherical(home.sph).add(home.target)
    camera.lookAt(home.target)
  }, [ready, home, camera])

  // bounds + limits that depend on the model size
  useEffect(() => {
    const c = controls.current
    if (!c) return
    c.minDistance = radius * 0.12
    c.maxDistance = radius * 4
    c.maxPolarAngle = Math.PI * 0.8
    c.minPolarAngle = 0.04
    c.listenToKeyEvents?.(gl.domElement)
    return () => c.stopListenToKeyEvents?.()
  }, [radius, gl])

  // scroll / touch trap protection: the page keeps scrolling until the visitor engages with the scene
  useEffect(() => {
    const c = controls.current
    if (!c) return
    c.enableZoom = engaged
    c.enabled = isTouch ? engaged : true
    gl.domElement.style.touchAction = engaged || !isTouch ? 'none' : 'pan-y'
  }, [engaged, isTouch, gl])

  // user interaction: cancel tweens, pause idle rotation, dismiss hints
  useEffect(() => {
    const c = controls.current
    if (!c) return
    const onStart = () => {
      tween.current = null
      c.autoRotate = false
      clearTimeout(idleTimer.current)
      if (!interacted.current) {
        interacted.current = true
        onInteract?.()
      }
    }
    const onEnd = () => {
      clearTimeout(idleTimer.current)
      if (autoRotate && !reducedMotion) idleTimer.current = setTimeout(() => (c.autoRotate = true), IDLE_MS)
    }
    c.addEventListener('start', onStart)
    c.addEventListener('end', onEnd)
    const onDbl = () => fly(home, 1.4)
    gl.domElement.addEventListener('dblclick', onDbl)
    return () => {
      c.removeEventListener('start', onStart)
      c.removeEventListener('end', onEnd)
      gl.domElement.removeEventListener('dblclick', onDbl)
      clearTimeout(idleTimer.current)
    }
  }, [autoRotate, reducedMotion, home, gl]) // eslint-disable-line

  useEffect(() => {
    const c = controls.current
    if (!c) return
    clearTimeout(idleTimer.current)
    c.autoRotate = false
    if (autoRotate && ready && !reducedMotion) idleTimer.current = setTimeout(() => (c.autoRotate = true), tween.current ? 3500 : 800)
  }, [autoRotate, ready, reducedMotion])

  const bound = useMemo(() => dims.clone().multiplyScalar(0.55), [dims])
  useFrame((_, dt) => {
    const c = controls.current
    if (!c) return
    if (tween.current) {
      const tw = tween.current
      tw.t += Math.min(dt, 0.05) / tw.duration
      applyTween(Math.min(tw.t, 1))
    }
    // keep the orbit target inside (a slightly inflated) model box so visitors can't get lost
    c.target.x = THREE.MathUtils.clamp(c.target.x, -bound.x, bound.x)
    c.target.y = THREE.MathUtils.clamp(c.target.y, -bound.y, bound.y)
    c.target.z = THREE.MathUtils.clamp(c.target.z, -bound.z, bound.z)
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      rotateSpeed={isTouch ? 0.7 : 0.6}
      zoomSpeed={0.8}
      panSpeed={0.7}
      zoomToCursor
      screenSpacePanning
      autoRotateSpeed={0.45}
      keyPanSpeed={14}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
    />
  )
}
