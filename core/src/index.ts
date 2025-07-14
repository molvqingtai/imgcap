export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'

export interface Options {
  targetSize: number
  toleranceSize?: number
  outputType?: ImageType
}

const compress = async (
  imageBitmap: ImageBitmap,
  targetSize: number,
  low: number,
  high: number,
  toleranceSize: number,
  outputType: ImageType
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

  // Check if current size is within tolerance range
  const lowerBound = targetSize + Math.min(0, toleranceSize)
  const upperBound = targetSize + Math.max(0, toleranceSize)

  if (currentSize >= lowerBound && currentSize <= upperBound) {
    return outputBlob
  }

  // Use relative error
  if ((high - low) / high < 0.001) {
    return outputBlob
  }

  if (currentSize > targetSize) {
    return await compress(imageBitmap, targetSize, low, mid, toleranceSize, outputType)
  } else {
    return await compress(imageBitmap, targetSize, mid, high, toleranceSize, outputType)
  }
}

export const imgCap = async (input: Blob, options: Options) => {
  const { targetSize, toleranceSize = -1024 } = options

  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(input.type)) {
    throw new Error('Only PNG, JPEG, WebP and AVIF images are supported.')
  }

  if (Math.abs(toleranceSize) < 1024) {
    throw new Error('Tolerance size must be at least ±1024 bytes.')
  }

  const outputType = options.outputType || (input.type as ImageType)

  if (input.size <= targetSize && input.type === outputType) {
    return input
  }

  const imageBitmap = await createImageBitmap(input)

  // Initialize quality range
  const low = 0
  const high = 1

  return await compress(imageBitmap, targetSize, low, high, toleranceSize, outputType)
}

export default imgCap
