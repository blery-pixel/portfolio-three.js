import { Environment, Lightformer } from '@react-three/drei'

/**
 * The GLB ships with no lights (KHR_lights_punctual is absent), so the original look comes entirely
 * from its PBR materials. We give them a neutral, *procedural* studio environment (no HDR download,
 * no third-party CDN) plus a soft key light, so colours stay faithful instead of being tinted.
 */
export default function Lights() {
  return (
    <>
      <hemisphereLight args={['#dfe6ea', '#2a2622', 0.55]} />
      <directionalLight position={[6, 10, 5]} intensity={1.4} color="#fff2dd" />
      <directionalLight position={[-8, 4, -6]} intensity={0.35} color="#9fb8c8" />
      <Environment resolution={256} frames={1} environmentIntensity={0.85}>
        <Lightformer form="rect" intensity={2.2} color="#fff4e2" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[14, 14, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[-8, 3, 4]} rotation-y={Math.PI / 2.4} scale={[10, 5, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#b9d0e0" position={[8, 2, -4]} rotation-y={-Math.PI / 2.4} scale={[10, 5, 1]} />
        <Lightformer form="ring" intensity={0.6} color="#ffd9a8" position={[0, 2, -9]} scale={6} />
      </Environment>
    </>
  )
}
