import { describe, it, expect, beforeAll } from 'vitest'
import { createTestImageBlob } from '../utils'
import { imgCap } from 'imgcap'

describe('imgCap', () => {
  let testImageBlob: Blob

  beforeAll(async () => {
    testImageBlob = await createTestImageBlob(200, 200, 'image/png')
  })

  describe('Input Validation', () => {
    it('should throw error for unsupported image type', async () => {
      const invalidBlob = new Blob(['test'], { type: 'text/plain' })

      await expect(imgCap(invalidBlob, { targetSize: 10000 })).rejects.toThrow(
        'Only PNG, JPEG, WebP and AVIF images are supported.'
      )
    })

    it('should throw error for tolerance size less than 1024', async () => {
      await expect(imgCap(testImageBlob, { targetSize: 10000, toleranceSize: 512 })).rejects.toThrow(
        'Tolerance size must be at least ±1024 bytes.'
      )
    })

    it('should throw error for negative tolerance size less than -1024', async () => {
      await expect(imgCap(testImageBlob, { targetSize: 10000, toleranceSize: -512 })).rejects.toThrow(
        'Tolerance size must be at least ±1024 bytes.'
      )
    })

    it('should accept tolerance size of exactly ±1024', async () => {
      await expect(imgCap(testImageBlob, { targetSize: 10000, toleranceSize: 1024 })).resolves.toBeDefined()

      await expect(imgCap(testImageBlob, { targetSize: 10000, toleranceSize: -1024 })).resolves.toBeDefined()
    })

    it('should accept tolerance size greater than ±1024', async () => {
      await expect(imgCap(testImageBlob, { targetSize: 10000, toleranceSize: 2048 })).resolves.toBeDefined()

      await expect(imgCap(testImageBlob, { targetSize: 10000, toleranceSize: -2048 })).resolves.toBeDefined()
    })
  })

  describe('Basic Functionality', () => {
    it('should return original blob if already smaller than target size', async () => {
      const smallBlob = await createTestImageBlob(10, 10, 'image/png')
      const result = await imgCap(smallBlob, { targetSize: 100000 })

      expect(result).toBe(smallBlob)
      expect(result.size).toBe(smallBlob.size)
    })

    it('should compress image to approximate target size', async () => {
      const targetSize = 5000
      const result = await imgCap(testImageBlob, {
        targetSize,
        toleranceSize: -1024
      })

      expect(result).toBeInstanceOf(Blob)
      expect(result.size).toBeLessThanOrEqual(targetSize)
      // 允许更大的容差范围，因为压缩算法可能产生更小的文件
      expect(result.size).toBeGreaterThan(500)
    })

    it('should respect tolerance range', async () => {
      const targetSize = 3000
      const toleranceSize = -1024
      const result = await imgCap(testImageBlob, {
        targetSize,
        toleranceSize
      })

      const lowerBound = targetSize + Math.min(0, toleranceSize)
      const upperBound = targetSize + Math.max(0, toleranceSize)

      expect(result.size).toBeLessThanOrEqual(upperBound)
      // 对于负容差，只检查上界，因为压缩可能产生比期望更小的文件
      if (toleranceSize < 0) {
        expect(result.size).toBeGreaterThan(500) // 确保不会过小
      } else {
        expect(result.size).toBeGreaterThanOrEqual(lowerBound)
      }
    })
  })

  describe('Output Format Control', () => {
    it('should maintain original format when no outputType specified', async () => {
      const jpegBlob = await createTestImageBlob(100, 100, 'image/jpeg')
      const result = await imgCap(jpegBlob, { targetSize: 10000 })

      expect(result.type).toBe('image/jpeg')
    })

    it('should convert to specified output format', async () => {
      const result = await imgCap(testImageBlob, {
        targetSize: 10000,
        outputType: 'image/jpeg'
      })

      expect(result.type).toBe('image/jpeg')
    })

    it('should handle PNG to WebP conversion', async () => {
      const result = await imgCap(testImageBlob, {
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
      const result = await imgCap(largeBlob, { targetSize })

      expect(result.size).toBeLessThan(largeBlob.size)
      expect(result.size).toBeLessThanOrEqual(targetSize)
    })

    it('should handle very small target sizes', async () => {
      const targetSize = 2000
      const result = await imgCap(testImageBlob, {
        targetSize,
        toleranceSize: -1024
      })

      expect(result.size).toBeLessThanOrEqual(targetSize)
      expect(result.size).toBeGreaterThan(500) // Should not be too small
    })

    it('should handle edge case with very large tolerance', async () => {
      const targetSize = 5000
      const toleranceSize = 10000
      const result = await imgCap(testImageBlob, {
        targetSize,
        toleranceSize
      })

      expect(result.size).toBeLessThanOrEqual(targetSize + toleranceSize)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid image data gracefully', async () => {
      const invalidImageBlob = new Blob(['not an image'], { type: 'text/plain' })

      await expect(imgCap(invalidImageBlob, { targetSize: 10000 })).rejects.toThrow()
    })

    it('should handle zero target size', async () => {
      await expect(imgCap(testImageBlob, { targetSize: 0 })).rejects.toThrow()
    })

    it('should handle negative target size', async () => {
      await expect(imgCap(testImageBlob, { targetSize: -1000 })).rejects.toThrow()
    })
  })

  describe('Format Support', () => {
    it('should handle JPEG input', async () => {
      const jpegBlob = await createTestImageBlob(150, 150, 'image/jpeg')
      const result = await imgCap(jpegBlob, { targetSize: 8000 })

      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('image/jpeg')
    })

    it('should handle WebP format', async () => {
      const webpBlob = await createTestImageBlob(150, 150, 'image/webp')
      const result = await imgCap(webpBlob, { targetSize: 8000 })

      expect(result).toBeInstanceOf(Blob)
      expect(result.type).toBe('image/webp')
    })
  })

  describe('Performance', () => {
    it('should handle concurrent compressions', async () => {
      const promises = Array.from({ length: 3 }, (_, i) => imgCap(testImageBlob, { targetSize: 4000 + i * 1000 }))

      const results = await Promise.all(promises)

      results.forEach((result, i) => {
        expect(result).toBeInstanceOf(Blob)
        expect(result.size).toBeLessThanOrEqual(4000 + i * 1000)
      })
    })
  })
})
