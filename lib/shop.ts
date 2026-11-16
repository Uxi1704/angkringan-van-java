export const STARTER_MENUS = [
  { name: "Sakalop", price: 3000 },
  { name: "Sayap", price: 7000 },
  { name: "Otak otak", price: 3000 },
  { name: "Tempura", price: 3000 },
  { name: "Tahu bacem", price: 3000 },
  { name: "Tempe bacem", price: 3000 },
  { name: "Telor puyuh", price: 5000 },
  { name: "Sosis bakar", price: 7000 },
] as const;

export function rupiah(value: number) {
  return "Rp " + value.toLocaleString("id-ID");
}

export function stallPlace(name: string) {
  return /2/.test(name) ? "Simpang Sebabi" : "Simpang Bangkal";
}

export function jakartaInputNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function jakartaInputToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("jam");
  }
  return new Date(`${value}:00+07:00`).toISOString();
}

export function formatWib(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function dayKeyJakarta(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function dayLabel(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
