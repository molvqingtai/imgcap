import { describe, it, expect, beforeAll } from 'vitest'
import { createTestImageBlob } from '../utils'
import { imgcap } from 'imgcap'

describe('imgcap', () => {
  let testImageBlob: Blob

  beforeAll(async () => {
    testImageBlob = await createTestImageBlob(200, 200, 'image/png')
  })

  describe('Input Validation', () => {
    it('should throw error for unsupported image type', async () => {
      const invalidBlob = new Blob(['test'], { type: 'text/plain' })

      await expect(imgcap(invalidBlob, { targetSize: 10000 })).rejects.toThrow(
        'Only PNG, JPEG, WebP and AVIF images are supported.'
      )
    })

    it('should throw error for zero target size', async () => {
      await expect(imgcap(testImageBlob, { targetSize: 0 })).rejects.toThrow(
        'Target size must be at least 1KB (1024 bytes).'
      )
    })

    it('should throw error for negative target size', async () => {
      await expect(imgcap(testImageBlob, { targetSize: -1000 })).rejects.toThrow(
        'Target size must be at least 1KB (1024 bytes).'
      )
    })

    it('should throw error for target size less than 1KB', async () => {
      await expect(imgcap(testImageBlob, { targetSize: 512 })).rejects.toThrow(
        'Target size must be at least 1KB (1024 bytes).'
      )
    })

    it('should accept target size of exactly 1KB', async () => {
      await expect(imgcap(testImageBlob, { targetSize: 1024 })).resolves.toBeDefined()
    })
  })

  describe('Basic Functionality', () => {
    it('should return original blob if already smaller than target size', async () => {
      const smallBlob = await createTestImageBlob(10, 10, 'image/png')
      const result = await imgcap(smallBlob, { targetSize: 100000 })

      expect(result).toBe(smallBlob)
      expect(result.size).toBe(smallBlob.size)
    })

    it('should compress image to approximate target size', async () => {
      const targetSize = 5000 // Use 5KB target to force compression
      const result = await imgcap(testImageBlob, { targetSize })

      expect(result).toBeInstanceOf(Blob)
      expect(result.size).toBeLessThanOrEqual(targetSize + 2000) // Allow reasonable tolerance
    })

    it('should produce reasonably sized output', async () => {
      // Test that algorithm produces reasonable results
      const targetSize = 3000 // Use 3KB target 
      const result = await imgcap(testImageBlob, { targetSize })
      
      expect(result).toBeInstanceOf(Blob)
      expect(result.size).toBeLessThanOrEqual(targetSize + 1000) // Allow tolerance
      expect(result.size).toBeGreaterThan(1000) // Should not be too small
    })
  })

  describe('Output Format Control', () => {
    it('should maintain original format when no outputType specified', async () => {
      const jpegBlob = await createTestImageBlob(100, 100, 'image/jpeg')
      const result = await imgcap(jpegBlob, { targetSize: 10000 })

      expect(result.type).toBe('image/jpeg')
    })

    it('should convert to specified output format', async () => {
      const result = await imgcap(testImageBlob, {
        targetSize: 10000,
        outputType: 'image/jpeg'
      })

      expect(result.type).toBe('image/jpeg')
    })

    it('should handle PNG to WebP conversion', async () => {
      const result = await imgcap(testImageBlob, {
        targetSize: 10000,
        outputType: 'image/webp'
      })

      expect(result.type).toBe('image/webp')
    })
  })

  describe('Compression Quality', () => {
    it('should compress large images significantly', async () => {
      const largeBlob = await createTestImageBlob(500, 500, 'image/png')
      const targetSize = 5000
      const result = await imgcap(largeBlob, { targetSize })

      expect(result.size).toBeLessThan(largeBlob.size)
      expect(result.size).toBeLessThanOrEqual(targetSize)
    })

    it('should handle very small target sizes', async () => {
      const targetSize = 2000
      const result = await imgcap(testImageBlob, { targetSize })

      expect(result.size).toBeLessThanOrEqual(targetSize + 1024) // Within 1KB tolerance for small files
      expect(result.size).toBeGreaterThan(500) // Should not be too small
    })

    it('should handle large target sizes gracefully', async () => {
      const largeBlob = await createTestImageBlob(400, 300, 'image/png')
      const targetSize = 50 * 1024 * 1024 // 50MB (unrealistically large for test image)
      const result = await imgcap(largeBlob, { targetSize })

      // Since test image can't be compressed to 50MB, it should return the best possible result
      expect(result).toBeInstanceOf(Blob)
      expect(result.size).toBeLessThanOrEqual(targetSize) // Should not exceed target
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid image data gracefully', async () => {
      const invalidImageBlob = new Blob(['not an image'], { type: 'text/plain' })

      await expect(imgcap(invalidImageBlob, { targetSize: 10000 })).rejects.toThrow()
    })

    it('should handle zero target size', async () => {
      await expect(imgcap(testImageBlob, { targetSize: 0 })).rejects.toThrow()
    })

    it('should handle negative target size', async () => {
      await expect(imgcap(testImageBlob, { targetSize: -1000 })).rejects.toThrow()
    })
  })

  describe('Format Support', () => {
    it('should handle JPEG input', async () => {
      const jpegBlob = await createTestImageBlob(150, 150, 'image/jpeg')
      const result = await imgcap(jpegBlob, { targetSize: 8000 })

      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('image/jpeg')
    })

    it('should handle WebP format', async () => {
      const webpBlob = await createTestImageBlob(150, 150, 'image/webp')
      const result = await imgcap(webpBlob, { targetSize: 8000 })

      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('image/webp')
    })
  })

  describe('Performance', () => {
    it('should handle concurrent compressions', async () => {
      const promises = Array.from({ length: 3 }, (_, i) => imgcap(testImageBlob, { targetSize: 4000 + i * 1000 }))

      const results = await Promise.all(promises)

      results.forEach((result, i) => {
        expect(result).toBeInstanceOf(Blob)
        expect(result.size).toBeLessThanOrEqual(4000 + i * 1000)
      })
    })
  })
})
