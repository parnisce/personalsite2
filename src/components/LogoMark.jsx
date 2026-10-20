import logo from '../assets/logo.webp'

// Flat logo for the header and footer (the same artwork the 3D logo is built from).
export default function LogoMark({ size = 34 }) {
  return <img src={logo} width={size} height={size} alt="" style={{ objectFit: 'contain' }} />
}
