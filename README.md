# imgcap

An image compression library using binary search algorithm to maximize approximation to target file size.

## Features

- 🎯 **Precise File Size Control**: Uses binary search algorithm to compress images to exact target file size
- 🖼️ **Multi-format Support**: Supports JPEG, PNG, WebP and AVIF formats
- ⚡ **Efficient Compression**: Smart binary search algorithm quickly finds optimal compression parameters
- 🎛️ **Tolerance Control**: Configurable file size tolerance range
- 🔧 **TypeScript Support**: Full type definitions included

## Installation

```bash
npm install imgcap
# or
pnpm add imgcap
# or
yarn add imgcap
```

## Usage

### Basic Usage

```javascript
import imgCap from 'imgcap'

// Compress image to 100KB
const compressedBlob = await imgCap(imageBlob, {
  targetSize: 100 * 1024 // 100KB
})
```

### Advanced Configuration

```javascript
import { imgCap } from 'imgcap'

const compressedBlob = await imgCap(imageBlob, {
  targetSize: 200 * 1024, // Target size: 200KB
  toleranceSize: -2048, // Tolerance: -2KB (allow 2KB smaller than target)
  outputType: 'image/jpeg' // Output format
})
```

### Handling File Upload in Web

```javascript
import imgCap from 'imgcap'

const handleFileUpload = async (event) => {
  const file = event.target.files[0]

  try {
    const compressedBlob = await imgCap(file, {
      targetSize: 500 * 1024, // Compress to 500KB
      toleranceSize: -1024, // Allow 1KB smaller than target
      outputType: 'image/jpeg'
    })

    // Create compressed file
    const compressedFile = new File([compressedBlob], 'compressed.jpg', {
      type: 'image/jpeg'
    })

    console.log(`Original size: ${file.size} bytes`)
    console.log(`Compressed size: ${compressedBlob.size} bytes`)
  } catch (error) {
    console.error('Compression failed:', error)
  }
}
```

## API Documentation

### `imgCap(input, options)`

Main compression function.

#### Parameters

- **input** `Blob` - Input image Blob object
- **options** `Options` - Compression options

#### Options

```typescript
interface Options {
  targetSize: number // Target file size in bytes
  toleranceSize?: number // Tolerance size in bytes, default -1024
  outputType?: ImageType // Output format, defaults to input format
}

type ImageType = 'image/jpeg' | 'image/png' | 'image/webp'
```

#### Return Value

Returns `Promise<Blob>` containing the compressed image data.

## How It Works

imgcap uses a binary search algorithm to find optimal compression parameters:

1. **Initialize Range**: Set search range for compression quality (0-1)
2. **Binary Search**:
   - Calculate middle value as current compression quality
   - Scale image dimensions proportionally
   - Generate compressed Blob
   - Check if file size is within target range
3. **Recursive Optimization**:
   - If file is too large, continue search in lower quality range
   - If file is too small, continue search in higher quality range
   - Until finding the result closest to target size

## Notes

- Supported image formats: PNG, JPEG, WebP
- Tolerance size must be a multiple of 1024
- If input image is already smaller than target size and format matches, returns original image
- Uses OffscreenCanvas API, requires modern browser support

## License

ISC

## Contributing

Issues and Pull Requests are welcome!
