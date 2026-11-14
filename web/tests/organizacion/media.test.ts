import { test } from 'node:test'
import assert from 'node:assert/strict'
import { videoEmbed } from '../../src/screens/organizacion/media.ts'

test('solo proveedores HTTPS conocidos, nunca HTML ni URLs arbitrarias', () => {
  assert.equal(videoEmbed('https://youtu.be/abcdefghijk'), 'https://www.youtube-nocookie.com/embed/abcdefghijk')
  assert.equal(videoEmbed('https://www.youtube.com/watch?v=abcdefghijk&t=5'), 'https://www.youtube-nocookie.com/embed/abcdefghijk')
  assert.equal(videoEmbed('https://vimeo.com/123456'), 'https://player.vimeo.com/video/123456')
  for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=abcdefghijk', 'http://youtu.be/abcdefghijk', '<iframe>', 'https://vimeo.com/abc', 'https://youtu.be/abc']) assert.equal(videoEmbed(url), null)
})

import { parseHash } from '../../src/lib/router.ts'
test('página pública por slug y destinos de edición por rol', () => {
  assert.deepEqual(parseHash('#/organizaciones/albergue-coco-t05'), { name: 'organization', slug: 'albergue-coco-t05' })
  assert.deepEqual(parseHash('#/fundacion/organizacion'), { name: 'role', role: 'fundacion', page: 'organizacion' })
  assert.deepEqual(parseHash('#/tienda/organizacion'), { name: 'role', role: 'tienda', page: 'organizacion' })
  assert.deepEqual(parseHash('#/organizaciones/%ZZ'), { name: 'not-found' })
})

import { stripJpegMetadata } from '../../../supabase/functions/t17-imagen/jpeg.ts'
test('quita EXIF/GPS, comentarios, XMP y datos posteriores, conservando el scan', () => {
  const source = new Uint8Array([0xff,0xd8, 0xff,0xe1,0,10, 69,120,105,102,71,80,83,0, 0xff,0xfe,0,5,71,80,83, 0xff,0xda,0,2, 10,20,0xff,0,30, 0xff,0xd9, 71,80,83])
  assert.deepEqual(stripJpegMetadata(source), new Uint8Array([0xff,0xd8,0xff,0xda,0,2,10,20,0xff,0,30,0xff,0xd9]))
  assert.throws(() => stripJpegMetadata(new Uint8Array([0xff,0xd8,0xff,0xe1,0,255])))
  assert.throws(() => stripJpegMetadata(new Uint8Array([0xff,0xd8,0xff,0xd9])))
})
