// Findet Brennpunkte: zusammenhängende Stellen mit sehr hoher Habitat-Stufe, die auf der Karte als
// farbige Fläche markiert werden. Reine Funktion (kein I/O), arbeitet auf dem Daten-PNG eines Gebiets.
import { mercatorY, type Gebiet, type Pilzkanal, type Pixel } from "./geo.ts";

export type Hotspotart = "heute" | "letzte-tage";

export type Strecke = readonly [readonly [number, number], readonly [number, number]];

export interface Hotspot {
  // Ankerpunkt für Wetterabruf und Zoom: die Zelle der Fläche, die ihrem Schwerpunkt am nächsten liegt.
  // Der Schwerpunkt selbst kann bei verwinkelten Flächen außerhalb liegen (gefunden an 52.9956, 13.7105).
  readonly laenge: number;
  readonly breite: number;
  readonly flaecheHektar: number;
  readonly umriss: readonly Strecke[]; // Außenkanten der Zellen (Länge, Breite), ohne innere Linien
  readonly gebietName: string;
  readonly zellen: readonly number[]; // Zellennummer = Zeile * Zellen je Zeile + Spalte (100-m-Zellen)
}

export interface MarkierterHotspot extends Hotspot {
  readonly art: Hotspotart;
}

/** Was das Einfärben braucht; erfüllt von MarkierterHotspot (live) und Tagesbrennpunkt (tageswerte.json). */
export interface Brennpunktflaeche {
  readonly gebietName: string;
  readonly zellen: readonly number[];
  readonly art: Hotspotart;
}

/** Beste kleine Teilfläche eines Brennpunkts (höchstens 10 ha), Ziel einer Tipp-Markierung. */
export interface Kern {
  readonly laenge: number;
  readonly breite: number;
  readonly flaecheHektar: number;
  readonly mittlereStufe: number;
  readonly ecken: readonly (readonly [number, number])[]; // Umriss (Länge, Breite): oben links, oben rechts, unten rechts, unten links
}

export interface Hotspotsuche {
  readonly daten: Uint8ClampedArray; // RGBA wie im Daten-PNG: R Baumart, G Steinpilz, B Pfifferling
  readonly kanal: Pilzkanal;
  readonly gebiet: Gebiet;
}

export const MIN_INDEX = 60; // Wachstumsindex "Günstig"
export const MIN_STUFE = 85; // Stufe in %, relativ zum Gebiet; "Gut" ab 80, "Sehr gut" ab 90
const KANAELE_PRO_PIXEL = 4;
const DECKKRAFT_KANAL = 3; // A in RGBA
const ZELLE_PIXEL = 10; // Daten-Pixel sind 10 m groß: eine Zelle ist 100 m x 100 m
const MIN_ANTEIL_HOCH = 0.5; // so viel Anteil einer Zelle muss MIN_STUFE erreichen
const MIN_ZELLEN = 3; // kleinere Flecken sind keine Empfehlung wert (~3 ha)
const HEKTAR_PRO_ZELLE = 1;
// 3 x 3 Zellen à 1 ha = 9 ha: Der Nutzer wünscht Tipps von höchstens 10 ha statt ganzer Brennpunkte (bis ~600 ha).
const KERN_KANTE_ZELLEN = 3;
// Signalfarben, die sonst nirgends auf der Karte vorkommen: türkis = heute günstig, pink = nur letzte Tage günstig.
const FARBE_JE_ART: Readonly<Record<Hotspotart, readonly [number, number, number]>> = {
  heute: [0, 229, 255],
  "letzte-tage": [255, 43, 214],
};
const GRAU: readonly [number, number, number] = [150, 155, 150];
const BRENNPUNKT_DECKKRAFT = 235; // fast deckend, damit die Fläche auch auf dem Handy in der Sonne heraussticht
const GRAD_ZU_RAD = Math.PI / 180;
const NACHBARN: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
];
// Je Kante der Zelle: Nachbar in dieser Richtung und Eckpunkte (in Zellen, relativ zur oberen linken Ecke).
const KANTEN: readonly { readonly dx: number; readonly dy: number; readonly von: readonly [number, number]; readonly bis: readonly [number, number] }[] = [
  { dx: 0, dy: -1, von: [0, 0], bis: [1, 0] },
  { dx: 1, dy: 0, von: [1, 0], bis: [1, 1] },
  { dx: 0, dy: 1, von: [0, 1], bis: [1, 1] },
  { dx: -1, dy: 0, von: [0, 0], bis: [0, 1] },
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

function eckeAnZelle(gebiet: Gebiet, eckeX: number, eckeY: number): readonly [number, number] {
  // koordinateAnPixel rechnet mit Pixelmitten, daher -0,5; Randzellen sind am Bildrand abgeschnitten.
  const spalte = Math.min(eckeX * ZELLE_PIXEL, gebiet.breitePixel) - 0.5;
  const zeile = Math.min(eckeY * ZELLE_PIXEL, gebiet.hoehePixel) - 0.5;
  return koordinateAnPixel(gebiet, spalte, zeile);
}

function umrissDerZellen(gebiet: Gebiet, zellen: ReadonlySet<number>, zellenBreit: number): Strecke[] {
  const strecken: Strecke[] = [];
  for (const zelle of zellen) {
    const zelleX = zelle % zellenBreit;
    const zelleY = Math.floor(zelle / zellenBreit);
    for (const kante of KANTEN) {
      const nachbarX = zelleX + kante.dx;
      const isNachbarInFlaeche = nachbarX >= 0 && nachbarX < zellenBreit && zellen.has((zelleY + kante.dy) * zellenBreit + nachbarX);
      if (!isNachbarInFlaeche) {
        strecken.push([
          eckeAnZelle(gebiet, zelleX + kante.von[0], zelleY + kante.von[1]),
          eckeAnZelle(gebiet, zelleX + kante.bis[0], zelleY + kante.bis[1]),
        ]);
      }
    }
  }
  return strecken;
}

function naechsteZelleZumSchwerpunkt(zellen: readonly number[], zellenBreit: number): number {
  const mitteX = zellen.reduce((summe, zelle) => summe + (zelle % zellenBreit), 0) / zellen.length;
  const mitteY = zellen.reduce((summe, zelle) => summe + Math.floor(zelle / zellenBreit), 0) / zellen.length;
  let beste = zellen[0];
  if (beste === undefined) {
    throw new Error("Invariante verletzt: Fläche ohne Zellen");
  }
  let besterAbstand = Number.POSITIVE_INFINITY;
  for (const zelle of zellen) {
    const abstand = ((zelle % zellenBreit) - mitteX) ** 2 + (Math.floor(zelle / zellenBreit) - mitteY) ** 2;
    if (abstand < besterAbstand) {
      beste = zelle;
      besterAbstand = abstand;
    }
  }
  return beste;
}

function mittlereStufeDerZelle(suche: Hotspotsuche, zelleX: number, zelleY: number): number {
  const { daten, kanal, gebiet } = suche;
  let summe = 0;
  let anzahl = 0;
  for (let zeile = zelleY * ZELLE_PIXEL; zeile < Math.min((zelleY + 1) * ZELLE_PIXEL, gebiet.hoehePixel); zeile += 1) {
    for (let spalte = zelleX * ZELLE_PIXEL; spalte < Math.min((zelleX + 1) * ZELLE_PIXEL, gebiet.breitePixel); spalte += 1) {
      const wert = daten[(zeile * gebiet.breitePixel + spalte) * KANAELE_PRO_PIXEL + kanal];
      if (wert === undefined) {
        throw new Error(`Invariante verletzt: Pixel ${String(spalte)}/${String(zeile)} außerhalb der Daten`);
      }
      summe += wert;
      anzahl += 1;
    }
  }
  return summe / anzahl;
}

/**
 * Das Quadrat aus KERN_KANTE_ZELLEN² Zellen (9 ha) ganz innerhalb des Brennpunkts mit der höchsten mittleren
 * Stufe; ist die Fläche dafür zu schmal, die beste einzelne Zelle (1 ha).
 */
export function besterKern(suche: Hotspotsuche, zellen: readonly number[]): Kern {
  const { gebiet } = suche;
  const zellenBreit = Math.ceil(gebiet.breitePixel / ZELLE_PIXEL);
  const mittel = new Map(zellen.map((zelle) => [zelle, mittlereStufeDerZelle(suche, zelle % zellenBreit, Math.floor(zelle / zellenBreit))]));
  let bester: { readonly links: number; readonly oben: number; readonly kante: number; readonly mittel: number } | null = null;
  for (const kante of [KERN_KANTE_ZELLEN, 1]) {
    for (const zelle of zellen) {
      const links = zelle % zellenBreit;
      const oben = Math.floor(zelle / zellenBreit);
      let summe = 0;
      let isVoll = links + kante <= zellenBreit;
      for (let dy = 0; dy < kante && isVoll; dy += 1) {
        for (let dx = 0; dx < kante && isVoll; dx += 1) {
          const wert = mittel.get((oben + dy) * zellenBreit + links + dx);
          if (wert === undefined) {
            isVoll = false;
          } else {
            summe += wert;
          }
        }
      }
      const durchschnitt = summe / (kante * kante);
      if (isVoll && (bester === null || durchschnitt > bester.mittel)) {
        bester = { links, oben, kante, mittel: durchschnitt };
      }
    }
    if (bester !== null) {
      break;
    }
  }
  if (bester === null) {
    throw new Error("Invariante verletzt: Brennpunkt ohne Zellen für einen Kern");
  }
  const { links, oben, kante } = bester;
  const [laenge, breite] = eckeAnZelle(gebiet, links + kante / 2, oben + kante / 2);
  return {
    laenge,
    breite,
    flaecheHektar: kante * kante * HEKTAR_PRO_ZELLE,
    mittlereStufe: Math.round(bester.mittel),
    ecken: [
      eckeAnZelle(gebiet, links, oben),
      eckeAnZelle(gebiet, links + kante, oben),
      eckeAnZelle(gebiet, links + kante, oben + kante),
      eckeAnZelle(gebiet, links, oben + kante),
    ],
  };
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
    const anker = naechsteZelleZumSchwerpunkt(zellen, zellenBreit);
    const ankerX = ((anker % zellenBreit) + 0.5) * ZELLE_PIXEL - 0.5;
    const ankerY = (Math.floor(anker / zellenBreit) + 0.5) * ZELLE_PIXEL - 0.5;
    const [laenge, breite] = koordinateAnPixel(gebiet, ankerX, ankerY);
    const umriss = umrissDerZellen(gebiet, new Set(zellen), zellenBreit);
    hotspots.push({ laenge, breite, flaecheHektar: zellen.length * HEKTAR_PRO_ZELLE, umriss, gebietName: gebiet.name, zellen });
  }
  return hotspots.sort((a, b) => b.flaecheHektar - a.flaecheHektar);
}

/**
 * Ansicht "Brennpunkte": gefärbte Pixel in den Flächen dieses Gebiets bekommen die Signalfarbe ihrer Art
 * (ganze Fläche statt Umriss), alle übrigen gefärbten Pixel werden grau. Durchsichtige Pixel bleiben durchsichtig.
 */
export function faerbeBrennpunkte(
  farben: Uint8ClampedArray<ArrayBuffer>,
  gebiet: Gebiet,
  brennpunkte: readonly Brennpunktflaeche[],
): Uint8ClampedArray<ArrayBuffer> {
  if (farben.length !== gebiet.breitePixel * gebiet.hoehePixel * KANAELE_PRO_PIXEL) {
    throw new Error(`Invariante verletzt: ${String(farben.length)} Bytes passen nicht zum Gebiet ${gebiet.name}`);
  }
  const zellenBreit = Math.ceil(gebiet.breitePixel / ZELLE_PIXEL);
  const artJeZelle = new Map<number, Hotspotart>();
  for (const punkt of brennpunkte) {
    if (punkt.gebietName === gebiet.name) {
      for (const zelle of punkt.zellen) {
        artJeZelle.set(zelle, punkt.art);
      }
    }
  }
  const ergebnis = new Uint8ClampedArray(farben);
  for (let zeile = 0; zeile < gebiet.hoehePixel; zeile += 1) {
    for (let spalte = 0; spalte < gebiet.breitePixel; spalte += 1) {
      const start = (zeile * gebiet.breitePixel + spalte) * KANAELE_PRO_PIXEL;
      if (ergebnis[start + DECKKRAFT_KANAL] === 0) {
        continue;
      }
      const art = artJeZelle.get(Math.floor(zeile / ZELLE_PIXEL) * zellenBreit + Math.floor(spalte / ZELLE_PIXEL));
      const [rot, gruen, blau] = art === undefined ? GRAU : FARBE_JE_ART[art];
      ergebnis[start] = rot;
      ergebnis[start + 1] = gruen;
      ergebnis[start + 2] = blau;
      if (art !== undefined) {
        ergebnis[start + DECKKRAFT_KANAL] = BRENNPUNKT_DECKKRAFT;
      }
    }
  }
  return ergebnis;
}

/** Die Fläche, die dieses Daten-Pixel eines Gebiets enthält, oder null. */
export function flaecheAnStelle(gebiet: Gebiet, pixel: Pixel, flaechen: readonly Hotspot[]): Hotspot | null {
  const zellenBreit = Math.ceil(gebiet.breitePixel / ZELLE_PIXEL);
  const zelle = Math.floor(pixel.zeile / ZELLE_PIXEL) * zellenBreit + Math.floor(pixel.spalte / ZELLE_PIXEL);
  return flaechen.find((flaeche) => flaeche.gebietName === gebiet.name && flaeche.zellen.includes(zelle)) ?? null;
}
