// Shared handle on the page's smooth scroller (Lenis), so buttons and anchor links can glide
// to a target. Pages without one (the Free Tools page, reduced motion) fall back to the
// browser's own smooth scrolling.
let scroller = null

export const setSmoothScroll = (instance) => {
  scroller = instance
}

// `target` is a pixel offset or an element.
export function scrollToTarget(target) {
  if (scroller) {
    scroller.scrollTo(target, { duration: 1.4, easing: (t) => 1 - (1 - t) ** 4 })
  } else if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior: 'smooth' })
  } else {
    target.scrollIntoView({ behavior: 'smooth' })
  }
}
