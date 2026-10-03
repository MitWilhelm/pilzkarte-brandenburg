// Lädt die exportierten Gebietsdaten (gebiete.json, Daten-PNG) vom eigenen Webserver und prüft sie.
// Kein Rate-Limit (eigene Dateien); Fehler werden mit Ursache weitergereicht.
import type { Ecke, Gebiet } from "../geo.ts";

function zahl(wert: unknown, name: string): number {
  if (typeof wert !== "number" || !Number.isFinite(wert)) {
    throw new Error(`Invariante verletzt: gebiete.json, ${name} ist keine Zahl`);
  }
  return wert;
}

function text(wert: unknown, name: string): string {
  if (typeof wert !== "string" || wert === "") {
    throw new Error(`Invariante verletzt: gebiete.json, ${name} ist kein Text`);
  }
  return wert;
}

function eintrag(objekt: unknown, schluessel: string): unknown {
  if (typeof objekt !== "object" || objekt === null) {
    throw new Error(`Invariante verletzt: gebiete.json, Objekt erwartet bei ${schluessel}`);
  }
  return Object.entries(objekt).find(([name]) => name === schluessel)?.[1];
}

function ecke(wert: unknown, name: string): Ecke {
  if (!Array.isArray(wert) || wert.length !== 2) {
    throw new Error(`Invariante verletzt: gebiete.json, ${name} ist kein Koordinatenpaar`);
  }
  const paar: readonly unknown[] = wert;
  return [zahl(paar[0], `${name}[0]`), zahl(paar[1], `${name}[1]`)];
}

/** Prüft den Inhalt von gebiete.json (rein, ohne Netzwerk). */
export function gebieteAusJson(inhalt: unknown): Gebiet[] {
  if (!Array.isArray(inhalt) || inhalt.length === 0) {
    throw new Error("Invariante verletzt: gebiete.json ist keine nicht-leere Liste");
  }
  return inhalt.map((roh: unknown, nummer): Gebiet => {
    const ecken = eintrag(roh, "ecken");
    if (!Array.isArray(ecken) || ecken.length !== 4) {
      throw new Error(`Invariante verletzt: Gebiet ${String(nummer)} hat nicht vier Ecken`);
    }
    const liste: readonly unknown[] = ecken;
    return {
      name: text(eintrag(roh, "name"), "name"),
      anzeigename: text(eintrag(roh, "anzeigename"), "anzeigename"),
      mitte: ecke(eintrag(roh, "mitte"), "mitte"),
      breitePixel: zahl(eintrag(roh, "breitePixel"), "breitePixel"),
      hoehePixel: zahl(eintrag(roh, "hoehePixel"), "hoehePixel"),
      ecken: [ecke(liste[0], "ecken[0]"), ecke(liste[1], "ecken[1]"), ecke(liste[2], "ecken[2]"), ecke(liste[3], "ecken[3]")],
    };
  });
}

async function hole(url: string): Promise<Response> {
  let antwort: Response;
  try {
    antwort = await fetch(url);
  } catch (fehler) {
    throw new Error(`${url} nicht erreichbar`, { cause: fehler });
  }
  if (!antwort.ok) {
    throw new Error(`${url} antwortet mit Status ${String(antwort.status)}`);
  }
  return antwort;
}

export async function ladeGebiete(): Promise<Gebiet[]> {
  const inhalt: unknown = await (await hole("daten/gebiete.json")).json();
  return gebieteAusJson(inhalt);
}

/** Lädt das Daten-PNG verlustfrei: ohne Farbraum-Umrechnung, damit Codes und Stufen exakt bleiben. */
export async function ladeDatenbild(gebiet: Gebiet): Promise<ImageData> {
  const bild = await createImageBitmap(await (await hole(`daten/${gebiet.name}.png`)).blob(), {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });
  if (bild.width !== gebiet.breitePixel || bild.height !== gebiet.hoehePixel) {
    throw new Error(
      `Invariante verletzt: ${gebiet.name}.png ist ${String(bild.width)}x${String(bild.height)}, erwartet ${String(gebiet.breitePixel)}x${String(gebiet.hoehePixel)}`,
    );
  }
  const leinwand = new OffscreenCanvas(bild.width, bild.height);
  const zeichnung = leinwand.getContext("2d");
  if (zeichnung === null) {
    throw new Error("Invariante verletzt: kein 2D-Zeichenkontext verfügbar");
  }
  zeichnung.drawImage(bild, 0, 0);
  return zeichnung.getImageData(0, 0, bild.width, bild.height);
}
