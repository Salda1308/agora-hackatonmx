/** Remove APP0..APP15 and COM segments, including EXIF, XMP, IPTC and trailing bytes. */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('JPEG inválido')
  const chunks: Uint8Array[] = [bytes.subarray(0, 2)]
  let position = 2
  let hasScan = false
  while (position < bytes.length) {
    const start = position
    if (bytes[position++] !== 0xff) throw new Error('JPEG inválido')
    while (bytes[position] === 0xff) position++
    const marker = bytes[position++]
    if (marker === 0xd9) {
      if (!hasScan) throw new Error('JPEG sin imagen')
      chunks.push(new Uint8Array([0xff, 0xd9]))
      const length = chunks.reduce((n, c) => n + c.length, 0)
      const result = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
      return result
    }
    if (!marker || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) throw new Error('Marcador JPEG inválido')
    const length = (bytes[position] << 8) | bytes[position + 1]
    if (length < 2 || position + length > bytes.length) throw new Error('Segmento JPEG inválido')
    position += length
    if (!(marker >= 0xe0 && marker <= 0xef) && marker !== 0xfe) chunks.push(bytes.subarray(start, position))
    if (marker === 0xda) {
      hasScan = true
      const scanStart = position
      while (position < bytes.length) {
        if (bytes[position] !== 0xff) { position++; continue }
        let next = position + 1
        while (bytes[next] === 0xff) next++
        const code = bytes[next]
        if (code === 0 || (code >= 0xd0 && code <= 0xd7)) { position = next + 1; continue }
        break
      }
      chunks.push(bytes.subarray(scanStart, position))
    }
  }
  throw new Error('JPEG incompleto')
}
