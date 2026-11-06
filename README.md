# ImgCap

Automatically compress images to approximate target file size using binary search algorithm.

[![version](https://img.shields.io/github/v/release/molvqingtai/imgcap)](https://www.npmjs.com/package/imgcap) [![workflow](https://github.com/molvqingtai/imgcap/actions/workflows/ci.yml/badge.svg)](https://github.com/molvqingtai/imgcap/actions) [![download](https://img.shields.io/npm/dt/imgcap)](https://www.npmjs.com/package/imgcap) [![npm package minimized gzipped size](https://img.shields.io/bundlejs/size/imgcap)](https://www.npmjs.com/package/imgcap)

```shell
$ pnpm install imgcap
```

**[Open the compressor](https://molvqingtai.github.io/imgcap/)** — drop images, pick a target size, download. Runs entirely in your browser.

### Web app

The site is the tool itself, not a landing page: one screen with a target size,
a format switch and the queue. There is no quality slider — `imgcap` takes a byte
budget and searches for the closest fit, so the target is the only thing to set.
Batch queue, before/after compare and ZIP download are included.

It is a static page with no build step — compression runs in a Web Worker via
[comctx](https://github.com/molvqingtai/comctx), using the published `imgcap`
build from `site/vendor`.

```shell
$ pnpm serve      # preview http://localhost:3000
```

```
index.html         the tool
site/app.js        queue, settings, downloads
site/worker.js     worker entry, exposes compress() over comctx
site/engine.js     decode + imgcap call + result metadata
site/zip.js        dependency-free ZIP writer (store method)
site/app.css       styles
site/vendor/       pinned imgcap + comctx ESM builds
```

No upload, no analytics, no third-party requests: fonts are self-hosted and
every byte of your image is processed in the tab that opened it.

### Why?

Modern applications should handle image size constraints transparently, creating seamless user interactions. ImgCap implements intelligent auto-compression that respects file size limits while maintaining optimal image quality - enabling fluid, friction-free upload experiences that follow good human-computer interaction principles.

**Note**: The `targetSize` represents an ideal target. The actual output size will approximate this value within a reasonable tolerance range for optimal performance.

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
  targetSize: number // Target file size in bytes (approximate)
  outputType?: ImageType // Output format (default: same as input)
}

type ImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif'
```

#### Tolerance Behavior

The algorithm automatically applies smart tolerance based on target size:

- **Small files** (<100KB): ±1KB tolerance for high precision
- **Medium files** (100KB-100MB): ±1% tolerance for reasonable flexibility
- **Large files** (>100MB): ±1MB tolerance to avoid excessive processing

**Examples:**

- Target 50KB → Actual: 49-51KB
- Target 500KB → Actual: 495-505KB
- Target 50MB → Actual: 49.5-50.5MB
- Target 1GB → Actual: 1023-1025MB

**Browser only** - Requires OffscreenCanvas support (modern browsers).

### License

MIT © [molvqingtai](https://github.com/molvqingtai)
