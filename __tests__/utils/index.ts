import { type ImageType } from 'imgcap'

// Helper function to create a test image blob
export const createTestImageBlob = async (width: number = 100, height: number = 100, type: ImageType = 'image/png') => {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!

  // Fill with white background first
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  // Create colorful quadrant pattern for better compression testing
  const halfWidth = width / 2
  const halfHeight = height / 2

  // Top-left: Red
  ctx.fillStyle = '#ff0000'
  ctx.fillRect(0, 0, halfWidth, halfHeight)

  // Top-right: Green
  ctx.fillStyle = '#00ff00'
  ctx.fillRect(halfWidth, 0, halfWidth, halfHeight)

  // Bottom-left: Blue
  ctx.fillStyle = '#0000ff'
  ctx.fillRect(0, halfHeight, halfWidth, halfHeight)

  // Bottom-right: Yellow
  ctx.fillStyle = '#ffff00'
  ctx.fillRect(halfWidth, halfHeight, halfWidth, halfHeight)

  return await canvas.convertToBlob({ type })
}
