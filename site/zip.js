/**
 * Minimal ZIP writer (store method, no compression).
 *
 * The images inside are already compressed, so deflating them again would
 * burn CPU for ~0% gain. Store-only also keeps this dependency-free.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let value = i
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[i] = value >>> 0
  }
  return table
})()

const crc32 = (bytes) => {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const dosTime = (date) => ({
  time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
  date: ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
})

export const sanitizeName = (name, fallback = 'image') => {
  // ZIP entries must stay flat: drop any directory part first, then make
  // the remaining name safe on Windows, macOS and Linux.
  const base = String(name).split(/[\\/]/).pop() || ''
  const cleaned = base
    .replace(/[:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
  return cleaned || fallback
}

export const uniqueName = (name, used) => {
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ''
  let index = 2
  let candidate = `${base}-${index}${ext}`
  while (used.has(candidate)) {
    index++
    candidate = `${base}-${index}${ext}`
  }
  used.add(candidate)
  return candidate
}

/**
 * @param {{ name: string, blob: Blob }[]} entries
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function buildZip(entries, onProgress) {
  const encoder = new TextEncoder()
  const chunks = []
  const central = []
  const stamp = dosTime(new Date())
  let offset = 0
  let index = 0

  for (const entry of entries) {
    const name = encoder.encode(sanitizeName(entry.name))
    const bytes = new Uint8Array(await entry.blob.arrayBuffer())
    const crc = crc32(bytes)

    const local = new Uint8Array(30 + name.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true) // UTF-8 filenames
    localView.setUint16(8, 0, true) // stored
    localView.setUint16(10, stamp.time, true)
    localView.setUint16(12, stamp.date, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, bytes.length, true)
    localView.setUint32(22, bytes.length, true)
    localView.setUint16(26, name.length, true)
    localView.setUint16(28, 0, true)
    local.set(name, 30)

    const record = new Uint8Array(46 + name.length)
    const recordView = new DataView(record.buffer)
    recordView.setUint32(0, 0x02014b50, true)
    recordView.setUint16(4, 20, true)
    recordView.setUint16(6, 20, true)
    recordView.setUint16(8, 0x0800, true)
    recordView.setUint16(10, 0, true)
    recordView.setUint16(12, stamp.time, true)
    recordView.setUint16(14, stamp.date, true)
    recordView.setUint32(16, crc, true)
    recordView.setUint32(20, bytes.length, true)
    recordView.setUint32(24, bytes.length, true)
    recordView.setUint16(28, name.length, true)
    recordView.setUint32(42, offset, true)
    record.set(name, 46)

    chunks.push(local, bytes)
    central.push(record)
    offset += local.length + bytes.length
    index++
    onProgress?.(index, entries.length)
    // Let the page repaint between large files.
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  const directory = new Uint8Array(central.reduce((sum, record) => sum + record.length, 0))
  let cursor = 0
  for (const record of central) {
    directory.set(record, cursor)
    cursor += record.length
  }

  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, directory.length, true)
  endView.setUint32(16, offset, true)

  return new Blob([...chunks, directory, end], { type: 'application/zip' })
}
