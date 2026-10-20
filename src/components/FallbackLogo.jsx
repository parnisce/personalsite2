import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import logo from '../assets/logo.webp'
import { logoPose, logoState } from '../three/logoPath'

// Flat version of the travelling logo, used when WebGL is unavailable or its context is lost.
// It follows the same scroll path as the 3D logo, using CSS 3D transforms instead of a scene.
export default function FallbackLogo() {
  const el = useRef(null)

  useEffect(() => {
    const img = el.current
    const tick = () => {
      const vw = document.documentElement.clientWidth
      const vh = window.innerHeight
      const pose = logoPose(vw)
      const height = pose.scale * vh * (0.6 + 0.4 * logoState.intro)
      img.style.height = `${height}px`
      img.style.opacity = logoState.assemble
      img.style.transform =
        `translate(${((pose.x + 1) / 2) * vw}px, ${((1 - pose.y) / 2) * vh}px) translate(-50%, -50%) ` +
        `rotateX(${-pose.rx}rad) rotateY(${pose.ry}rad) rotateZ(${-pose.rz}rad)`
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [])

  return (
    <div className="logo-fallback" aria-hidden="true">
      <img ref={el} src={logo} alt="" />
    </div>
  )
}
