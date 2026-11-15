import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { requestVisual } from '../lib/request-visuals'
import type { Category } from '../data/sample'

/** URL firmada de una imagen del bucket privado `publicaciones` (T17/T25). */
function useRequestPhoto(path?: string | null) {
  const [src, setSrc] = useState<{ path: string; url: string } | null>(null)
  useEffect(() => {
    if (!path || !supabase) return
    let active = true
    void supabase.storage.from('publicaciones').createSignedUrl(path, 3600).then(({ data }) => {
      if (active && data?.signedUrl) setSrc({ path, url: data.signedUrl })
    })
    return () => { active = false }
  }, [path])
  return src && src.path === path ? src.url : null
}

/**
 * Imagen de una solicitud: la foto propia si existe; si no, o si falla, la ilustración
 * de la categoría. La foto lleva `request-photo` para recortarse (object-fit: cover)
 * dentro del marco de relación fija de cada contenedor.
 */
export function RequestImage({ path, src, category, title, illustrationAlt = '', note = false, loading = 'lazy' }: {
  path?: string | null
  /** URL ya firmada (el feed la trae resuelta). */
  src?: string | null
  category: Category
  title: string
  illustrationAlt?: string
  /** Muestra la nota «Ilustración de insumos» cuando no hay foto. */
  note?: boolean
  loading?: 'lazy' | 'eager'
}) {
  const signed = useRequestPhoto(src ? null : path)
  const photo = src ?? signed
  const [failed, setFailed] = useState<string | null>(null)
  if (photo && failed !== photo)
    return <img className="request-photo" src={photo} alt={`Foto de la solicitud: ${title}`} loading={loading} decoding="async" onError={() => setFailed(photo)} />
  return <>
    <img src={requestVisual(category)} alt={illustrationAlt} loading={loading} decoding="async" />
    {note && <span className="feed-illustration-note">Ilustración de insumos</span>}
  </>
}
