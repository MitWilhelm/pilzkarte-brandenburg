// Einstieg der Webseite: baut die Karte, lädt die 10-km-Kacheln erst, wenn sie ins Bild kommen, und verbindet
// Bedienung, Wetter und Tafel.
import * as maplibregl from "maplibre-gl";
import {
  bodenAnPunkt,
  erzeugeKarte,
  fuegeEbenenHinzu,
  folgeFarbschema,
  zeigeBodengrenzen,
  fuegeKnopfHinzu,
  richteGpsEin,
  zeigeHeatmap,
  erzeugeTipps,
  zeigeRandverlauf,
  begrenzeKarte,
  fuegeVorschauHinzu,
  fuegeDetailsHinzu,
  hatDetails,
  entferneVorschau,
  type Kartenebene,
  type Tippmarke,
  type Tippsatz,
} from "./karte.ts";
import { findeHotspots, type Brennpunktflaeche, type Hotspot, type Hotspotart, type MarkierterHotspot } from "./hotspots.ts";
import { brennpunktArt, topSammelplaetze, wetterSchluessel, type Tagesbrennpunkt, type Tageswerte } from "./tageswerte.ts";
import { abstandMeter, baumartName, gebieteImAusschnitt, KANAL_JE_PILZ, pixelAnStelle, stufeninfo, type Gebiet } from "./geo.ts";
import { ladeDatenbild, ladeGebiete, ladeGrenze, ladeTageswerte } from "./clients/daten.ts";
import { richteMeldenEin } from "./melden.ts";
import { ladeanteil, ladetext } from "./laden.ts";
import { sendeAnWorker } from "./clients/meldeserver.ts";
import { ladeWetter, type Wetterreihe } from "./clients/openmeteo.ts";
import { indexverlauf, tagesindex, type Pilzart } from "./wachstum.ts";
import {
  element,
  fuelleLegende,
  istTafelOffen,
  schalteLegende,
  schalteTafel,
  schalteDetails,
  schliessePunkt,
  sindDetailsOffen,
  zeigeIndex,
  zeigeGpsHinweis,
  zeigeIndexFehler,
  zeigeVersion,
  zeigeLadehinweis,
  zeigeLadefortschritt,
  beendeLadeschleier,
  zeigePunkt,
  zeigePunktwetter,
  zeigePunktwetterFehler,
} from "./ansicht.ts";
import { richteTutorialEin } from "./tutorialansicht.ts";

const KANAELE_PRO_PIXEL = 4;
const ANZAHL_TIPPS = 5;
const STAND_FORMAT = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const PILZNAMEN: Readonly<Record<Pilzart, string>> = { steinpilz: "Steinpilz", pfifferling: "Pfifferling", edelreizker: "Edelreizker" };
const KACHEL_ORDNER = "daten/barnim";
const KACHEL_UEBERSICHT = "kacheln.json";
const VORSCHAU_UEBERSICHT = "vorschau.json";
const MASKE_UEBERSICHT = "maske.json";
// Alle Kacheln (zusammen ~8 MB) kommen nach dem Start nacheinander im Hintergrund, die nächsten zur Kartenmitte zuerst;
// bis dahin zeigt die grobe Vorschau den ganzen Barnim.
const GLEICHZEITIG_LADEN = 3;
// Boden und Wege (zusammen 17 MB für den ganzen Barnim) erst ab diesem Zoom und nur für Kacheln im Bild.
const DETAILS_AB_ZOOM = 11;
const START_MITTE: readonly [number, number] = [13.8199, 52.8337]; // Eberswalde [Länge, Breite]
/** Ort, für den der Index oben gilt: GPS-Standort oder Kartenmitte. */
interface Indexort {
  readonly name: string;
  readonly breite: number;
  readonly laenge: number;
}

interface Zustand {
  pilz: Pilzart;
  indexOrt: Indexort;
  hasGps: boolean; // sobald ein GPS-Standort kam, gilt der Index für ihn statt für die Kartenmitte
  markierung: maplibregl.Marker | null;
  letzterTipp: maplibregl.MapMouseEvent | null; // für Neubewertung beim Wechsel der Pilzart
  isBrennpunkteAn: boolean; // Knopf: Brennpunkt-Flächen türkis/pink, übrige Heatmap grau
  brennpunkte: readonly Brennpunktflaeche[]; // zuletzt markierte Flächen der gewählten Pilzart
  vorschau: Kartenebene | null; // grobe Ebene des ganzen Barnims, bis alle Kacheln im Detail geladen sind
  tageswerte: Tageswerte | null; // morgens vorberechnet; null: Brennpunkte werden live mit Wetter bewertet
  isTageswerteGeprueft: boolean; // false, solange tageswerte.json noch lädt (dann keine Live-Bewertung starten)
}

const wetterSpeicher = new Map<string, Promise<Wetterreihe>>();

function wetterFuer(breite: number, laenge: number): Promise<Wetterreihe> {
  const schluessel = wetterSchluessel(breite, laenge);
  const vorhanden = wetterSpeicher.get(schluessel);
  if (vorhanden !== undefined) {
    return vorhanden;
  }
  const neu = ladeWetter(breite, laenge);
  wetterSpeicher.set(schluessel, neu);
  neu.catch(() => wetterSpeicher.delete(schluessel));
  return neu;
}

function fehlertext(fehler: unknown): string {
  return fehler instanceof Error ? fehler.message : String(fehler);
}

async function aktualisiereIndex(zustand: Zustand): Promise<void> {
  const { indexOrt, pilz } = zustand;
  element("index-ort", HTMLElement).textContent = indexOrt.name;
  try {
    const reihe = await wetterFuer(indexOrt.breite, indexOrt.laenge);
    if (zustand.indexOrt === indexOrt && zustand.pilz === pilz) {
      zeigeIndex(indexOrt.name, indexverlauf(reihe.tage, reihe.heute, pilz));
    }
  } catch (fehler) {
    zeigeIndexFehler(fehlertext(fehler));
  }
}

/** Art (Farbe) eines Brennpunkts aus dem Wetter an seiner Stelle (heute bzw. letzte 7 Tage) oder null. */
async function ringart(hotspot: Hotspot, pilz: Pilzart): Promise<Hotspotart | null> {
  const reihe = await wetterFuer(hotspot.breite, hotspot.laenge);
  return brennpunktArt(reihe.tage, reihe.heute, pilz).art;
}

async function indexHeuteAn(breite: number, laenge: number, pilz: Pilzart): Promise<number> {
  const reihe = await wetterFuer(breite, laenge);
  return tagesindex(reihe.tage, reihe.heute, pilz).index;
}

function zeigeAnsicht(karte: maplibregl.Map, ebenen: readonly Kartenebene[], zustand: Zustand): void {
  zeigeHeatmap(karte, zustand.vorschau === null ? ebenen : [zustand.vorschau, ...ebenen], { kanal: KANAL_JE_PILZ[zustand.pilz], brennpunkte: zustand.isBrennpunkteAn ? zustand.brennpunkte : null });
}

/**
 * Brennpunkte der geladenen Kacheln: aus tageswerte.json (morgens vorberechnet, keine Wetterabrufe) oder, wenn die
 * Datei fehlt, live mit dem Wetter je Fläche; nahe Stellen teilen sich dann einen Abruf (wetterSchluessel).
 */
async function aktualisiereHotspots(karte: maplibregl.Map, ebenen: readonly Kartenebene[], zustand: Zustand): Promise<void> {
  if (!zustand.isTageswerteGeprueft) {
    return; // tageswerte.json lädt noch; danach ruft start() diese Funktion erneut auf
  }
  const pilz = zustand.pilz;
  if (zustand.tageswerte !== null) {
    const geladen = new Set(ebenen.map((ebene) => ebene.gebiet.name));
    zustand.brennpunkte = zustand.tageswerte[pilz].filter((punkt) => geladen.has(punkt.gebietName));
    if (zustand.isBrennpunkteAn) {
      zeigeAnsicht(karte, ebenen, zustand);
    }
    return;
  }
  const kandidaten = ebenen.flatMap(({ gebiet, daten }) => findeHotspots({ daten: daten.data, kanal: KANAL_JE_PILZ[pilz], gebiet }));
  const markiert = await Promise.all(
    kandidaten.map(async (hotspot): Promise<MarkierterHotspot | null> => {
      try {
        const art = await ringart(hotspot, pilz);
        return art === null ? null : { ...hotspot, art };
      } catch {
        // Ohne Wetter kein Index und keine Brennpunkt-Farbe an dieser Stelle; den Fehler zeigt aktualisiereIndex schon an.
        return null;
      }
    }),
  );
  if (zustand.pilz !== pilz) {
    return; // inzwischen andere Pilzart gewählt; deren Suche zeichnet selbst
  }
  zustand.brennpunkte = markiert.filter((eintrag): eintrag is MarkierterHotspot => eintrag !== null);
  if (zustand.isBrennpunkteAn) {
    zeigeAnsicht(karte, ebenen, zustand);
  }
}

async function zeigeStelle(karte: maplibregl.Map, ebenen: readonly Kartenebene[], zustand: Zustand, ereignis: maplibregl.MapMouseEvent): Promise<void> {
  const { lng, lat } = ereignis.lngLat;
  const treffer = ebenen
    .map((ebene) => ({ ebene, pixel: pixelAnStelle(ebene.gebiet, lng, lat) }))
    .find((kandidat) => kandidat.pixel !== null);
  if (treffer?.pixel == null) {
    return;
  }
  const { ebene, pixel } = treffer;
  const start = (pixel.zeile * ebene.daten.width + pixel.spalte) * KANAELE_PRO_PIXEL;
  const baumIndex = ebene.daten.data[start];
  const stufe = ebene.daten.data[start + KANAL_JE_PILZ[zustand.pilz]];
  if (baumIndex === undefined || stufe === undefined) {
    throw new Error(`Invariante verletzt: Pixel ${String(pixel.spalte)}/${String(pixel.zeile)} außerhalb der Daten`);
  }
  zustand.letzterTipp = ereignis;
  zustand.markierung?.remove();
  zustand.markierung = new maplibregl.Marker({ color: "#e8a42a" }).setLngLat([lng, lat]).addTo(karte);
  zeigePunkt({
    breite: lat,
    laenge: lng,
    stufe,
    stufenname: stufeninfo(stufe)?.name ?? null,
    baumart: baumartName(baumIndex),
    // Bildschirmpunkt neu berechnen: die Karte kann seit dem Tipp ihre Größe geändert haben.
    boden: bodenAnPunkt(karte, karte.project([lng, lat]), ebene.gebiet),
    pilzName: PILZNAMEN[zustand.pilz],
  });
  try {
    const reihe = await wetterFuer(lat, lng);
    zeigePunktwetter(reihe.tage, reihe.heute, indexverlauf(reihe.tage, reihe.heute, zustand.pilz));
  } catch (fehler) {
    zeigePunktwetterFehler(fehlertext(fehler));
  }
}

/** Alles, was das Nachladen der Kacheln braucht; `ebenen` und `angefragt` wachsen mit jeder geladenen Kachel. */
interface Kachellader {
  readonly karte: maplibregl.Map;
  readonly alle: readonly Gebiet[];
  readonly ebenen: Kartenebene[];
  readonly angefragt: Set<string>;
  readonly mitDetails: Set<string>; // Kacheln, deren Boden und Wege schon eingefügt oder angefragt sind
}

/** Lädt die angegebenen Kacheln, soweit noch nicht angefragt; eine fehlgeschlagene wird später erneut versucht. */
async function ladeKacheln(lader: Kachellader, zustand: Zustand, gebiete: readonly Gebiet[]): Promise<void> {
  const { karte, ebenen, angefragt } = lader;
  const neu = gebiete.filter((gebiet) => !angefragt.has(gebiet.name));
  for (const gebiet of neu) {
    angefragt.add(gebiet.name);
  }
  const geladen = await Promise.all(
    neu.map(async (gebiet): Promise<Kartenebene | null> => {
      try {
        return { gebiet, daten: await ladeDatenbild(gebiet) };
      } catch (fehler) {
        angefragt.delete(gebiet.name);
        zeigeLadehinweis(`Ein Kartenteil konnte nicht geladen werden (${fehlertext(fehler)}). Karte verschieben zum erneuten Versuch.`);
        return null;
      }
    }),
  );
  const ebenenNeu = geladen.filter((ebene): ebene is Kartenebene => ebene !== null);
  if (ebenenNeu.length === 0) {
    return;
  }
  fuegeEbenenHinzu(karte, ebenenNeu, KANAL_JE_PILZ[zustand.pilz]);
  // Dieselbe Liste kennen Melden und Farbschema; neue Kacheln gelten dort ab jetzt mit.
  ebenen.push(...ebenenNeu);
  if (zustand.isBrennpunkteAn) {
    zeigeAnsicht(karte, ebenen, zustand);
  }
  if (ebenen.length === lader.alle.length && zustand.vorschau !== null) {
    entferneVorschau(karte, zustand.vorschau);
    zustand.vorschau = null;
    zeigeAnsicht(karte, ebenen, zustand);
  }
  await aktualisiereHotspots(karte, ebenen, zustand);
}

/** Kacheln im Bild (nach Verschieben): holt, was fehlt, auch wenn das Laden im Hintergrund noch nicht dort war. */
async function ladeSichtbare(lader: Kachellader, zustand: Zustand): Promise<void> {
  const bild = lader.karte.getBounds();
  const ausschnitt = { west: bild.getWest(), sued: bild.getSouth(), ost: bild.getEast(), nord: bild.getNorth() };
  await ladeKacheln(lader, zustand, gebieteImAusschnitt(lader.alle, ausschnitt));
  fuegeSichtbareDetailsHinzu(lader);
}

/** Boden und Wege der geladenen Kacheln im Bild einfügen, sobald man nahe genug ist (ab DETAILS_AB_ZOOM). */
function fuegeSichtbareDetailsHinzu(lader: Kachellader): void {
  const { karte, ebenen, mitDetails } = lader;
  if (karte.getZoom() < DETAILS_AB_ZOOM) {
    return;
  }
  const bild = karte.getBounds();
  const ausschnitt = { west: bild.getWest(), sued: bild.getSouth(), ost: bild.getEast(), nord: bild.getNorth() };
  const geladen = new Set(ebenen.map((ebene) => ebene.gebiet.name));
  const zeigeLinien = element("bodengrenzen", HTMLInputElement).checked;
  for (const gebiet of gebieteImAusschnitt(lader.alle, ausschnitt)) {
    if (geladen.has(gebiet.name) && !mitDetails.has(gebiet.name) && !hatDetails(karte, gebiet)) {
      mitDetails.add(gebiet.name);
      fuegeDetailsHinzu(karte, gebiet, zeigeLinien);
    }
  }
}

/** Zeigt den Ladeanteil im Schleier: Vorschau zählt wenig, jede fertige Kachel gleich viel. */
function meldeLaden(lader: Kachellader, zustand: Zustand): void {
  const anteil = ladeanteil(zustand.vorschau !== null || lader.ebenen.length > 0, lader.ebenen.length, lader.alle.length);
  zeigeLadefortschritt(anteil, ladetext(anteil));
}

/** Lädt nach dem Start alle Kacheln im Detail, die nächsten zur Kartenmitte zuerst, je GLEICHZEITIG_LADEN auf einmal. */
async function ladeAlleImHintergrund(lader: Kachellader, zustand: Zustand): Promise<void> {
  const mitte = lader.karte.getCenter();
  const nachAbstand = [...lader.alle].sort(
    (erste, zweite) => abstandMeter(erste.mitte, [mitte.lng, mitte.lat]) - abstandMeter(zweite.mitte, [mitte.lng, mitte.lat]),
  );
  for (let start = 0; start < nachAbstand.length; start += GLEICHZEITIG_LADEN) {
    await ladeKacheln(lader, zustand, nachAbstand.slice(start, start + GLEICHZEITIG_LADEN));
    meldeLaden(lader, zustand);
    fuegeSichtbareDetailsHinzu(lader);
  }
  // Auch wenn einzelne Kacheln fehlschlugen (der Hinweis nennt sie), endet das Warten; Verschieben versucht es erneut.
  beendeLadeschleier();
}

function tippZeilen(punkt: Tagesbrennpunkt, pilz: Pilzart, stand: string): string[] {
  const wachstum = punkt.art === "heute" ? "wächst heute" : "günstig in den letzten 7 Tagen";
  return [
    `${PILZNAMEN[pilz]}-Tipp`,
    `Kernfläche ${String(punkt.kern.flaecheHektar)} ha, Habitat-Stufe im Mittel ${String(punkt.kern.mittlereStufe)}`,
    `In einem ${String(punkt.flaecheHektar)} ha großen Brennpunkt, ${wachstum}`,
    `Wachstumsindex heute: ${String(punkt.indexHeute)}`,
    `Stand: ${stand}`,
  ];
}

/** Ohne Tipps sagt ein Hinweis unter dem Schalter, warum: Heute wächst für die Pilzart nirgends genug (Index unter 60). */
function zeigeTippHinweis(anzahl: number, pilz: Pilzart): void {
  const hinweis = element("tipps-hinweis", HTMLElement);
  hinweis.hidden = anzahl > 0;
  hinweis.textContent = `Heute keine ${PILZNAMEN[pilz]}-Tipps: Das Wetter lässt sie nirgends im Landkreis wachsen (Index unter 60).`;
}

/** Lädt tageswerte.json; fehlt sie (z. B. lokal ohne Vorberechnung), rechnet die Seite live wie bisher. */
async function ladeTageswerteOderNull(): Promise<Tageswerte | null> {
  try {
    return await ladeTageswerte(KACHEL_ORDNER);
  } catch (fehler) {
    console.warn(`Tageswerte nicht geladen, Brennpunkte werden live bewertet: ${fehlertext(fehler)}`);
    return null;
  }
}

// Setzt build.mjs beim Bauen (esbuild define); in Tests und ohne Build gibt es die Konstante nicht.
declare const __BUILD_ZEIT__: string | undefined;

/**
 * Fester Knopf "Melden" auf der Karte. Der Melde-Knopf in der Tafel ist bei eingeklappter Tafel oder gewählter Stelle
 * ausgeblendet und war so für den Nutzer nicht auffindbar. Der Kartenknopf öffnet das Melden, sobald der Standort genau
 * genug ist; sonst startet er die Ortung bzw. nennt, was noch fehlt.
 */
function richteMeldeKnopfAufKarteEin(karte: maplibregl.Map, gpsKnopf: HTMLButtonElement): void {
  const meldeKnopf = element("melde-knopf", HTMLButtonElement);
  const kartenKnopf = element("melden-kartenknopf", HTMLButtonElement);
  fuegeKnopfHinzu(karte, kartenKnopf);
  kartenKnopf.addEventListener("click", () => {
    if (!meldeKnopf.disabled) {
      zeigeGpsHinweis(null);
      meldeKnopf.click();
      return;
    }
    if (gpsKnopf.getAttribute("aria-pressed") !== "true") {
      gpsKnopf.click(); // startet die Ortung und zeigt "Standort wird gesucht …"
      return;
    }
    zeigeGpsHinweis(element("melde-status", HTMLElement).textContent); // nennt z. B. "GPS zu ungenau (±1800 m, nötig ±30 m)"
  });
}

async function start(): Promise<void> {
  fuelleLegende();
  zeigeVersion(typeof __BUILD_ZEIT__ === "string" ? __BUILD_ZEIT__ : "");
  richteTutorialEin();
  // tageswerte.json (~0,5 MB) blockiert den Start nicht: Die Karte erscheint zuerst, die Tipps kommen nach.
  const tageswerteVersprechen = ladeTageswerteOderNull();
  const [kacheln, vorschauGebiete, grenze, maskeGebiete] = await Promise.all([
    ladeGebiete(KACHEL_ORDNER, KACHEL_UEBERSICHT),
    ladeGebiete(KACHEL_ORDNER, VORSCHAU_UEBERSICHT),
    ladeGrenze(KACHEL_ORDNER),
    ladeGebiete(KACHEL_ORDNER, MASKE_UEBERSICHT),
  ]);
  const zustand: Zustand = {
    pilz: "steinpilz",
    indexOrt: { name: "Kartenmitte", breite: START_MITTE[1], laenge: START_MITTE[0] },
    hasGps: false,
    markierung: null,
    letzterTipp: null,
    isBrennpunkteAn: false,
    brennpunkte: [],
    vorschau: null,
    tageswerte: null,
    isTageswerteGeprueft: false,
  };
  void aktualisiereIndex(zustand);

  const karte = erzeugeKarte(element("karte", HTMLElement), START_MITTE);
  // "style.load" statt "load": "load" wartet auf die OSM-Kacheln, und bei schwachem Netz im Wald
  // würde die Heatmap sonst erst mit dem Hintergrund erscheinen.
  await karte.once("style.load");
  const maske = maskeGebiete[0];
  if (maske === undefined) {
    throw new Error(`Invariante verletzt: ${MASKE_UEBERSICHT} enthält kein Gebiet`);
  }
  zeigeRandverlauf(karte, maske);
  begrenzeKarte(karte, grenze);
  const vorschauGebiet = vorschauGebiete[0];
  if (vorschauGebiet === undefined) {
    throw new Error(`Invariante verletzt: ${VORSCHAU_UEBERSICHT} enthält kein Gebiet`);
  }
  const ebenen: Kartenebene[] = [];
  const lader: Kachellader = { karte, alle: kacheln, ebenen, angefragt: new Set<string>(), mitDetails: new Set<string>() };
  folgeFarbschema(karte, ebenen);
  let tipps: Tippsatz | null = null;
  // Die grobe Vorschau lädt, ohne den Rest des Starts aufzuhalten (Knöpfe, GPS, Melden).
  void (async (): Promise<void> => {
    try {
      zustand.vorschau = { gebiet: vorschauGebiet, daten: await ladeDatenbild(vorschauGebiet) };
      fuegeVorschauHinzu(karte, zustand.vorschau, KANAL_JE_PILZ[zustand.pilz]);
      if (ebenen.length === kacheln.length) {
        entferneVorschau(karte, zustand.vorschau); // alle Kacheln waren schneller als die Vorschau
        zustand.vorschau = null;
      }
    } catch (fehler) {
      zustand.vorschau = null;
      console.warn(`Vorschau nicht geladen, die Kacheln kommen einzeln: ${fehlertext(fehler)}`);
    }
    meldeLaden(lader, zustand);
  })();
  void tageswerteVersprechen.then((tageswerte) => {
    zustand.tageswerte = tageswerte;
    zustand.isTageswerteGeprueft = true;
    if (tageswerte !== null) {
      const stand = STAND_FORMAT.format(new Date(tageswerte.erstellt));
      const markenFuer = (pilz: Pilzart): Tippmarke[] =>
        topSammelplaetze(tageswerte[pilz], ANZAHL_TIPPS).map((punkt, nummer) => ({
          nummer: nummer + 1,
          laenge: punkt.kern.laenge,
          breite: punkt.kern.breite,
          zeilen: tippZeilen(punkt, pilz, stand),
          ecken: punkt.kern.ecken,
        }));
      tipps = erzeugeTipps(karte, { steinpilz: markenFuer("steinpilz"), pfifferling: markenFuer("pfifferling"), edelreizker: markenFuer("edelreizker") });
      zeigeTippHinweis(tipps.zeige(zustand.pilz), zustand.pilz);
    }
    void aktualisiereHotspots(karte, ebenen, zustand);
  });
  const meldeStandort = richteMeldenEin({
    ebenen,
    aktuellePilzart: () => zustand.pilz,
    ringart,
    indexHeute: (stelle, pilz) => indexHeuteAn(stelle.breite, stelle.laenge, pilz),
    speicher: window.localStorage,
    sende: (meldung) => sendeAnWorker(meldung),
  });
  const gpsKnopf = element("gps-knopf", HTMLButtonElement);
  richteGpsEin(karte, gpsKnopf, {
    beiProblem: zeigeGpsHinweis,
    beiStandort: (standort) => {
      meldeStandort(standort);
      zustand.hasGps = true;
      zustand.indexOrt = { name: "Dein Standort", breite: standort.breite, laenge: standort.laenge };
      void aktualisiereIndex(zustand);
    },
  });
  element("gps-banner-zu", HTMLButtonElement).addEventListener("click", () => {
    zeigeGpsHinweis(null);
  });
  richteMeldeKnopfAufKarteEin(karte, gpsKnopf);
  karte.on("moveend", () => {
    void ladeSichtbare(lader, zustand);
    if (!zustand.hasGps) {
      const mitte = karte.getCenter();
      zustand.indexOrt = { name: "Kartenmitte", breite: mitte.lat, laenge: mitte.lng };
      void aktualisiereIndex(zustand);
    }
  });
  zeigeLadehinweis(null);
  void ladeAlleImHintergrund(lader, zustand);
  void aktualisiereHotspots(karte, ebenen, zustand);
  const knopf = element("nur-brennpunkte", HTMLButtonElement);
  fuegeKnopfHinzu(karte, knopf);
  knopf.addEventListener("click", () => {
    zustand.isBrennpunkteAn = !zustand.isBrennpunkteAn;
    knopf.setAttribute("aria-pressed", String(zustand.isBrennpunkteAn));
    zeigeAnsicht(karte, ebenen, zustand);
  });

  element("punkt-schliessen", HTMLButtonElement).addEventListener("click", () => {
    zustand.markierung?.remove();
    zustand.markierung = null;
    zustand.letzterTipp = null;
    schliessePunkt();
  });
  element("punkt-details-knopf", HTMLButtonElement).addEventListener("click", () => {
    schalteDetails(!sindDetailsOffen());
  });

  // Erst nach dem Einfügen der Ebenen: bodenAnPunkt fragt die Boden-Ebene ab.
  karte.on("click", (ereignis) => {
    void zeigeStelle(karte, ebenen, zustand, ereignis);
  });
  element("pilzwahl", HTMLFieldSetElement).addEventListener("change", (ereignis) => {
    const ziel = ereignis.target;
    if (!(ziel instanceof HTMLInputElement) || (ziel.value !== "steinpilz" && ziel.value !== "pfifferling" && ziel.value !== "edelreizker")) {
      return;
    }
    zustand.pilz = ziel.value;
    zustand.brennpunkte = [];
    if (tipps !== null) {
      zeigeTippHinweis(tipps.zeige(zustand.pilz), zustand.pilz);
    }
    zeigeAnsicht(karte, ebenen, zustand);
    void aktualisiereIndex(zustand);
    void aktualisiereHotspots(karte, ebenen, zustand);
    if (zustand.letzterTipp !== null) {
      void zeigeStelle(karte, ebenen, zustand, zustand.letzterTipp);
    }
  });
  element("tafel-knopf", HTMLButtonElement).addEventListener("click", () => {
    schalteTafel(!istTafelOffen());
  });
  const legendeKnopf = element("legende-knopf", HTMLButtonElement);
  fuegeKnopfHinzu(karte, legendeKnopf);
  legendeKnopf.addEventListener("click", () => {
    schalteLegende(element("legende-fenster", HTMLElement).hidden);
  });
  element("legende-schliessen", HTMLButtonElement).addEventListener("click", () => {
    schalteLegende(false);
  });
  element("bodengrenzen", HTMLInputElement).addEventListener("change", (ereignis) => {
    const ziel = ereignis.target;
    zeigeBodengrenzen(karte, ebenen, ziel instanceof HTMLInputElement && ziel.checked);
  });
}

start().catch((fehler: unknown) => {
  zeigeIndexFehler(`Die Karte konnte nicht geladen werden: ${fehlertext(fehler)}`);
});
