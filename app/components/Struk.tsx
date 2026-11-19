import { rupiah } from '@/lib/shop'

export type StrukLine = {
  name: string
  qty: number
  unit?: string
  price: number
  subtotal: number
}

export type StrukData = {
  customer: string
  stall: string
  cashier: string
  whenLabel: string
  note?: string | null
  lines: StrukLine[]
  total: number
}

export function Struk({ data }: { data: StrukData }) {
  return (
    <article className="struk mx-auto w-full max-w-xs rounded-sm bg-white px-4 py-5 text-[13px] leading-5 text-ink shadow-sm">
      <p className="text-center text-base font-bold tracking-wide">ANGKRINGAN VAN JAVA</p>
      <p className="text-center">{data.stall || 'Lapak'}</p>
      <p className="my-2 border-t border-dashed border-stone-400" />
      <p>Pelanggan: {data.customer || 'Tanpa nama'}</p>
      <p>Waktu: {data.whenLabel}</p>
      <p>Kasir: {data.cashier || 'Kasir'}</p>
      <p className="my-2 border-t border-dashed border-stone-400" />
      <ul>
        {data.lines.map((line, index) => (
          <li key={index} className="mb-1 flex justify-between gap-3">
            <span className="min-w-0">
              {line.qty} {line.unit || 'pcs'} {line.name}
              <span className="block text-[11px] text-stone-500">{rupiah(line.price)}</span>
            </span>
            <span className="shrink-0">{rupiah(line.subtotal)}</span>
          </li>
        ))}
      </ul>
      <p className="my-2 border-t border-dashed border-stone-400" />
      <p className="flex justify-between text-base font-bold">
        <span>Total</span>
        <span>{rupiah(data.total)}</span>
      </p>
      {data.note ? <p className="mt-2">Catatan: {data.note}</p> : null}
      <p className="mt-3 text-center">Terima kasih</p>
    </article>
  )
}
