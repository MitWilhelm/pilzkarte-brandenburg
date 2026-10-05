// Karten-Rand: MapLibre mit OpenStreetMap-Hintergrund, Heatmap-Bildern je Gebiet und Bodenflächen.
// OSM-Kacheln: Nutzungsrichtlinie verlangt Namensnennung und geringe Last (private Nutzung).
import maplibregl from "maplibre-gl";
import { faerbeOverlay, standortAusGpsEreignis, type Gebiet, type Pilzkanal, type Standort } from "./geo.ts";
import { faerbeBrennpunkte, type MarkierterHotspot } from "./hotspots.ts";

const OSM_KACHELN = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_HINWEIS = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>';
const QUELLEN_HINWEIS = "© DLR · © LFB Brandenburg"; // ausführlich in der Legende
const KACHEL_PIXEL = 256;
const MAX_ZOOM = 19;
const START_ZOOM = 13;
const HEATMAP_DECKKRAFT = 0.6; // etwas durchsichtiger, damit Wege darunter lesbar bleiben
const BODEN_LINIENBREITE = 0.6;

// Dunkelmodus: OSM-Kacheln gibt es nur hell; Helligkeit umkehren und Farbton drehen ergibt eine dunkle Karte
// mit ungefähr gleichen Farben (Wasser bleibt bläulich, Wald grünlich).
interface Farbschema {
  readonly rasterHellMin: number;
  readonly rasterHellMax: number;
  readonly rasterFarbton: number;
  readonly rasterSaettigung: number;
  readonly weg: string;
  readonly wegRand: string;
  readonly pfad: string;
  readonly strasse: string;
  readonly strasseRand: string;
}
const HELL: Farbschema = {
  rasterHellMin: 0,
  rasterHellMax: 1,
  rasterFarbton: 0,
  rasterSaettigung: 0,
  weg: "#ffffff",
  wegRand: "#6e5b3e",
  pfad: "#7a5a26",
  strasse: "#ffd75e",
  strasseRand: "#7d7d7d",
};
const DUNKEL: Farbschema = {
  rasterHellMin: 0.92,
  rasterHellMax: 0.08,
  rasterFarbton: 180,
  rasterSaettigung: -0.35,
  weg: "#efe6cf",
  wegRand: "#0c120e",
  pfad: "#e2c88f",
  strasse: "#d6b04a",
  strasseRand: "#000000",
};
const DUNKEL_ABFRAGE = "(prefers-color-scheme: dark)";
// Linienbreiten [Zoom, Pixel]: bei 12 noch dünn, ab 16 kräftig wie in Wanderkarten.
const WEG_BREITE: readonly [number, number, number, number] = [12, 1.5, 16, 6];
const WEG_RAND_BREITE: readonly [number, number, number, number] = [12, 3, 16, 10];
const PFAD_BREITE: readonly [number, number, number, number] = [12, 1, 16, 3.5];
// Straßen für Autos breiter und gelb, damit sie sich klar von Forstwegen (weiß) abheben.
const STRASSE_BREITE: readonly [number, number, number, number] = [12, 2.5, 16, 9];
const STRASSE_RAND_BREITE: readonly [number, number, number, number] = [12, 4, 16, 12];
const PFAD_STRICHE: readonly [number, number] = [2, 1.5];

export interface Kartenebene {
  readonly gebiet: Gebiet;
  readonly daten: ImageData;
}

export interface Heatmapansicht {
  readonly kanal: Pilzkanal;
  readonly brennpunkte: readonly MarkierterHotspot[] | null; // null: normale Heatmap; sonst Flächen farbig, Rest grau
}

function bildUrl(ebene: Kartenebene, ansicht: Heatmapansicht): string {
  const { daten, gebiet } = ebene;
  const leinwand = document.createElement("canvas");
  leinwand.width = daten.width;
  leinwand.height = daten.height;
  const zeichnung = leinwand.getContext("2d");
  if (zeichnung === null) {
    throw new Error("Invariante verletzt: kein 2D-Zeichenkontext verfügbar");
  }
  const farben = faerbeOverlay(daten.data, ansicht.kanal);
  const sichtbar = ansicht.brennpunkte === null ? farben : faerbeBrennpunkte(farben, gebiet, ansicht.brennpunkte);
  zeichnung.putImageData(new ImageData(sichtbar, daten.width, daten.height), 0, 0);
  return leinwand.toDataURL("image/png");
}

function farbschema(): Farbschema {
  return window.matchMedia(DUNKEL_ABFRAGE).matches ? DUNKEL : HELL;
}

function rasterFarben(schema: Farbschema): NonNullable<maplibregl.RasterLayerSpecification["paint"]> {
  return {
    "raster-brightness-min": schema.rasterHellMin,
    "raster-brightness-max": schema.rasterHellMax,
    "raster-hue-rotate": schema.rasterFarbton,
    "raster-saturation": schema.rasterSaettigung,
  };
}

function faerbeHintergrund(karte: maplibregl.Map): void {
  const farben = rasterFarben(farbschema());
  karte.setPaintProperty("osm", "raster-brightness-min", farben["raster-brightness-min"]);
  karte.setPaintProperty("osm", "raster-brightness-max", farben["raster-brightness-max"]);
  karte.setPaintProperty("osm", "raster-hue-rotate", farben["raster-hue-rotate"]);
  karte.setPaintProperty("osm", "raster-saturation", farben["raster-saturation"]);
}

function breite(stufen: readonly [number, number, number, number]): maplibregl.ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], stufen[0], stufen[1], stufen[2], stufen[3]];
}

/** Folgt dem Hell/Dunkel-Modus des Geräts: Hintergrundkarte und Wegfarben. */
export function folgeFarbschema(karte: maplibregl.Map, ebenen: readonly Kartenebene[]): void {
  const anwenden = (): void => {
    const schema = farbschema();
    faerbeHintergrund(karte);
    for (const { gebiet } of ebenen) {
      karte.setPaintProperty(`wege-rand-${gebiet.name}`, "line-color", schema.wegRand);
      karte.setPaintProperty(`wege-${gebiet.name}`, "line-color", schema.weg);
      karte.setPaintProperty(`pfade-${gebiet.name}`, "line-color", schema.pfad);
      karte.setPaintProperty(`strassen-rand-${gebiet.name}`, "line-color", schema.strasseRand);
      karte.setPaintProperty(`strassen-${gebiet.name}`, "line-color", schema.strasse);
    }
  };
  window.matchMedia(DUNKEL_ABFRAGE).addEventListener("change", anwenden);
}

export function erzeugeKarte(
  container: HTMLElement,
  mitte: readonly [number, number],
): { readonly karte: maplibregl.Map; readonly standortSteuerung: maplibregl.GeolocateControl } {
  const karte = new maplibregl.Map({
    container,
    center: [mitte[0], mitte[1]],
    zoom: START_ZOOM,
    maxZoom: MAX_ZOOM,
    attributionControl: { compact: true, customAttribution: QUELLEN_HINWEIS },
    style: {
      version: 8,
      sources: {
        osm: { type: "raster", tiles: [OSM_KACHELN], tileSize: KACHEL_PIXEL, attribution: OSM_HINWEIS, maxzoom: MAX_ZOOM },
      },
      layers: [{ id: "osm", type: "raster", source: "osm", paint: rasterFarben(farbschema()) }],
    },
  });
  karte.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  const standortSteuerung = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: true,
  });
  karte.addControl(standortSteuerung, "top-right");
  karte.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
  // MapLibre klappt den kompakten Quellenhinweis beim Start auf; auf dem Handy verdeckt er dann die Karte.
  karte.on("load", () => {
    container.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
  });
  return { karte, standortSteuerung };
}

/** Meldet jeden GPS-Standort der Karte; das Ereignis von MapLibre ist untypisiert und wird hier geprüft. */
export function beiGpsStandort(steuerung: maplibregl.GeolocateControl, aufruf: (standort: Standort) => void): void {
  steuerung.on("geolocate", (ereignis: unknown) => {
    aufruf(standortAusGpsEreignis(ereignis));
  });
}

export function fuegeEbenenHinzu(karte: maplibregl.Map, ebenen: readonly Kartenebene[], kanal: Pilzkanal): void {
  for (const ebene of ebenen) {
    const { gebiet } = ebene;
    karte.addSource(`heatmap-${gebiet.name}`, {
      type: "image",
      url: bildUrl(ebene, { kanal, brennpunkte: null }),
      coordinates: [
        [gebiet.ecken[0][0], gebiet.ecken[0][1]],
        [gebiet.ecken[1][0], gebiet.ecken[1][1]],
        [gebiet.ecken[2][0], gebiet.ecken[2][1]],
        [gebiet.ecken[3][0], gebiet.ecken[3][1]],
      ],
    });
    karte.addLayer({
      id: `heatmap-${gebiet.name}`,
      type: "raster",
      source: `heatmap-${gebiet.name}`,
      // nearest: Klassen nicht verwischen, jedes 10-m-Feld bleibt erkennbar
      paint: { "raster-opacity": HEATMAP_DECKKRAFT, "raster-resampling": "nearest" },
    });
    karte.addSource(`boden-${gebiet.name}`, { type: "geojson", data: `${gebiet.ordner}/${gebiet.name}_boden.geojson` });
    // Unsichtbare Füllung, damit ein Tipp die Bodenfläche findet; Linien nur auf Wunsch sichtbar.
    karte.addLayer({
      id: `boden-flaeche-${gebiet.name}`,
      type: "fill",
      source: `boden-${gebiet.name}`,
      paint: { "fill-opacity": 0 },
    });
    karte.addLayer({
      id: `boden-linie-${gebiet.name}`,
      type: "line",
      source: `boden-${gebiet.name}`,
      layout: { visibility: "none" },
      paint: { "line-color": "#4b3a6b", "line-width": BODEN_LINIENBREITE },
    });
    fuegeWegeHinzu(karte, gebiet);
  }
}

// Wege aus OpenStreetMap (pipeline/io_waldwege.py): über der Heatmap, damit man den Weg zur Stelle sieht.
function fuegeWegeHinzu(karte: maplibregl.Map, gebiet: Gebiet): void {
  const schema = farbschema();
  const quelle = `wege-quelle-${gebiet.name}`;
  karte.addSource(quelle, { type: "geojson", data: `${gebiet.ordner}/${gebiet.name}_wege.geojson` });
  karte.addLayer({
    id: `pfade-${gebiet.name}`,
    type: "line",
    source: quelle,
    filter: ["==", ["get", "art"], "pfad"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": schema.pfad, "line-width": breite(PFAD_BREITE), "line-dasharray": [...PFAD_STRICHE] },
  });
  karte.addLayer({
    id: `wege-rand-${gebiet.name}`,
    type: "line",
    source: quelle,
    filter: ["==", ["get", "art"], "weg"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": schema.wegRand, "line-width": breite(WEG_RAND_BREITE) },
  });
  karte.addLayer({
    id: `wege-${gebiet.name}`,
    type: "line",
    source: quelle,
    filter: ["==", ["get", "art"], "weg"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": schema.weg, "line-width": breite(WEG_BREITE) },
  });
  karte.addLayer({
    id: `strassen-rand-${gebiet.name}`,
    type: "line",
    source: quelle,
    filter: ["==", ["get", "art"], "strasse"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": schema.strasseRand, "line-width": breite(STRASSE_RAND_BREITE) },
  });
  karte.addLayer({
    id: `strassen-${gebiet.name}`,
    type: "line",
    source: quelle,
    filter: ["==", ["get", "art"], "strasse"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": schema.strasse, "line-width": breite(STRASSE_BREITE) },
  });
}

export function zeigeHeatmap(karte: maplibregl.Map, ebenen: readonly Kartenebene[], ansicht: Heatmapansicht): void {
  for (const ebene of ebenen) {
    const quelle = karte.getSource(`heatmap-${ebene.gebiet.name}`);
    if (!(quelle instanceof maplibregl.ImageSource)) {
      throw new Error(`Invariante verletzt: Heatmap-Quelle für ${ebene.gebiet.name} fehlt`);
    }
    quelle.updateImage({ url: bildUrl(ebene, ansicht) });
  }
}

/** Setzt den Knopf aus index.html als eigenen Kartenschalter unter Zoom und GPS. */
export function fuegeKnopfHinzu(karte: maplibregl.Map, knopf: HTMLButtonElement): void {
  const gruppe = document.createElement("div");
  gruppe.className = "maplibregl-ctrl maplibregl-ctrl-group";
  karte.addControl(
    {
      onAdd: () => {
        knopf.hidden = false;
        gruppe.append(knopf);
        return gruppe;
      },
      onRemove: () => {
        gruppe.remove();
      },
    },
    "top-right",
  );
}

export function zeigeBodengrenzen(karte: maplibregl.Map, ebenen: readonly Kartenebene[], isSichtbar: boolean): void {
  for (const { gebiet } of ebenen) {
    karte.setLayoutProperty(`boden-linie-${gebiet.name}`, "visibility", isSichtbar ? "visible" : "none");
  }
}

/** Bodenbeschreibung unter einem Bildschirmpunkt oder null, wenn dort keine Standortfläche liegt. */
export function bodenAnPunkt(karte: maplibregl.Map, punkt: maplibregl.Point, gebiet: Gebiet): string | null {
  const treffer = karte.queryRenderedFeatures(punkt, { layers: [`boden-flaeche-${gebiet.name}`] })[0];
  if (treffer === undefined) {
    return null;
  }
  const boden: unknown = treffer.properties["boden"];
  return typeof boden === "string" ? boden : null;
}

