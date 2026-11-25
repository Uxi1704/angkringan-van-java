'use client'

import { stallBrand } from '@/lib/shop'

type Location = { id: string; name: string }

export function StallSwitch({
  locations,
  value,
  onChange,
}: {
  locations: Location[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {locations.map((location) => {
        const brand = stallBrand(location.name)
        const active = location.id === value
        return (
          <button
            key={location.id}
            type="button"
            onClick={() => onChange(location.id)}
            className={'rounded-2xl px-2 py-3 text-center ' + (active ? 'bg-white ring-2 ring-primary' : 'bg-white/80')}
          >
            <img src={brand.logo} alt={brand.short} className="mx-auto h-[4.5rem] w-[4.5rem] rounded-full object-cover shadow-sm" />
            <span className={'mt-2 block font-display text-sm font-semibold leading-tight ' + (active ? 'text-primary' : 'text-ink')}>{brand.short}</span>
            <span className="mt-0.5 block text-[11px] text-stone-500">{brand.place}</span>
          </button>
        )
      })}
    </div>
  )
}
