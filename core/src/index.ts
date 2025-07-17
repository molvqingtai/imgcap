/** Supported image formats */
export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'

/** Compression options */
export interface Options {
  /** Target file size in bytes (result will approximate this value) */
  targetSize: number
  /** Output image format (default: same as input) */
  outputType?: ImageType
}

const compress = async (
  imageBitmap: ImageBitmap,
  targetSize: number,
  low: number,
  high: number,
  outputType: ImageType,
  bestBlob?: Blob
): Promise<Blob> => {
  // Calculate the middle quality value
  const mid = (low + high) / 2

  // Calculate the width and height after scaling
  const width = Math.round(imageBitmap.width * mid)
  const height = Math.round(imageBitmap.height * mid)

  const offscreenCanvas = new OffscreenCanvas(width, height)
  const offscreenContext = offscreenCanvas.getContext('2d')!

  // Draw the scaled image
  offscreenContext.drawImage(imageBitmap, 0, 0, imageBitmap.width, imageBitmap.height, 0, 0, width, height)

  const outputBlob = await offscreenCanvas.convertToBlob({ type: outputType, quality: mid })

  const currentSize = outputBlob.size

  // Update best result - track the closest to target size
  if (!bestBlob || Math.abs(currentSize - targetSize) < Math.abs(bestBlob.size - targetSize)) {
    bestBlob = outputBlob
  }

  // Precision limit reached - return best result
  if ((high - low) / high < 0.01) {
    return bestBlob
  }

  // Check if we hit the target exactly or very close
  // Dynamic tolerance: 1KB or 1% of target size (whichever is larger), capped at 1MB
  // - Small files (<100KB): 1KB tolerance for high precision
  // - Medium files (100KB-100MB): 1% tolerance for reasonable flexibility
  // - Large files (>100MB): 1MB tolerance to avoid excessive iterations
  const tolerance = Math.min(Math.max(1024, targetSize * 0.01), 1024 * 1024)
  if (Math.abs(currentSize - targetSize) <= tolerance) {
    // Return the result that's closest to target size
    return bestBlob
  }

  if (currentSize > targetSize) {
    return await compress(imageBitmap, targetSize, low, mid, outputType, bestBlob)
  } else {
    return await compress(imageBitmap, targetSize, mid, high, outputType, bestBlob)
  }
}

/**
 * Compress an image to approximate target file size using binary search algorithm.
 *
 * The actual output size will be close to the target size within a smart tolerance range:
 * - Small files (<100KB): ±1KB tolerance
 * - Medium files (100KB-100MB): ±1% tolerance
 * - Large files (>100MB): ±1MB tolerance
 *
 * @param input - Image blob/file to compress
 * @param options - Compression options with targetSize as approximate target
 * @returns Promise that resolves to compressed image blob
 *
 * @example
 * ```typescript
 * // Basic usage - compress to approximately 500KB
 * const compressed = await imgcap(imageFile, { targetSize: 500 * 1024 })
 * // Result: ~495-505KB depending on image characteristics
 *
 * // With format conversion
 * const webp = await imgcap(imageFile, {
 *   targetSize: 300 * 1024,
 *   outputType: 'image/webp'
 * })
 * // Result: ~297-303KB in WebP format
 * ```
 */
export const imgcap = async (input: Blob, options: Options) => {
  const { targetSize } = options

  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(input.type)) {
    throw new Error('Only PNG, JPEG, WebP and AVIF images are supported.')
  }

  if (targetSize < 1024) {
    throw new Error('Target size must be at least 1KB (1024 bytes).')
  }

  const outputType = options.outputType || (input.type as ImageType)

  if (input.size <= targetSize && input.type === outputType) {
    return input
  }

  const imageBitmap = await createImageBitmap(input)

  // Initialize quality range
  const low = 0
  const high = 1

  return await compress(imageBitmap, targetSize, low, high, outputType)
}

export default imgcap
