// Reine Geo- und Anzeige-Hilfen für die Karte: Pixel unter einer Koordinate, Farben, Navigationslinks.
// Das Daten-PNG liegt in Web-Mercator vor; seine Pixel sind daher linear in Mercator-Koordinaten.
import type { Pilzart } from "./wachstum.ts";

/** Ein GPS-Standort des Geräts. */
export interface Standort {
  readonly breite: number;
  readonly laenge: number;
  readonly genauigkeitMeter: number;
  readonly zeitpunktMs: number;
}

export interface Gebiet {
  readonly name: string;
  readonly anzeigename: string;
  readonly mitte: readonly [number, number]; // [Länge, Breite]
  readonly breitePixel: number;
  readonly hoehePixel: number;
  // Reihenfolge wie MapLibre-Bildquellen: oben links, oben rechts, unten rechts, unten links
  readonly ecken: readonly [Ecke, Ecke, Ecke, Ecke];
  readonly ordner: string; // Ordner der Dateien relativ zur Seite, z. B. "daten/barnim"
}

export type Ecke = readonly [number, number];

/** Sichtbarer Kartenausschnitt in Grad (WGS84). */
export interface Kartenausschnitt {
  readonly west: number;
  readonly sued: number;
  readonly ost: number;
  readonly nord: number;
}

const ERDRADIUS_METER = 6_371_000;
const KREIS_ECKEN = 48;

/** Kreis um [Länge, Breite] mit Radius in Metern als geschlossener Polygonzug (Genauigkeitskreis des GPS). */
export function kreisPolygon(mitte: readonly [number, number], radiusMeter: number): (readonly [number, number])[] {
  const breiteRad = mitte[1] * (Math.PI / 180);
  const grad = radiusMeter / ((ERDRADIUS_METER * Math.PI) / 180);
  const punkte: [number, number][] = [];
  for (let nummer = 0; nummer < KREIS_ECKEN; nummer += 1) {
    const winkel = (2 * Math.PI * nummer) / KREIS_ECKEN;
    punkte.push([mitte[0] + (grad * Math.cos(winkel)) / Math.cos(breiteRad), mitte[1] + grad * Math.sin(winkel)]);
  }
  const erster = punkte[0];
  if (erster === undefined) {
    throw new Error("Invariante verletzt: Kreis ohne Ecken");
  }
  return [...punkte, erster];
}
const GRAD_IN_RAD = Math.PI / 180;

/** Abstand zweier Punkte [Länge, Breite] in Metern (Großkreis); auf wenige Meter genau, reicht für Hinweise. */
export function abstandMeter(a: readonly [number, number], b: readonly [number, number]): number {
  const breiteA = a[1] * GRAD_IN_RAD;
  const breiteB = b[1] * GRAD_IN_RAD;
  const halbeBreite = Math.sin((breiteB - breiteA) / 2);
  const halbeLaenge = Math.sin(((b[0] - a[0]) * GRAD_IN_RAD) / 2);
  const h = halbeBreite * halbeBreite + Math.cos(breiteA) * Math.cos(breiteB) * halbeLaenge * halbeLaenge;
  return 2 * ERDRADIUS_METER * Math.asin(Math.sqrt(h));
}

/** Gebiete (Kacheln), deren Bild den Ausschnitt schneidet; bloßes Berühren an der Kante zählt nicht. */
export function gebieteImAusschnitt(gebiete: readonly Gebiet[], ausschnitt: Kartenausschnitt): Gebiet[] {
  return gebiete.filter((gebiet) => {
    const [obenLinks, , untenRechts] = gebiet.ecken;
    return (
      obenLinks[0] < ausschnitt.ost &&
      untenRechts[0] > ausschnitt.west &&
      untenRechts[1] < ausschnitt.nord &&
      obenLinks[1] > ausschnitt.sued
    );
  });
}

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

/** Kanal im Daten-Bild je Pilzart (Steinpilz Grün, Pfifferling Blau). */
export const KANAL_JE_PILZ: Readonly<Record<Pilzart, Pilzkanal>> = { steinpilz: 1, pfifferling: 2 };
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

function gpsZahl(wert: unknown, name: string): number {
  if (typeof wert !== "number" || !Number.isFinite(wert)) {
    throw new Error(`Invariante verletzt: GPS-Ereignis, ${name} ist keine Zahl: ${JSON.stringify(wert)}`);
  }
  return wert;
}

/**
 * Prüft das untypisierte GPS-Ereignis von MapLibre (ein GeolocationPosition des Browsers).
 * Die Werte des Browsers sind Getter am Prototyp und keine eigenen Eigenschaften: "in" findet sie, Object.entries nicht.
 */
export function standortAusGpsEreignis(ereignis: unknown): Standort {
  if (typeof ereignis === "object" && ereignis !== null && "coords" in ereignis && "timestamp" in ereignis) {
    const koordinaten = ereignis.coords;
    if (
      typeof koordinaten === "object" &&
      koordinaten !== null &&
      "latitude" in koordinaten &&
      "longitude" in koordinaten &&
      "accuracy" in koordinaten
    ) {
      return {
        breite: gpsZahl(koordinaten.latitude, "latitude"),
        laenge: gpsZahl(koordinaten.longitude, "longitude"),
        genauigkeitMeter: gpsZahl(koordinaten.accuracy, "accuracy"),
        zeitpunktMs: gpsZahl(ereignis.timestamp, "timestamp"),
      };
    }
  }
  throw new Error("Invariante verletzt: GPS-Ereignis ohne coords (latitude, longitude, accuracy) und timestamp");
}
