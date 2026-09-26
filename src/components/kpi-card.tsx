export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string
  value: number | string
  hint?: string
}) {
  return (
    <div className="border-b border-r border-gray-200 px-5 py-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-[32px] font-semibold leading-none tracking-tight text-gray-900 tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

// Grelha de indicadores: um só cartão com divisórias finas entre os
// valores, em vez de uma caixa por número.
export function KpiGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="-mb-px -mr-px grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      </div>
    </section>
  )
}
