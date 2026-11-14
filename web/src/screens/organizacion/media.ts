/** Only known providers become frames; arbitrary HTML/URLs never do. */
export function videoEmbed(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) :
      ['www.youtube.com', 'youtube.com'].includes(url.hostname) ? url.searchParams.get('v') : null
    if (id && /^[\w-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`
    if (['vimeo.com', 'www.vimeo.com'].includes(url.hostname) && /^\/\d+$/.test(url.pathname)) return `https://player.vimeo.com/video${url.pathname}`
  } catch { /* invalid URL */ }
  return null
}

export const IMAGE_LIMIT = 5 * 1024 * 1024
/** Decode and draw pixels into a new JPEG: no original EXIF/GPS is copied. */
export async function cleanImage(file: File): Promise<Blob> {
  if (file.size > IMAGE_LIMIT || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Elige JPG, PNG o WebP de hasta 5 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error('La imagen tiene demasiados píxeles.')
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No pudimos procesar la imagen.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('No pudimos procesar la imagen.')), 'image/jpeg', 0.86))
    if (blob.size > IMAGE_LIMIT) throw new Error('La imagen procesada supera 5 MB.')
    return blob
  } finally { bitmap.close() }
}
