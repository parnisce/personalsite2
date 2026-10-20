import { Environment, Lightformer, Sparkles, useTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import logoUrl from '../assets/logo.webp'
import { logoPose, logoState } from './logoPath'
import { createLogoGeometries, LOGO_HEIGHT } from './logoShape'

const DEPTH = 0.22 // thickness of the extruded logo, in world units

// Where each piece starts before the intro assembles them: opposite sides, pushed back in depth.
const ENTRY = {
  white: { pos: [-4.5, 2.4, -3], rot: [0.9, -1.6, 0.7] },
  cyan: { pos: [4.5, -2.4, -3], rot: [-0.9, 1.6, -0.7] },
}

function useLogo() {
  const texture = useTexture(logoUrl, (t) => {
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
  })
  const geometries = useMemo(() => createLogoGeometries(DEPTH), [])
  return { texture, geometries }
}

const lerp = THREE.MathUtils.lerp

function placePiece(obj, entry, remaining) {
  obj.position.set(entry.pos[0] * remaining, entry.pos[1] * remaining, entry.pos[2] * remaining)
  obj.rotation.set(entry.rot[0] * remaining, entry.rot[1] * remaining, entry.rot[2] * remaining)
}

function Logo({ mobile }) {
  const group = useRef()
  const spinner = useRef()
  const white = useRef()
  const cyan = useRef()
  const rings = useRef()
  const ringMats = useRef([])
  const tilt = useRef({ x: 0, y: 0 })
  const {
    texture,
    geometries: [whiteGeo, cyanGeo],
  } = useLogo()
  const { viewport, size } = useThree()

  useFrame((state, delta) => {
    const pose = logoPose(size.width)
    const { reduced, intro, assemble } = logoState
    const time = state.clock.elapsedTime
    const idle = reduced ? 0 : 1

    // Ease the pointer tilt so it never snaps.
    const k = 1 - Math.exp(-delta * 3)
    tilt.current.x = lerp(tilt.current.x, logoState.pointerY * idle, k)
    tilt.current.y = lerp(tilt.current.y, logoState.pointerX * idle, k)

    group.current.position.set(
      (pose.x * viewport.width) / 2,
      (pose.y * viewport.height) / 2 + Math.sin(time * 1.1) * 0.06 * idle,
      pose.travel * 1.6, // swoops toward the camera between sections
    )
    group.current.scale.setScalar(((pose.scale * viewport.height) / LOGO_HEIGHT) * (0.6 + 0.4 * intro))

    spinner.current.rotation.set(
      pose.rx - tilt.current.x * 0.3,
      pose.ry + tilt.current.y * 0.4,
      pose.rz + Math.sin(time * 0.7) * 0.03 * idle,
    )

    // The two pieces fly in from opposite sides and lock together.
    placePiece(white.current, ENTRY.white, 1 - assemble)
    placePiece(cyan.current, ENTRY.cyan, 1 - assemble)

    // Light trails appear once the logo has assembled.
    ringMats.current.forEach((m, i) => (m.opacity = assemble * (i ? 0.45 : 0.7)))
    if (!reduced) {
      rings.current.rotation.z += delta * 0.3
      rings.current.children[1].rotation.z -= delta * 0.5
    }
  })

  return (
    <group ref={group}>
      <group ref={spinner}>
        {/* Front and back faces show the logo artwork; the sides are tinted to match each piece. */}
        <mesh ref={white} geometry={whiteGeo}>
          <meshStandardMaterial
            attach="material-0"
            map={texture}
            emissiveMap={texture}
            emissive="#ffffff"
            emissiveIntensity={0.3}
            roughness={0.35}
          />
          <meshStandardMaterial attach="material-1" color="#b9c4d3" roughness={0.3} metalness={0.2} />
        </mesh>
        <mesh ref={cyan} geometry={cyanGeo}>
          <meshStandardMaterial
            attach="material-0"
            map={texture}
            emissiveMap={texture}
            emissive="#ffffff"
            emissiveIntensity={0.6}
            roughness={0.3}
          />
          <meshStandardMaterial
            attach="material-1"
            color="#00c7d9"
            emissive="#00e5ff"
            emissiveIntensity={0.6}
            roughness={0.3}
            toneMapped={false}
          />
        </mesh>
      </group>
      <group ref={rings} rotation={[1.15, 0.25, 0]}>
        <mesh>
          <torusGeometry args={[2.25, 0.01, 8, 160]} />
          <meshBasicMaterial
            ref={(m) => (ringMats.current[0] = m)}
            color="#00e5ff"
            toneMapped={false}
            transparent
            opacity={0}
          />
        </mesh>
        <mesh rotation={[0.35, 0.2, 0]}>
          <torusGeometry args={[2.55, 0.006, 8, 160, Math.PI * 1.2]} />
          <meshBasicMaterial
            ref={(m) => (ringMats.current[1] = m)}
            color="#00c7d9"
            toneMapped={false}
            transparent
            opacity={0}
          />
        </mesh>
      </group>
      <Sparkles
        count={mobile ? 12 : 28}
        scale={[5, 4, 2]}
        size={2}
        speed={logoState.reduced ? 0 : 0.3}
        opacity={0.7}
        color="#00e5ff"
      />
    </group>
  )
}

// Hands control back to the page (flat fallback logo) if the GPU drops the WebGL context.
function ContextWatcher({ onLost }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const canvas = gl.domElement
    const lost = (e) => {
      e.preventDefault()
      onLost()
    }
    canvas.addEventListener('webglcontextlost', lost)
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [gl, onLost])
  return null
}

export default function LogoScene({ mobile, onContextLost }) {
  return (
    <Canvas
      className="logo-canvas"
      dpr={mobile ? [1, 1.5] : [1, 2]}
      camera={{ position: [0, 0, 10], fov: 35 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}
    >
      <ContextWatcher onLost={onContextLost} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 5]} intensity={1.6} />
      <pointLight position={[-3, -2, 3]} color="#00c7d9" intensity={14} />
      <Environment resolution={mobile ? 64 : 128}>
        <Lightformer form="rect" intensity={3} position={[0, 3, 4]} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={2} color="#00e5ff" position={[-5, 0, 2]} scale={[2, 6, 1]} />
        <Lightformer form="ring" intensity={2} color="#5b8cff" position={[5, -2, 3]} scale={3} />
      </Environment>
      <Suspense fallback={null}>
        <Logo mobile={mobile} />
      </Suspense>
      {/* Bloom is the most expensive pass, so phones skip it. */}
      {!mobile && (
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.8} luminanceThreshold={0.72} luminanceSmoothing={0.2} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
