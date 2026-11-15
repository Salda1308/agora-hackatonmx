/** aria-describedby para un control dentro de `Field`. */
export function describe(id: string, hint?: string, error?: string | null) {
  const ids = [hint ? `${id}-ayuda` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ')
  return { id, 'aria-describedby': ids || undefined, 'aria-invalid': error ? true : undefined }
}
