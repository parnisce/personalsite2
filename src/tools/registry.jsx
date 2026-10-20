import { lazy } from 'react'
import { EFFECTS } from './effects'

// Each tool group is its own chunk, so a visitor only downloads the code (and the heavy PDF /
// HEIC / TIFF libraries inside it) for the tool they open.
const group = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })))

const ImageEffect = lazy(() => import('./ImageEffect'))
const Converter = lazy(() => import('./Converter'))

const SPECIAL = {
  'image-resizer': group(() => import('./ImageTools'), 'ImageResizer'),
  'image-cropper': group(() => import('./ImageTools'), 'ImageCropper'),
  'image-compressor': group(() => import('./ImageTools'), 'ImageCompressor'),
  'social-media-image-resizer': group(() => import('./ImageTools'), 'SocialResizer'),
  'favicon-generator': group(() => import('./ImageTools'), 'FaviconGenerator'),
  'background-remover': group(() => import('./ImageTools'), 'BackgroundRemover'),

  'image-to-pdf': group(() => import('./PdfTools'), 'ImagesToPdf'),
  'jpg-to-pdf': group(() => import('./PdfTools'), 'JpgToPdf'),
  'png-to-pdf': group(() => import('./PdfTools'), 'PngToPdf'),
  'merge-pdf-files': group(() => import('./PdfTools'), 'MergePdf'),
  'pdf-splitter': group(() => import('./PdfTools'), 'PdfSplitter'),
  'pdf-page-remover': group(() => import('./PdfTools'), 'PdfPageRemover'),
  'rotate-pdf-pages': group(() => import('./PdfTools'), 'RotatePdfPages'),
  'pdf-to-image': group(() => import('./PdfTools'), 'PdfToImage'),
  'markdown-to-pdf': group(() => import('./PdfTools'), 'MarkdownToPdf'),
  'html-to-pdf': group(() => import('./PdfTools'), 'HtmlToPdf'),

  'color-picker-from-image': group(() => import('./ColourTools'), 'ColourPickerFromImage'),
  'color-palette-extractor': group(() => import('./ColourTools'), 'ColourPaletteExtractor'),
  'color-palette-generator': group(() => import('./ColourTools'), 'ColourPaletteGenerator'),
  'css-gradient-generator': group(() => import('./ColourTools'), 'CssGradientGenerator'),
  'color-contrast-checker': group(() => import('./ColourTools'), 'ColourContrastChecker'),
  'hex-to-rgb-converter': group(() => import('./ColourTools'), 'HexToRgb'),
  'rgb-to-hex-converter': group(() => import('./ColourTools'), 'RgbToHex'),

  'video-transcriber': group(() => import('./TranscribeTools'), 'VideoTranscriber'),
  'subtitle-generator': group(() => import('./TranscribeTools'), 'SubtitleGenerator'),
  'audio-transcriber': group(() => import('./TranscribeTools'), 'AudioTranscriber'),
  'extract-audio': group(() => import('./TranscribeTools'), 'ExtractAudio'),
}

// Returns the screen for a tool (a lazy component and its props), or null if there isn't one.
export function toolScreen(tool) {
  if (EFFECTS[tool.slug]) return { Component: ImageEffect, props: { slug: tool.slug } }
  if (tool.category === 'Converters') return { Component: Converter, props: { slug: tool.slug } }
  const Component = SPECIAL[tool.slug]
  return Component ? { Component, props: {} } : null
}
