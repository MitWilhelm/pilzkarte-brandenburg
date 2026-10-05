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
  beiGpsStandort,
  zeigeHeatmap,
  type Kartenebene,
} from "./karte.ts";
import { findeHotspots, hotspotart, type Hotspot, type Hotspotart, type MarkierterHotspot } from "./hotspots.ts";
import { baumartName, gebieteImAusschnitt, KANAL_JE_PILZ, pixelAnStelle, stufeninfo, type Gebiet, type Ort } from "./geo.ts";
import { ladeDatenbild, ladeGebiete } from "./clients/daten.ts";
import { richteMeldenEin } from "./melden.ts";
import { ladeWetter, type Wetterreihe } from "./clients/openmeteo.ts";
import { indexverlauf, tagesindex, type Pilzart } from "./wachstum.ts";
import {
  element,
  fuelleOrte,
  fuelleLegende,
  schalteDetails,
  schliessePunkt,
  sindDetailsOffen,
  zeigeIndex,
  zeigeIndexFehler,
  zeigeLadehinweis,
  zeigePunkt,
  zeigePunktwetter,
  zeigePunktwetterFehler,
  zeigeSchutzhinweis,
} from "./ansicht.ts";

const KANAELE_PRO_PIXEL = 4;
const WETTER_RASTER_GRAD = 0.02; // ~2 km: nahe Punkte teilen sich einen Wetterabruf
const FLUG_ZOOM = 13;
const TAGE_RUECKBLICK = 7; // so weit zurück zählt ein günstiger Index für ältere, große Pilze
const PILZNAMEN: Readonly<Record<Pilzart, string>> = { steinpilz: "Steinpilz", pfifferling: "Pfifferling" };
const KACHEL_ORDNER = "daten/barnim";
const KACHEL_UEBERSICHT = "kacheln.json";
// Unter Zoom 11 wären fast alle 25 Kacheln (~30 MB) im Bild; im Wald mit schwachem Netz zu viel.
const MIN_ZOOM_LADEN = 11;
const HINWEIS_ZOOM = "Zum Laden der Pilzkarte näher heranzoomen.";
// Mittelpunkte wie die früheren Testgebiete (pipeline/gebiete.py); weitere Orte auf Wunsch des Nutzers.
const ORTE: readonly Ort[] = [
  { name: "joachimsthal", anzeigename: "Joachimsthal", mitte: [13.745, 52.979] },
  { name: "schwaerzesee", anzeigename: "Schwärzesee", mitte: [13.712, 52.815] },
];
const SCHUTZHINWEISE: Readonly<Record<string, string>> = {
  schwaerzesee:
    "Der Schwärzesee und das Schwärzetal liegen im Naturschutzgebiet „Nonnenfließ-Schwärzetal“. Dort kann das Sammeln verboten sein. Bitte Schilder vor Ort beachten.",
};

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
  brennpunkte: readonly MarkierterHotspot[]; // zuletzt markierte Flächen der gewählten Pilzart
}

const wetterSpeicher = new Map<string, Promise<Wetterreihe>>();

function wetterFuer(breite: number, laenge: number): Promise<Wetterreihe> {
  const runden = (wert: number): string => (Math.round(wert / WETTER_RASTER_GRAD) * WETTER_RASTER_GRAD).toFixed(2);
  const schluessel = `${runden(breite)},${runden(laenge)}`;
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

/** Art (Farbe) eines Brennpunkts aus ihrem eigenen Wetter (heute bzw. letzte TAGE_RUECKBLICK Tage) oder null. */
async function ringart(hotspot: Hotspot, pilz: Pilzart): Promise<Hotspotart | null> {
  const reihe = await wetterFuer(hotspot.breite, hotspot.laenge);
  const indizes: number[] = [];
  for (let position = Math.max(0, reihe.heute - TAGE_RUECKBLICK); position <= reihe.heute; position += 1) {
    indizes.push(tagesindex(reihe.tage, position, pilz).index);
  }
  const indexHeute = indizes[indizes.length - 1];
  if (indexHeute === undefined) {
    throw new Error("Invariante verletzt: keine Indexwerte für den Rückblick");
  }
  return hotspotart(indexHeute, Math.max(...indizes));
}

async function indexHeuteAn(breite: number, laenge: number, pilz: Pilzart): Promise<number> {
  const reihe = await wetterFuer(breite, laenge);
  return tagesindex(reihe.tage, reihe.heute, pilz).index;
}

function zeigeAnsicht(karte: maplibregl.Map, ebenen: readonly Kartenebene[], zustand: Zustand): void {
  zeigeHeatmap(karte, ebenen, { kanal: KANAL_JE_PILZ[zustand.pilz], brennpunkte: zustand.isBrennpunkteAn ? zustand.brennpunkte : null });
}

/** Brennpunkte mit dem Wetter je Fläche (statt Gebietsmitte); nahe Stellen teilen sich einen Abruf (WETTER_RASTER_GRAD). */
async function aktualisiereHotspots(karte: maplibregl.Map, ebenen: readonly Kartenebene[], zustand: Zustand): Promise<void> {
  const pilz = zustand.pilz;
  const kandidaten = ebenen.flatMap(({ gebiet, daten }) => findeHotspots({ daten: daten.data, kanal: KANAL_JE_PILZ[pilz], gebiet }));
  const markiert = await Promise.all(
    kandidaten.map(async (hotspot): Promise<MarkierterHotspot | null> => {
      try {
        const art = await ringart(hotspot, pilz);
        return art === null ? null : { ...hotspot, art };
      } catch {
        // Ohne Wetter kein Index und keine Brennpunkt-Farbe an dieser Stelle; den Fehler zeigt aktualisiereGebietsindex schon an.
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

async function start(): Promise<void> {
  fuelleLegende();
  fuelleOrte(ORTE);
  const [startOrt] = ORTE;
  if (startOrt === undefined) {
    throw new Error("Invariante verletzt: keine Orte für die Sprungliste");
  }
  const kacheln = await ladeGebiete(KACHEL_ORDNER, KACHEL_UEBERSICHT);
  const zustand: Zustand = {
    pilz: "steinpilz",
    indexOrt: { name: "Kartenmitte", breite: startOrt.mitte[1], laenge: startOrt.mitte[0] },
    hasGps: false,
    markierung: null,
    letzterTipp: null,
    isBrennpunkteAn: false,
    brennpunkte: [],
  };
  void aktualisiereIndex(zustand);

  const { karte, standortSteuerung } = erzeugeKarte(element("karte", HTMLElement), startOrt.mitte);
  // "style.load" statt "load": "load" wartet auf die OSM-Kacheln, und bei schwachem Netz im Wald
  // würde die Heatmap sonst erst mit dem Hintergrund erscheinen.
  await karte.once("style.load");
  const ebenen: Kartenebene[] = [];
  const lader: Kachellader = { karte, alle: kacheln, ebenen, angefragt: new Set<string>() };
  folgeFarbschema(karte, ebenen);
  const meldeStandort = richteMeldenEin({
    ebenen,
    aktuellePilzart: () => zustand.pilz,
    ringart,
    indexHeute: (stelle, pilz) => indexHeuteAn(stelle.breite, stelle.laenge, pilz),
    speicher: window.localStorage,
  });
  beiGpsStandort(standortSteuerung, (standort) => {
    meldeStandort(standort);
    zustand.hasGps = true;
    zustand.indexOrt = { name: "Dein Standort", breite: standort.breite, laenge: standort.laenge };
    void aktualisiereIndex(zustand);
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
  element("gebietswahl", HTMLSelectElement).addEventListener("change", (ereignis) => {
    const ziel = ereignis.target;
    const gewaehlt = ORTE.find((ort) => ziel instanceof HTMLSelectElement && ort.name === ziel.value);
    if (gewaehlt === undefined) {
      return;
    }
    zeigeSchutzhinweis(SCHUTZHINWEISE[gewaehlt.name] ?? null);
    karte.flyTo({ center: [gewaehlt.mitte[0], gewaehlt.mitte[1]], zoom: FLUG_ZOOM });
    // Zurück auf "Springen zu …", damit derselbe Ort später erneut wählbar ist ("change" feuert sonst nicht).
    if (ziel instanceof HTMLSelectElement) {
      ziel.value = "";
    }
  });
  element("bodengrenzen", HTMLInputElement).addEventListener("change", (ereignis) => {
    const ziel = ereignis.target;
    zeigeBodengrenzen(karte, ebenen, ziel instanceof HTMLInputElement && ziel.checked);
  });
}

start().catch((fehler: unknown) => {
  zeigeIndexFehler(`Die Karte konnte nicht geladen werden: ${fehlertext(fehler)}`);
});
