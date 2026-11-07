import { imgcap } from './vendor/imgcap.js'

export const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif'
}

export const outputName = (name, type) => {
  const base = name.replace(/\.[^./\\]+$/, '') || 'image'
  return `${base}-min.${EXTENSIONS[type] || 'img'}`
}

/**
 * Compress one image with imgcap. Runs inside a Web Worker;
 * everything here is OffscreenCanvas + createImageBitmap.
 */
export async function compress(file, settings) {
  const targetBytes = Math.max(1024, Math.round(settings.targetBytes))

  if (!SUPPORTED_TYPES.includes(file.type)) {
    throw new Error('Unsupported format — use JPG, PNG, WebP or AVIF.')
  }
  if (!file.size) throw new Error('This file is empty.')

  const outputType = settings.format === 'keep' ? file.type : settings.format
  if (!SUPPORTED_TYPES.includes(outputType)) {
    throw new Error('Unsupported output format.')
  }

  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('This image could not be decoded — it may be larger than the browser can handle.')
  }

  const originalWidth = bitmap.width
  const originalHeight = bitmap.height
  bitmap.close()

  // imgcap returns the file untouched when it already fits and the type matches.
  const blob = await imgcap(file, { targetSize: targetBytes, outputType })

  // A conversion can still come out bigger than an original that already fits
  // (a small PNG to WebP often does); keep the original in that case.
  if (blob !== file && file.size <= targetBytes && blob.size >= file.size) {
    return {
      blob: file,
      type: file.type,
      width: originalWidth,
      height: originalHeight,
      originalWidth,
      originalHeight,
      targetBytes,
      keptOriginal: true
    }
  }

  let width = originalWidth
  let height = originalHeight
  if (blob !== file) {
    const result = await createImageBitmap(blob)
    width = result.width
    height = result.height
    result.close()
  }

  return {
    blob,
    type: blob.type,
    width,
    height,
    originalWidth,
    originalHeight,
    targetBytes,
    keptOriginal: blob === file
  }
}