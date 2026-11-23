/*
 * Enlaces al aviso de privacidad y a los términos (AGO-45). Son páginas estáticas de
 * web/public, fuera del ruteo por hash: se abren en otra pestaña para no perder lo
 * que la persona ya escribió en el formulario.
 */

export const PRIVACY_URL = '/privacidad.html'
export const TERMS_URL = '/terminos.html'

const externo = { target: '_blank', rel: 'noopener noreferrer' } as const

export function LegalLinks({ lead = 'Antes de enviar tus datos, lee el', className }: { lead?: string; className?: string }) {
  return (
    <p className={className}>
      {lead} <a href={PRIVACY_URL} {...externo}>aviso de privacidad</a> y los{' '}
      <a href={TERMS_URL} {...externo}>términos de uso</a>.
    </p>
  )
}

/** Pie corto para pantallas sin formulario. */
export function LegalFooter({ className }: { className?: string }) {
  return (
    <p className={className}>
      <a href={PRIVACY_URL} {...externo}>Aviso de privacidad</a> · <a href={TERMS_URL} {...externo}>Términos de uso</a>
    </p>
  )
}
