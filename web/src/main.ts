// Einstieg der Webseite: lädt Gebiete und Daten-Bilder, baut die Karte und verbindet Bedienung, Wetter und Tafel.
import maplibregl from "maplibre-gl";
import { bodenAnPunkt, erzeugeKarte, fuegeEbenenHinzu, zeigeBodengrenzen, zeigePilz, type Kartenebene } from "./karte.ts";
import { baumartName, pixelAnStelle, stufeninfo, type Gebiet, type Pilzkanal } from "./geo.ts";
import { ladeDatenbild, ladeGebiete } from "./clients/daten.ts";
import { ladeWetter, type Wetterreihe } from "./clients/openmeteo.ts";
import { indexverlauf, tagesindex, type Pilzart } from "./wachstum.ts";
import {
  element,
  fuelleGebiete,
  fuelleLegende,
  zeigeIndex,
  zeigeIndexFehler,
  zeigePunkt,
  zeigePunktwetter,
  zeigePunktwetterFehler,
  zeigeSchutzhinweis,
} from "./ansicht.ts";

const KANAL: Readonly<Record<Pilzart, Pilzkanal>> = { steinpilz: 1, pfifferling: 2 };
const KANAELE_PRO_PIXEL = 4;
const WETTER_RASTER_GRAD = 0.02; // ~2 km: nahe Punkte teilen sich einen Wetterabruf
const FLUG_ZOOM = 13;
const SCHUTZHINWEISE: Readonly<Record<string, string>> = {
  schwaerzesee:
    "Der Schwärzesee und das Schwärzetal liegen im Naturschutzgebiet „Nonnenfließ-Schwärzetal“. Dort kann das Sammeln verboten sein. Bitte Schilder vor Ort beachten.",
};

interface Zustand {
  pilz: Pilzart;
  gebiet: Gebiet;
  markierung: maplibregl.Marker | null;
  letzterTipp: maplibregl.MapMouseEvent | null; // für Neubewertung beim Wechsel der Pilzart
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

async function aktualisiereGebietsindex(zustand: Zustand): Promise<void> {
  const { gebiet, pilz } = zustand;
  element("index-ort", HTMLElement).textContent = gebiet.anzeigename;
  try {
    const reihe = await wetterFuer(gebiet.mitte[1], gebiet.mitte[0]);
    if (zustand.gebiet === gebiet && zustand.pilz === pilz) {
      zeigeIndex(gebiet.anzeigename, indexverlauf(reihe.tage, reihe.heute, pilz));
    }
  } catch (fehler) {
    zeigeIndexFehler(fehlertext(fehler));
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
  const stufe = ebene.daten.data[start + KANAL[zustand.pilz]];
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
  });
  try {
    const reihe = await wetterFuer(lat, lng);
    zeigePunktwetter(reihe.tage, reihe.heute, tagesindex(reihe.tage, reihe.heute, zustand.pilz));
  } catch (fehler) {
    zeigePunktwetterFehler(fehlertext(fehler));
  }
}

async function start(): Promise<void> {
  fuelleLegende();
  const gebiete = await ladeGebiete();
  const erstes = gebiete[0];
  if (erstes === undefined) {
    throw new Error("Invariante verletzt: keine Gebiete");
  }
  fuelleGebiete(gebiete);
  const zustand: Zustand = { pilz: "steinpilz", gebiet: erstes, markierung: null, letzterTipp: null };
  zeigeSchutzhinweis(SCHUTZHINWEISE[erstes.name] ?? null);
  void aktualisiereGebietsindex(zustand);

  const karte = erzeugeKarte(element("karte", HTMLElement), erstes.mitte);
  const ebenen: Kartenebene[] = await Promise.all(
    gebiete.map(async (gebiet) => ({ gebiet, daten: await ladeDatenbild(gebiet) })),
  );
  const fuegeHinzu = (): void => {
    fuegeEbenenHinzu(karte, ebenen, KANAL[zustand.pilz]);
  };
  if (karte.isStyleLoaded()) {
    fuegeHinzu();
  } else {
    karte.on("load", fuegeHinzu); // "load" feuert nur einmal
  }

  karte.on("click", (ereignis) => {
    void zeigeStelle(karte, ebenen, zustand, ereignis);
  });
  element("pilzwahl", HTMLFieldSetElement).addEventListener("change", (ereignis) => {
    const ziel = ereignis.target;
    if (!(ziel instanceof HTMLInputElement) || (ziel.value !== "steinpilz" && ziel.value !== "pfifferling")) {
      return;
    }
    zustand.pilz = ziel.value;
    zeigePilz(karte, ebenen, KANAL[zustand.pilz]);
    void aktualisiereGebietsindex(zustand);
    if (zustand.letzterTipp !== null) {
      void zeigeStelle(karte, ebenen, zustand, zustand.letzterTipp);
    }
  });
  element("gebietswahl", HTMLSelectElement).addEventListener("change", (ereignis) => {
    const ziel = ereignis.target;
    const gewaehlt = gebiete.find((gebiet) => ziel instanceof HTMLSelectElement && gebiet.name === ziel.value);
    if (gewaehlt === undefined) {
      return;
    }
    zustand.gebiet = gewaehlt;
    zeigeSchutzhinweis(SCHUTZHINWEISE[gewaehlt.name] ?? null);
    karte.flyTo({ center: [gewaehlt.mitte[0], gewaehlt.mitte[1]], zoom: FLUG_ZOOM });
    void aktualisiereGebietsindex(zustand);
  });
  element("bodengrenzen", HTMLInputElement).addEventListener("change", (ereignis) => {
    const ziel = ereignis.target;
    zeigeBodengrenzen(karte, ebenen, ziel instanceof HTMLInputElement && ziel.checked);
  });
}

start().catch((fehler: unknown) => {
  zeigeIndexFehler(`Die Karte konnte nicht geladen werden: ${fehlertext(fehler)}`);
});
