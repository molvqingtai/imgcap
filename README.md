# ImgCap

[![version](https://img.shields.io/github/v/release/molvqingtai/imgcap)](https://www.npmjs.com/package/imgcap) [![workflow](https://github.com/molvqingtai/imgcap/actions/workflows/ci.yml/badge.svg)](https://github.com/molvqingtai/imgcap/actions) [![download](https://img.shields.io/npm/dt/imgcap)](https://www.npmjs.com/package/imgcap) [![npm package minimized gzipped size](https://img.shields.io/bundlejs/size/imgcap)](https://www.npmjs.com/package/imgcap)

```shell
pnpm install imgcap
```

> Automatically compress images to exact file size using binary search algorithm. No more "file too large" errors.

### Why ImgCap?

Users often encounter "File too large" errors when uploading images, forcing them to manually compress files using external tools. This creates friction and leads to user dropout. imgcap solves this by automatically compressing images to exact size requirements - no user intervention needed.

```typescript
// Before: User sees error, leaves frustrated
❌ "File too large: Image upload size cannot exceed 2MB"

// After: Seamless auto-compression
✅ await imgcap(userPhoto, { targetSize: 2 * 1024 * 1024 })
```

### Usage

```typescript
import imgcap from 'imgcap'

// Social media avatar (500KB limit)
const avatar = await imgcap(file, { targetSize: 500 * 1024 })

// With format conversion
const webp = await imgcap(imageFile, {
  targetSize: 300 * 1024,
  outputType: 'image/webp'
})
```

### API

```typescript
interface Options {
  targetSize: number // Target file size in bytes
  toleranceSize?: number // Size tolerance (default: -1024)
  outputType?: ImageType // Output format (default: same as input)
}

type ImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'
```

**Browser only** - Requires OffscreenCanvas support (modern browsers).

### License

MIT © [molvqingtai](https://github.com/molvqingtai)
