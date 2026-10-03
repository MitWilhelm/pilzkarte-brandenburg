// Findet Brennpunkte: zusammenhängende Stellen mit sehr hoher Habitat-Stufe, die auf der Karte
// mit einem Ring markiert werden. Reine Funktion (kein I/O), arbeitet auf dem Daten-PNG eines Gebiets.
import { mercatorY, type Gebiet, type Pilzkanal } from "./geo.ts";

export type Hotspotart = "heute" | "letzte-tage";

export interface Hotspot {
  readonly laenge: number;
  readonly breite: number;
  readonly flaecheHektar: number;
}

export interface MarkierterHotspot extends Hotspot {
  readonly art: Hotspotart;
}

export interface Hotspotsuche {
  readonly daten: Uint8ClampedArray; // RGBA wie im Daten-PNG: R Baumart, G Steinpilz, B Pfifferling
  readonly kanal: Pilzkanal;
  readonly gebiet: Gebiet;
}

export const MIN_INDEX = 60; // Wachstumsindex "Günstig"
export const MIN_STUFE = 85; // Stufe in %, relativ zum Gebiet; "Gut" ab 80, "Sehr gut" ab 90
const KANAELE_PRO_PIXEL = 4;
const ZELLE_PIXEL = 10; // Daten-Pixel sind 10 m groß: eine Zelle ist 100 m x 100 m
const MIN_ANTEIL_HOCH = 0.5; // so viel Anteil einer Zelle muss MIN_STUFE erreichen
const MIN_ZELLEN = 3; // kleinere Flecken sind keine Empfehlung wert (~3 ha)
const HEKTAR_PRO_ZELLE = 1;
const GRAD_ZU_RAD = Math.PI / 180;
const NACHBARN: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
];

/** "heute": Index heute günstig. "letzte-tage": nur an einem der letzten Tage günstig (ältere, große Pilze möglich). */
export function hotspotart(indexHeute: number, hoechsterIndexLetzteTage: number): Hotspotart | null {
  if (indexHeute >= MIN_INDEX) {
    return "heute";
  }
  return hoechsterIndexLetzteTage >= MIN_INDEX ? "letzte-tage" : null;
}

function istHeisseZelle(suche: Hotspotsuche, zelleX: number, zelleY: number): boolean {
  const { daten, kanal, gebiet } = suche;
  let treffer = 0;
  let gesamt = 0;
  for (let zeile = zelleY * ZELLE_PIXEL; zeile < Math.min((zelleY + 1) * ZELLE_PIXEL, gebiet.hoehePixel); zeile += 1) {
    for (let spalte = zelleX * ZELLE_PIXEL; spalte < Math.min((zelleX + 1) * ZELLE_PIXEL, gebiet.breitePixel); spalte += 1) {
      const wert = daten[(zeile * gebiet.breitePixel + spalte) * KANAELE_PRO_PIXEL + kanal];
      if (wert === undefined) {
        throw new Error(`Invariante verletzt: Pixel ${String(spalte)}/${String(zeile)} außerhalb der Daten`);
      }
      gesamt += 1;
      if (wert >= MIN_STUFE) {
        treffer += 1;
      }
    }
  }
  return treffer / gesamt >= MIN_ANTEIL_HOCH;
}

/** Koordinate (Länge, Breite) der Bildmitte eines Pixels; Umkehrung von pixelAnStelle. */
export function koordinateAnPixel(gebiet: Gebiet, spalte: number, zeile: number): readonly [number, number] {
  const [obenLinks, , untenRechts] = gebiet.ecken;
  const laenge = obenLinks[0] + ((spalte + 0.5) / gebiet.breitePixel) * (untenRechts[0] - obenLinks[0]);
  const mercatorOben = mercatorY(obenLinks[1]);
  const mercatorUnten = mercatorY(untenRechts[1]);
  const mercator = mercatorOben - ((zeile + 0.5) / gebiet.hoehePixel) * (mercatorOben - mercatorUnten);
  const breite = (2 * Math.atan(Math.exp(mercator)) - Math.PI / 2) / GRAD_ZU_RAD;
  return [laenge, breite];
}

export function findeHotspots(suche: Hotspotsuche): Hotspot[] {
  const { gebiet } = suche;
  const zellenBreit = Math.ceil(gebiet.breitePixel / ZELLE_PIXEL);
  const zellenHoch = Math.ceil(gebiet.hoehePixel / ZELLE_PIXEL);
  const heiss = new Set<number>();
  for (let zelleY = 0; zelleY < zellenHoch; zelleY += 1) {
    for (let zelleX = 0; zelleX < zellenBreit; zelleX += 1) {
      if (istHeisseZelle(suche, zelleX, zelleY)) {
        heiss.add(zelleY * zellenBreit + zelleX);
      }
    }
  }
  const besucht = new Set<number>();
  const hotspots: Hotspot[] = [];
  for (const start of heiss) {
    if (besucht.has(start)) {
      continue;
    }
    const zellen: number[] = [];
    const offen = [start];
    besucht.add(start);
    for (let naechste = offen.pop(); naechste !== undefined; naechste = offen.pop()) {
      zellen.push(naechste);
      const zelleX = naechste % zellenBreit;
      const zelleY = Math.floor(naechste / zellenBreit);
      for (const [dx, dy] of NACHBARN) {
        const nachbarX = zelleX + dx;
        const nachbarY = zelleY + dy;
        const nachbar = nachbarY * zellenBreit + nachbarX;
        const isImBild = nachbarX >= 0 && nachbarX < zellenBreit && nachbarY >= 0 && nachbarY < zellenHoch;
        if (isImBild && heiss.has(nachbar) && !besucht.has(nachbar)) {
          besucht.add(nachbar);
          offen.push(nachbar);
        }
      }
    }
    if (zellen.length < MIN_ZELLEN) {
      continue;
    }
    const mitteX = zellen.reduce((summe, zelle) => summe + (zelle % zellenBreit) + 0.5, 0) / zellen.length;
    const mitteY = zellen.reduce((summe, zelle) => summe + Math.floor(zelle / zellenBreit) + 0.5, 0) / zellen.length;
    const [laenge, breite] = koordinateAnPixel(gebiet, mitteX * ZELLE_PIXEL - 0.5, mitteY * ZELLE_PIXEL - 0.5);
    hotspots.push({ laenge, breite, flaecheHektar: zellen.length * HEKTAR_PRO_ZELLE });
  }
  return hotspots.sort((a, b) => b.flaecheHektar - a.flaecheHektar);
}
