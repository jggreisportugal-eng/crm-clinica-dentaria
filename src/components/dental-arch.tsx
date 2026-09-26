// Arcada superior desenhada como num odontograma: 14 dentes ao longo de
// meia elipse, incisivos estreitos à frente e molares largos nas pontas.
// Os dentes em `marked` aparecem destacados (como um tratamento planeado).
const TEETH = 14
const CX = 200
const CY = 250
const RX = 150
const RY = 190

export function DentalArch({
  marked = [3, 9, 10],
  className,
}: {
  marked?: number[]
  className?: string
}) {
  const teeth = Array.from({ length: TEETH }, (_, i) => {
    const theta = Math.PI * (0.06 + (0.88 * i) / (TEETH - 1))
    const x = CX + RX * Math.cos(theta)
    const y = CY - RY * Math.sin(theta)
    const tangent = Math.atan2(-RY * Math.cos(theta), -RX * Math.sin(theta))
    // 0 nas pontas (molares), 1 no centro (incisivos)
    const front = 1 - Math.abs(i - (TEETH - 1) / 2) / ((TEETH - 1) / 2)
    const w = 36 - front * 14
    const h = 30 + front * 4
    // Arredondado para o SVG do servidor e do browser serem idênticos
    // (diferenças de 1e-14 nos cálculos quebravam a hidratação).
    const r = (n: number) => Math.round(n * 100) / 100
    return { i, x: r(x), y: r(y), rotate: r((tangent * 180) / Math.PI), w: r(w), h: r(h) }
  })

  return (
    <svg
      viewBox="0 0 400 290"
      className={className}
      role="img"
      aria-label="Arcada dentária superior"
    >
      {teeth.map((t) => (
        <g key={t.i} transform={`translate(${t.x} ${t.y}) rotate(${t.rotate})`}>
          <rect
            className="tooth"
            style={{ animationDelay: `${120 + Math.abs(t.i - 6.5) * 70}ms` }}
            x={-t.w / 2}
            y={-t.h / 2}
            width={t.w}
            height={t.h}
            rx={t.w * 0.38}
            fill={marked.includes(t.i) ? 'var(--color-brand-300)' : 'white'}
            fillOpacity={marked.includes(t.i) ? 1 : 0.9}
          />
        </g>
      ))}
    </svg>
  )
}
