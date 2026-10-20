import * as THREE from 'three'

// Outlines of the two pieces of src/assets/logo.webp, in image pixels (traced from its alpha).
// If the logo artwork changes, re-trace these so the 3D outline still matches the picture.
const IMAGE = { width: 1312, height: 1199 }
const WHITE = [
  [514, 89], [748, 90], [896, 248], [595, 510], [479, 399], [399, 502],
  [563, 667], [728, 669], [513, 846], [336, 846], [32, 511],
]
const CYAN = [
  [808, 365], [992, 365], [1297, 675], [801, 1123], [568, 1123],
  [410, 961], [618, 807], [895, 790], [634, 516],
]

// Centre of the traced artwork, and the scale that makes it LOGO_HEIGHT world units tall.
export const LOGO_HEIGHT = 2.6
const CX = (32 + 1297) / 2
const CY = (89 + 1123) / 2
const PX_PER_UNIT = (1123 - 89) / LOGO_HEIGHT

const toShape = (outline) =>
  new THREE.Shape(outline.map(([px, py]) => new THREE.Vector2((px - CX) / PX_PER_UNIT, -(py - CY) / PX_PER_UNIT)))

// Maps the front and back faces back onto the logo image, so the artwork shows exactly as drawn.
const uvGenerator = {
  generateTopUV(_geo, v, a, b, c) {
    return [a, b, c].map(
      (i) =>
        new THREE.Vector2(
          (v[i * 3] * PX_PER_UNIT + CX) / IMAGE.width,
          1 - (CY - v[i * 3 + 1] * PX_PER_UNIT) / IMAGE.height,
        ),
    )
  },
  generateSideWallUV() {
    return [new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2(), new THREE.Vector2()]
  },
}

export function createLogoGeometries(depth) {
  return [WHITE, CYAN].map((outline) => {
    const geo = new THREE.ExtrudeGeometry(toShape(outline), { depth, bevelEnabled: false, UVGenerator: uvGenerator })
    geo.translate(0, 0, -depth / 2)
    return geo
  })
}
