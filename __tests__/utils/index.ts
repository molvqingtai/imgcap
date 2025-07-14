import { type ImageType } from 'imgcap'

// Helper function to create a test image blob
export const createTestImageBlob = async (width: number = 100, height: number = 100, type: ImageType = 'image/png') => {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  // Draw a simple pattern
  ctx.fillStyle = '#ff0000'
  ctx.fillRect(0, 0, width / 2, height / 2)
  ctx.fillStyle = '#00ff00'
  ctx.fillRect(width / 2, 0, width / 2, height / 2)
  ctx.fillStyle = '#0000ff'
  ctx.fillRect(0, height / 2, width / 2, height / 2)
  ctx.fillStyle = '#ffff00'
  ctx.fillRect(width / 2, height / 2, width / 2, height / 2)

  return await canvas.convertToBlob({ type })
}
