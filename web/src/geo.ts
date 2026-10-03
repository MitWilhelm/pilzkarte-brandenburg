// Reine Geo- und Anzeige-Hilfen für die Karte: Pixel unter einer Koordinate, Farben, Navigationslinks.
// Das Daten-PNG liegt in Web-Mercator vor; seine Pixel sind daher linear in Mercator-Koordinaten.

export interface Gebiet {
  readonly name: string;
  readonly anzeigename: string;
  readonly mitte: readonly [number, number]; // [Länge, Breite]
  readonly breitePixel: number;
  readonly hoehePixel: number;
  // Reihenfolge wie MapLibre-Bildquellen: oben links, oben rechts, unten rechts, unten links
  readonly ecken: readonly [Ecke, Ecke, Ecke, Ecke];
}

export type Ecke = readonly [number, number];

export interface Pixel {
  readonly spalte: number;
  readonly zeile: number;
}

export interface Rgb {
  readonly rot: number;
  readonly gruen: number;
  readonly blau: number;
}

const GRAD_ZU_RAD = Math.PI / 180;
export const BAUMARTEN: readonly string[] = [
  "Kiefer",
  "Fichte",
  "Douglasie",
  "Lärche",
  "Tanne",
  "Buche",
  "Eiche",
  "Birke",
  "Erle",
  "Sonstige",
  "Kronenverlust (Kahlschlag, Schaden)",
];
export const BAUMART_KEIN_WERT = 255;

// Fünf Klassen von 50 bis 100: von hellem Gelb (möglich) bis tiefem Rotbraun (beste Stellen im Gebiet).
export const STUFEN: readonly { readonly ab: number; readonly name: string; readonly farbe: Rgb }[] = [
  { ab: 90, name: "Sehr gut", farbe: { rot: 122, gruen: 28, blau: 18 } },
  { ab: 80, name: "Gut", farbe: { rot: 196, gruen: 64, blau: 26 } },
  { ab: 70, name: "Ordentlich", farbe: { rot: 232, gruen: 128, blau: 40 } },
  { ab: 60, name: "Mäßig", farbe: { rot: 244, gruen: 186, blau: 72 } },
  { ab: 50, name: "Möglich", farbe: { rot: 250, gruen: 228, blau: 150 } },
];

export function mercatorY(breite: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (breite * GRAD_ZU_RAD) / 2));
}

/** Pixel des Daten-Bilds unter (Länge, Breite) oder null, wenn die Stelle außerhalb des Gebiets liegt. */
export function pixelAnStelle(gebiet: Gebiet, laenge: number, breite: number): Pixel | null {
  const [obenLinks, , untenRechts] = gebiet.ecken;
  const anteilX = (laenge - obenLinks[0]) / (untenRechts[0] - obenLinks[0]);
  const anteilY = (mercatorY(obenLinks[1]) - mercatorY(breite)) / (mercatorY(obenLinks[1]) - mercatorY(untenRechts[1]));
  if (anteilX < 0 || anteilX >= 1 || anteilY < 0 || anteilY >= 1) {
    return null;
  }
  return { spalte: Math.floor(anteilX * gebiet.breitePixel), zeile: Math.floor(anteilY * gebiet.hoehePixel) };
}

export function stufeninfo(stufe: number): { readonly name: string; readonly farbe: Rgb } | null {
  return STUFEN.find((klasse) => stufe >= klasse.ab) ?? null;
}

export function baumartName(index: number): string | null {
  if (index === BAUMART_KEIN_WERT) {
    return null;
  }
  const name = BAUMARTEN[index];
  if (name === undefined) {
    throw new Error(`Invariante verletzt: unbekannter Baumart-Index ${String(index)}`);
  }
  return name;
}

function koordinaten(breite: number, laenge: number): string {
  return `${breite.toFixed(5)},${laenge.toFixed(5)}`;
}

/** Google Maps berechnet die Route vom aktuellen Standort bis zum Ziel (dokumentiertes Maps-URL-Format). */
export function googleMapsRoute(breite: number, laenge: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${koordinaten(breite, laenge)}`;
}

/** Komoot-Planer, zentriert auf die Stelle; das Ziel setzt man dort per Tipp. */
export function komootPlaner(breite: number, laenge: number): string {
  return `https://www.komoot.com/plan/@${koordinaten(breite, laenge)},16z`;
}

export type Pilzkanal = 1 | 2; // Kanal im Daten-Bild: 1 = Steinpilz (Grün), 2 = Pfifferling (Blau)
const KANAELE_PRO_PIXEL = 4;
const DECKKRAFT = 255;

/** Färbt die Stufen eines Pilzkanals ein; Pixel ohne Habitat bleiben durchsichtig. */
export function faerbeOverlay(daten: Uint8ClampedArray, kanal: Pilzkanal): Uint8ClampedArray<ArrayBuffer> {
  if (daten.length % KANAELE_PRO_PIXEL !== 0) {
    throw new Error(`Invariante verletzt: Bilddaten mit ${String(daten.length)} Bytes sind nicht RGBA`);
  }
  const farbig = new Uint8ClampedArray(daten.length);
  for (let start = 0; start < daten.length; start += KANAELE_PRO_PIXEL) {
    const info = stufeninfo(daten[start + kanal] ?? 0);
    if (info === null) {
      continue;
    }
    farbig[start] = info.farbe.rot;
    farbig[start + 1] = info.farbe.gruen;
    farbig[start + 2] = info.farbe.blau;
    farbig[start + 3] = DECKKRAFT;
  }
  return farbig;
}
