// Lädt die exportierten Gebietsdaten (Übersicht wie barnim/kacheln.json, Daten-PNG) vom eigenen Webserver und prüft sie.
// Kein Rate-Limit (eigene Dateien); Fehler werden mit Ursache weitergereicht.
import type { Ecke, Gebiet } from "../geo.ts";
import { tageswerteAusJson, type Tageswerte } from "../tageswerte.ts";

function zahl(wert: unknown, name: string): number {
  if (typeof wert !== "number" || !Number.isFinite(wert)) {
    throw new Error(`Invariante verletzt: Übersicht, ${name} ist keine Zahl`);
  }
  return wert;
}

function text(wert: unknown, name: string): string {
  if (typeof wert !== "string" || wert === "") {
    throw new Error(`Invariante verletzt: Übersicht, ${name} ist kein Text`);
  }
  return wert;
}

function eintrag(objekt: unknown, schluessel: string): unknown {
  if (typeof objekt !== "object" || objekt === null) {
    throw new Error(`Invariante verletzt: Übersicht, Objekt erwartet bei ${schluessel}`);
  }
  return Object.entries(objekt).find(([name]) => name === schluessel)?.[1];
}

function ecke(wert: unknown, name: string): Ecke {
  if (!Array.isArray(wert) || wert.length !== 2) {
    throw new Error(`Invariante verletzt: Übersicht, ${name} ist kein Koordinatenpaar`);
  }
  const paar: readonly unknown[] = wert;
  return [zahl(paar[0], `${name}[0]`), zahl(paar[1], `${name}[1]`)];
}

/** Prüft den Inhalt einer Übersicht wie barnim/kacheln.json (rein, ohne Netzwerk); `ordner` enthält die Dateien. */
export function gebieteAusJson(inhalt: unknown, ordner: string): Gebiet[] {
  if (!Array.isArray(inhalt) || inhalt.length === 0) {
    throw new Error("Invariante verletzt: Übersicht ist keine nicht-leere Liste");
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
      ordner,
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

/** Lädt die Übersicht `<ordner>/<datei>`; nur sie, die Daten-Bilder kommen einzeln mit ladeDatenbild. */
export async function ladeGebiete(ordner: string, datei: string): Promise<Gebiet[]> {
  const inhalt: unknown = await (await hole(`${ordner}/${datei}`)).json();
  return gebieteAusJson(inhalt, ordner);
}

/** Lädt die morgens vorberechneten Brennpunkte samt Wetter (scripts/tageswerte.ts). */
export async function ladeTageswerte(ordner: string): Promise<Tageswerte> {
  const inhalt: unknown = await (await hole(`${ordner}/tageswerte.json`)).json();
  return tageswerteAusJson(inhalt);
}

/** Lädt das Daten-PNG verlustfrei: ohne Farbraum-Umrechnung, damit Codes und Stufen exakt bleiben. */
export async function ladeDatenbild(gebiet: Gebiet): Promise<ImageData> {
  const bild = await createImageBitmap(await (await hole(`${gebiet.ordner}/${gebiet.name}.png`)).blob(), {
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
