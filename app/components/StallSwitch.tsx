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
    <div className="grid grid-cols-2 gap-2">
      {locations.map((location) => {
        const brand = stallBrand(location.name)
        const active = location.id === value
        return (
          <button
            key={location.id}
            type="button"
            onClick={() => onChange(location.id)}
            className={'rounded-2xl px-2 py-3 text-center shadow-sm ' + (active ? 'bg-primary text-white' : 'bg-white')}
          >
            <img src={brand.logo} alt={brand.short} className="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-white" />
            <span className="mt-2 block text-sm font-bold leading-tight">{brand.short}</span>
            <span className={'mt-0.5 block text-[11px] ' + (active ? 'text-white/75' : 'text-stone-500')}>{brand.place}</span>
          </button>
        )
      })}
    </div>
  )
}
