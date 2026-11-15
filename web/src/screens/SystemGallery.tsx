import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Chip, SampleBadge } from '../components/ui/Chip'
import { EmptyState } from '../components/ui/EmptyState'
import { ProgressBar, ProgressRing } from '../components/ui/Progress'
import { Stepper } from '../components/ui/Stepper'
import { IconCheck, IconHeart } from '../components/ui/icons'

const SWATCHES = [
  { name: 'Rojo Coco', token: '--color-primary' },
  { name: 'Amarillo pico', token: '--color-accent' },
  { name: 'Lima', token: '--color-lime' },
  { name: 'Azul', token: '--color-blue' },
  { name: 'Tinta', token: '--color-dock' },
  { name: 'Fondo', token: '--color-bg' },
  { name: 'Superficie', token: '--color-surface-2' },
  { name: 'Texto', token: '--color-text' },
]

/** Galería del sistema de diseño para revisar tokens y componentes en ambos modos. */
export function SystemGallery() {
  const [step, setStep] = useState(1)
  const [picked, setPicked] = useState<string[]>(['Agua'])
  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]))

  return (
    <main className="screen">
      <div className="screen__body screen__body--top">
        <div className="topbar">
          <span className="brand brand--ink">Ágora · sistema</span>
        </div>
        <h1 className="page-title">
          Sistema de <span className="highlight highlight--yellow">diseño</span>
        </h1>
        <p className="page-lead">Tokens y componentes base. Cambia el modo con el botón de arriba.</p>
        <p className="page-lead">
          Superficies neutras como base, rojo para la acción principal y amarillo y lima en detalles.
        </p>

        <section className="gallery-section">
          <h2 className="section-title">Color</h2>
          <div className="swatches">
            {SWATCHES.map((s) => (
              <div key={s.token} className="swatch">
                <span className="swatch__chip" style={{ background: `var(${s.token})` }} />
                <span className="swatch__name">{s.name}</span>
                <code>{s.token}</code>
              </div>
            ))}
          </div>
        </section>

        <section className="gallery-section">
          <h2 className="section-title">Tipografía</h2>
          <p className="type-hero">Ayuda 68%</p>
          <p className="type-display">Titular grande</p>
          <p className="type-xl">Subtítulo de sección</p>
          <p>Texto de lectura en Nunito, una fuente libre (SIL OFL) redondeada y con pesos muy gruesos.</p>
        </section>

        <section className="gallery-section">
          <h2 className="section-title">Botones píldora</h2>
          <div className="wrap-row">
            <Button>Primario</Button>
            <Button variant="accent">Acento</Button>
            <Button variant="lime">Lima</Button>
            <Button variant="ink">Tinta</Button>
            <Button variant="outline">Contorno</Button>
            <Button variant="ghost">Fantasma</Button>
            <Button icon={<IconHeart />}>Con ícono</Button>
            <Button disabled>Deshabilitado</Button>
            <Button href="#/" aria-disabled="true">Enlace deshabilitado</Button>
          </div>
          <Button size="lg" block>
            Botón grande de ancho completo
          </Button>
        </section>

        <section className="gallery-section">
          <h2 className="section-title">Chips</h2>
          <div className="wrap-row">
            <Chip tone="yellow">Amarillo</Chip>
            <Chip tone="lime" icon={<IconCheck />}>
              Completo
            </Chip>
            <Chip tone="red">Rojo suave</Chip>
            <Chip tone="blue">Azul suave</Chip>
            <Chip tone="ink">Tinta</Chip>
            <Chip tone="outline">Contorno</Chip>
            <SampleBadge />
          </div>
          <div className="wrap-row" role="group" aria-label="Chips seleccionables">
            {['Agua', 'Higiene', 'Alimentos'].map((c) => (
              <Chip key={c} selected={picked.includes(c)} onClick={() => toggle(c)}>
                {c}
              </Chip>
            ))}
          </div>
        </section>

        <section className="gallery-section">
          <h2 className="section-title">Tarjetas</h2>
          <div className="card-grid">
            <Card tone="red">Roja</Card>
            <Card tone="yellow">Amarilla</Card>
            <Card tone="lime">Lima</Card>
            <Card tone="blue">Azul</Card>
            <Card tone="ink">Tinta</Card>
            <Card>Superficie</Card>
          </div>
        </section>

        <section className="gallery-section">
          <h2 className="section-title">Avance</h2>
          <Card>
            <div className="stack">
              <ProgressBar label="Garrafón de 20 L" value={27} max={40} />
              <ProgressBar label="Toallitas" value={30} max={30} tone="lime" />
              <ProgressBar label="Compacta" value={4} max={10} size="sm" tone="blue" />
            </div>
          </Card>
          <div className="wrap-row">
            <ProgressRing value={68} max={100} label="Ejemplo 68%" />
            <ProgressRing value={40} max={100} label="Ejemplo 40%" tone="accent" size={96} stroke={10} />
            <ProgressRing value={100} max={100} label="Ejemplo completo" tone="lime" size={72} stroke={8} />
          </div>
        </section>

        <section className="gallery-section">
          <h2 className="section-title">Barra de pasos</h2>
          <Card>
            <Stepper
              current={step}
              total={3}
              title={['Elige unidades', 'Paga', 'Listo'][step - 1]}
              onBack={step > 1 ? () => setStep(step - 1) : undefined}
              onSkip={() => setStep(3)}
            />
            <div className="stepper-demo">
              <Button variant="ink" block onClick={() => setStep(step >= 3 ? 1 : step + 1)}>
                {step >= 3 ? 'Reiniciar' : 'Continuar'}
              </Button>
            </div>
          </Card>
        </section>

        <section className="gallery-section">
          <h2 className="section-title">Estado vacío</h2>
          <EmptyState
            title="Aún no sigues ninguna causa"
            description="Cuando sigas una, aquí verás su avance."
            action={<Button variant="accent">Explorar</Button>}
          />
        </section>

        <section className="gallery-section">
          <h2 className="section-title">Dock</h2>
          <p className="page-lead">El dock público muestra Inicio, Solicitudes y Siguiendo. La acción central es opcional.</p>
        </section>
      </div>
    </main>
  )
}
