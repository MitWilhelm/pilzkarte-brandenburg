// Tageswerte: Brennpunkte mit Wetter, morgens einmal vorberechnet (scripts/tageswerte.ts), und die Auswahl der
// Top-Sammelplätze. Reine Funktionen ohne I/O; dieselben Regeln gelten im Browser und im Vorberechnungs-Lauf.
import { abstandMeter } from "./geo.ts";
import { hotspotart, type Hotspotart } from "./hotspots.ts";
import { tagesindex, type Pilzart, type Tageswetter } from "./wachstum.ts";

export const TAGE_RUECKBLICK = 7; // so weit zurück zählt ein günstiger Index für ältere, große Pilze
const WETTER_RASTER_GRAD = 0.02; // ~2 km: nahe Punkte teilen sich einen Wetterabruf
// Tipps sollen verschiedene Orte zeigen: Große Flächen werden an Kachelgrenzen geteilt und liegen dann als zwei
// Brennpunkte wenige km auseinander. Ein Brennpunkt näher als das an einem besseren Tipp zählt als derselbe Ort.
const MINDESTABSTAND_TIPPS_METER = 3000;

/** Ein Brennpunkt mit Wetterbewertung, so wie er in tageswerte.json steht. */
export interface Tagesbrennpunkt {
  readonly gebietName: string;
  readonly laenge: number;
  readonly breite: number;
  readonly flaecheHektar: number;
  readonly zellen: readonly number[];
  readonly art: Hotspotart;
  readonly indexHeute: number;
}

export interface Tageswerte {
  readonly erstellt: string; // ISO-Zeitpunkt der Berechnung
  readonly steinpilz: readonly Tagesbrennpunkt[];
  readonly pfifferling: readonly Tagesbrennpunkt[];
}

export interface Brennpunktbewertung {
  readonly art: Hotspotart | null;
  readonly indexHeute: number;
}

/** Farbe eines Brennpunkts aus dem Wetter an seiner Stelle: heute günstig, nur in den letzten Tagen, oder keine. */
export function brennpunktArt(tage: readonly Tageswetter[], heute: number, pilz: Pilzart): Brennpunktbewertung {
  const indizes: number[] = [];
  for (let position = Math.max(0, heute - TAGE_RUECKBLICK); position <= heute; position += 1) {
    indizes.push(tagesindex(tage, position, pilz).index);
  }
  const indexHeute = indizes[indizes.length - 1];
  if (indexHeute === undefined) {
    throw new Error(`Invariante verletzt: keine Indexwerte für den Rückblick bis Position ${String(heute)}`);
  }
  return { art: hotspotart(indexHeute, Math.max(...indizes)), indexHeute };
}

/** Schlüssel der Wetter-Rasterzelle (~2 km), damit nahe Stellen sich einen Abruf teilen. */
export function wetterSchluessel(breite: number, laenge: number): string {
  const runden = (wert: number): string => (Math.round(wert / WETTER_RASTER_GRAD) * WETTER_RASTER_GRAD).toFixed(2);
  return `${runden(breite)},${runden(laenge)}`;
}

function rangvergleich(a: Tagesbrennpunkt, b: Tagesbrennpunkt): number {
  const artA = a.art === "heute" ? 0 : 1;
  const artB = b.art === "heute" ? 0 : 1;
  if (artA !== artB) {
    return artA - artB;
  }
  if (a.flaecheHektar !== b.flaecheHektar) {
    return b.flaecheHektar - a.flaecheHektar;
  }
  return b.indexHeute - a.indexHeute;
}

/**
 * Die besten Sammelplätze: zuerst Flächen, die heute wachsen (türkis), dann solche der letzten Tage (pink);
 * innerhalb davon die größte zusammenhängende Fläche, bei Gleichstand der höhere Index. Brennpunkte näher als
 * MINDESTABSTAND_TIPPS_METER an einem besseren Tipp zählen als derselbe Ort.
 */
export function topSammelplaetze(punkte: readonly Tagesbrennpunkt[], anzahl: number): Tagesbrennpunkt[] {
  const auswahl: Tagesbrennpunkt[] = [];
  for (const punkt of [...punkte].sort(rangvergleich)) {
    const isDoppelt = auswahl.some(
      (gewaehlt) => abstandMeter([gewaehlt.laenge, gewaehlt.breite], [punkt.laenge, punkt.breite]) < MINDESTABSTAND_TIPPS_METER,
    );
    if (!isDoppelt) {
      auswahl.push(punkt);
    }
    if (auswahl.length === anzahl) {
      break;
    }
  }
  return auswahl;
}

function zahl(wert: unknown, name: string): number {
  if (typeof wert !== "number" || !Number.isFinite(wert)) {
    throw new Error(`Invariante verletzt: tageswerte.json, ${name} ist keine Zahl`);
  }
  return wert;
}

function eintrag(objekt: unknown, schluessel: string): unknown {
  if (typeof objekt !== "object" || objekt === null) {
    throw new Error(`Invariante verletzt: tageswerte.json, Objekt erwartet bei ${schluessel}`);
  }
  return Object.entries(objekt).find(([name]) => name === schluessel)?.[1];
}

function brennpunkte(liste: unknown, pilz: Pilzart): Tagesbrennpunkt[] {
  if (!Array.isArray(liste)) {
    throw new Error(`Invariante verletzt: tageswerte.json, ${pilz} ist keine Liste`);
  }
  return liste.map((roh: unknown): Tagesbrennpunkt => {
    const art = eintrag(roh, "art");
    if (art !== "heute" && art !== "letzte-tage") {
      throw new Error(`Invariante verletzt: tageswerte.json, unbekannte Art ${String(art)}`);
    }
    const gebietName = eintrag(roh, "gebietName");
    const zellen = eintrag(roh, "zellen");
    if (typeof gebietName !== "string" || !Array.isArray(zellen)) {
      throw new Error("Invariante verletzt: tageswerte.json, Brennpunkt ohne gebietName oder zellen");
    }
    const zellListe: readonly unknown[] = zellen;
    return {
      gebietName,
      laenge: zahl(eintrag(roh, "laenge"), "laenge"),
      breite: zahl(eintrag(roh, "breite"), "breite"),
      flaecheHektar: zahl(eintrag(roh, "flaecheHektar"), "flaecheHektar"),
      zellen: zellListe.map((zelle) => zahl(zelle, "zellen[]")),
      art,
      indexHeute: zahl(eintrag(roh, "indexHeute"), "indexHeute"),
    };
  });
}

/** Prüft den Inhalt von tageswerte.json (rein, ohne Netzwerk). */
export function tageswerteAusJson(inhalt: unknown): Tageswerte {
  const erstellt = eintrag(inhalt, "erstellt");
  if (typeof erstellt !== "string" || Number.isNaN(Date.parse(erstellt))) {
    throw new Error("Invariante verletzt: tageswerte.json ohne gültigen Zeitpunkt 'erstellt'");
  }
  return {
    erstellt,
    steinpilz: brennpunkte(eintrag(inhalt, "steinpilz"), "steinpilz"),
    pfifferling: brennpunkte(eintrag(inhalt, "pfifferling"), "pfifferling"),
  };
}
