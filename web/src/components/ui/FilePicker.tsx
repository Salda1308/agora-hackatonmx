import { useState } from 'react'
import type { ChangeEvent } from 'react'

/**
 * Selector de archivo con apariencia de botón outline (D11). El input nativo queda
 * encima, transparente, para conservar teclado, lector de pantalla y el envío del form.
 * El nombre del archivo se muestra en texto muted y se recorta con elipsis.
 */
export function FilePicker({ id, name, accept, buttonLabel = 'Elegir archivo', emptyLabel = 'Ningún archivo elegido', describedBy, invalid, onFile }: {
  id: string
  name?: string
  accept?: string
  buttonLabel?: string
  emptyLabel?: string
  describedBy?: string
  invalid?: boolean
  onFile?: (archivo: File | undefined) => void
}) {
  const [nombre, setNombre] = useState<string | null>(null)
  const cambiar = (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    setNombre(archivo?.name ?? null)
    onFile?.(archivo)
  }
  return (
    <div className="fm-file">
      <span className="ui-button ui-button--outline ui-button--md fm-file__button" aria-hidden="true">{buttonLabel}</span>
      <span className={`fm-file__name${nombre ? ' fm-file__name--set' : ''}`} aria-hidden="true">{nombre ?? emptyLabel}</span>
      <input id={id} name={name} type="file" accept={accept} className="fm-file__input"
        aria-describedby={describedBy} aria-invalid={invalid || undefined} onChange={cambiar} />
    </div>
  )
}
