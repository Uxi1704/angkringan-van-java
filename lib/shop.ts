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

export const STARTER_DRINKS = [
  { name: "Es teh", price: 3000 },
  { name: "Teh panas", price: 3000 },
  { name: "Es jeruk", price: 5000 },
  { name: "Kopi hitam", price: 4000 },
  { name: "Kopi susu", price: 5000 },
  { name: "Susu", price: 5000 },
  { name: "Jahe", price: 4000 },
  { name: "Air mineral", price: 3000 },
] as const;

export type MenuKind = "makanan" | "minuman";

export type StallBrand = {
  key: "vanjava" | "arjuna";
  brand: string;
  short: string;
  place: string;
  logo: string;
};

export function menuKind(category?: string | null): MenuKind {
  return (category || "").trim().toLowerCase() === "minuman" ? "minuman" : "makanan";
}

export function rupiah(value: number) {
  return "Rp " + value.toLocaleString("id-ID");
}

export function menuUnit(unit?: string | null) {
  const value = (unit || "").trim();
  return value || "tusuk";
}

export function stallBrand(name?: string | null): StallBrand {
  const value = (name || "").toLowerCase();
  if (value.includes("arjuna") || value.includes("sebabi") || /java\s*2|\b2\b/.test(value)) {
    return {
      key: "arjuna",
      brand: "Angkringan ARJUNA85",
      short: "ARJUNA85",
      place: "Simpang Sebabi",
      logo: "/logo-arjuna85.jpg",
    };
  }
  return {
    key: "vanjava",
    brand: "Angkringan VANJAVA65",
    short: "VANJAVA65",
    place: "Simpang Bangkal",
    logo: "/logo-vanjava65.jpg",
  };
}

export function stallPlace(name: string) {
  return stallBrand(name).place;
}

export function sortLocations<T extends { name: string }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const order = (stallBrand(a.name).key === "vanjava" ? 0 : 1) - (stallBrand(b.name).key === "vanjava" ? 0 : 1);
    return order || a.name.localeCompare(b.name);
  });
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
