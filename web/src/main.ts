// Einstieg der Webseite: baut die Karte, lädt die 10-km-Kacheln erst, wenn sie ins Bild kommen, und verbindet
// Bedienung, Wetter und Tafel.
import maplibregl from "maplibre-gl";
import {
  bodenAnPunkt,
  erzeugeKarte,
  fuegeEbenenHinzu,
  folgeFarbschema,
  zeigeBodengrenzen,
  fuegeKnopfHinzu,
  richteGpsEin,
  zeigeHeatmap,
  zeigeTipps,
  type Kartenebene,
} from "./karte.ts";
import { findeHotspots, type Brennpunktflaeche, type Hotspot, type Hotspotart, type MarkierterHotspot } from "./hotspots.ts";
import { brennpunktArt, topSammelplaetze, wetterSchluessel, type Tagesbrennpunkt, type Tageswerte } from "./tageswerte.ts";
import { abstandMeter, baumartName, gebieteImAusschnitt, KANAL_JE_PILZ, pixelAnStelle, stufeninfo, type Gebiet } from "./geo.ts";
import { ladeDatenbild, ladeGebiete, ladeTageswerte } from "./clients/daten.ts";
import { richteMeldenEin } from "./melden.ts";
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
  zeigeLadehinweis,
  zeigePunkt,
  zeigePunktwetter,
  zeigePunktwetterFehler,
  zeigeSchutzhinweis,
} from "./ansicht.ts";
import { richteTutorialEin } from "./tutorialansicht.ts";

const KANAELE_PRO_PIXEL = 4;
const ANZAHL_TIPPS = 5;
const STAND_FORMAT = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const PILZNAMEN: Readonly<Record<Pilzart, string>> = { steinpilz: "Steinpilz", pfifferling: "Pfifferling" };
const KACHEL_ORDNER = "daten/barnim";
const KACHEL_UEBERSICHT = "kacheln.json";
// Unter Zoom 11 wären fast alle 25 Kacheln (~30 MB) im Bild; im Wald mit schwachem Netz zu viel.
const MIN_ZOOM_LADEN = 11;
const HINWEIS_ZOOM = "Zum Laden der Pilzkarte näher heranzoomen.";
const START_MITTE: readonly [number, number] = [13.745, 52.979]; // Ortsmitte Joachimsthal [Länge, Breite]
// Hinweis, sobald Kartenmitte oder GPS-Standort näher als `radiusMeter` an einem Schutzgebiet liegt.
const SCHUTZGEBIETE: readonly { readonly mitte: readonly [number, number]; readonly radiusMeter: number; readonly text: string }[] = [
  {
    mitte: [13.712, 52.815], // Schwärzesee
    radiusMeter: 2000,
    text: "Der Schwärzesee und das Schwärzetal liegen im Naturschutzgebiet „Nonnenfließ-Schwärzetal“. Dort kann das Sammeln verboten sein. Bitte Schilder vor Ort beachten.",
  },
];

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
  tageswerte: Tageswerte | null; // morgens vorberechnet; null: Brennpunkte werden live mit Wetter bewertet
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

function schutzhinweisAn(ort: Indexort): string | null {
  const nahe = SCHUTZGEBIETE.find((gebiet) => abstandMeter(gebiet.mitte, [ort.laenge, ort.breite]) <= gebiet.radiusMeter);
  return nahe === undefined ? null : nahe.text;
}

async function aktualisiereIndex(zustand: Zustand): Promise<void> {
  const { indexOrt, pilz } = zustand;
  element("index-ort", HTMLElement).textContent = indexOrt.name;
  zeigeSchutzhinweis(schutzhinweisAn(indexOrt));
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
  zeigeHeatmap(karte, ebenen, { kanal: KANAL_JE_PILZ[zustand.pilz], brennpunkte: zustand.isBrennpunkteAn ? zustand.brennpunkte : null });
}

/**
 * Brennpunkte der geladenen Kacheln: aus tageswerte.json (morgens vorberechnet, keine Wetterabrufe) oder, wenn die
 * Datei fehlt, live mit dem Wetter je Fläche; nahe Stellen teilen sich dann einen Abruf (wetterSchluessel).
 */
async function aktualisiereHotspots(karte: maplibregl.Map, ebenen: readonly Kartenebene[], zustand: Zustand): Promise<void> {
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
    zeigePunktwetter(reihe.tage, reihe.heute, tagesindex(reihe.tage, reihe.heute, zustand.pilz));
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
}

/** Lädt die Kacheln im Bild, die noch fehlen; eine fehlgeschlagene wird beim nächsten Verschieben erneut versucht. */
async function ladeSichtbare(lader: Kachellader, zustand: Zustand): Promise<void> {
  const { karte, alle, ebenen, angefragt } = lader;
  if (karte.getZoom() < MIN_ZOOM_LADEN) {
    zeigeLadehinweis(HINWEIS_ZOOM);
    return;
  }
  zeigeLadehinweis(null);
  const bild = karte.getBounds();
  const ausschnitt = { west: bild.getWest(), sued: bild.getSouth(), ost: bild.getEast(), nord: bild.getNorth() };
  const neu = gebieteImAusschnitt(alle, ausschnitt).filter((gebiet) => !angefragt.has(gebiet.name));
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
  await aktualisiereHotspots(karte, ebenen, zustand);
}

function tippZeilen(punkt: Tagesbrennpunkt, stand: string): string[] {
  const wachstum = punkt.art === "heute" ? "wächst heute" : "günstig in den letzten 7 Tagen";
  return [
    "Steinpilz-Tipp",
    `Kernfläche ${String(punkt.kern.flaecheHektar)} ha, Habitat-Stufe im Mittel ${String(punkt.kern.mittlereStufe)}`,
    `In einem ${String(punkt.flaecheHektar)} ha großen Brennpunkt, ${wachstum}`,
    `Wachstumsindex heute: ${String(punkt.indexHeute)}`,
    `Stand: ${stand}`,
  ];
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

async function start(): Promise<void> {
  fuelleLegende();
  richteTutorialEin(window.localStorage);
  const [kacheln, tageswerte] = await Promise.all([ladeGebiete(KACHEL_ORDNER, KACHEL_UEBERSICHT), ladeTageswerteOderNull()]);
  const zustand: Zustand = {
    pilz: "steinpilz",
    indexOrt: { name: "Kartenmitte", breite: START_MITTE[1], laenge: START_MITTE[0] },
    hasGps: false,
    markierung: null,
    letzterTipp: null,
    isBrennpunkteAn: false,
    brennpunkte: [],
    tageswerte,
  };
  void aktualisiereIndex(zustand);

  const karte = erzeugeKarte(element("karte", HTMLElement), START_MITTE);
  // "style.load" statt "load": "load" wartet auf die OSM-Kacheln, und bei schwachem Netz im Wald
  // würde die Heatmap sonst erst mit dem Hintergrund erscheinen.
  await karte.once("style.load");
  const ebenen: Kartenebene[] = [];
  const lader: Kachellader = { karte, alle: kacheln, ebenen, angefragt: new Set<string>() };
  folgeFarbschema(karte, ebenen);
  if (tageswerte !== null) {
    const stand = STAND_FORMAT.format(new Date(tageswerte.erstellt));
    zeigeTipps(
      karte,
      topSammelplaetze(tageswerte.steinpilz, ANZAHL_TIPPS).map((punkt, nummer) => ({
        nummer: nummer + 1,
        laenge: punkt.kern.laenge,
        breite: punkt.kern.breite,
        zeilen: tippZeilen(punkt, stand),
        ecken: punkt.kern.ecken,
      })),
    );
  }
  const meldeStandort = richteMeldenEin({
    ebenen,
    aktuellePilzart: () => zustand.pilz,
    ringart,
    indexHeute: (stelle, pilz) => indexHeuteAn(stelle.breite, stelle.laenge, pilz),
    speicher: window.localStorage,
  });
  richteGpsEin(karte, element("gps-knopf", HTMLButtonElement), {
    beiProblem: zeigeGpsHinweis,
    beiStandort: (standort) => {
      meldeStandort(standort);
      zustand.hasGps = true;
      zustand.indexOrt = { name: "Dein Standort", breite: standort.breite, laenge: standort.laenge };
      void aktualisiereIndex(zustand);
    },
  });
  karte.on("moveend", () => {
    void ladeSichtbare(lader, zustand);
    if (!zustand.hasGps) {
      const mitte = karte.getCenter();
      zustand.indexOrt = { name: "Kartenmitte", breite: mitte.lat, laenge: mitte.lng };
      void aktualisiereIndex(zustand);
    }
  });
  void ladeSichtbare(lader, zustand);
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
    if (!(ziel instanceof HTMLInputElement) || (ziel.value !== "steinpilz" && ziel.value !== "pfifferling")) {
      return;
    }
    zustand.pilz = ziel.value;
    zustand.brennpunkte = [];
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
