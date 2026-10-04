// Karten-Rand: MapLibre mit OpenStreetMap-Hintergrund, Heatmap-Bildern je Gebiet und Bodenflächen.
// OSM-Kacheln: Nutzungsrichtlinie verlangt Namensnennung und geringe Last (private Nutzung).
import maplibregl from "maplibre-gl";
import { faerbeOverlay, type Gebiet, type Pilzkanal } from "./geo.ts";
import type { MarkierterHotspot } from "./hotspots.ts";

const OSM_KACHELN = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_HINWEIS = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>';
const QUELLEN_HINWEIS = "© DLR · © LFB Brandenburg"; // ausführlich in der Legende
const KACHEL_PIXEL = 256;
const MAX_ZOOM = 19;
const START_ZOOM = 13;
const HEATMAP_DECKKRAFT = 0.6; // etwas durchsichtiger, damit Wege darunter lesbar bleiben
const BODEN_LINIENBREITE = 0.6;
const HOTSPOT_QUELLE = "hotspots";
const HOTSPOT_RADIUS_METER = 120; // feste Größe auf dem Boden: der Ring wächst und schrumpft mit der Karte mit
const WEB_MERCATOR_METER_PRO_PIXEL_BEI_ZOOM_0 = 156543.03; // Äquator, 256-px-Kacheln
const HOTSPOT_BREITE_GRAD = 53; // Brandenburg: Meter pro Pixel schrumpfen mit cos(Breite)
const HOTSPOT_MAX_ZOOM = 24;
const HOTSPOT_RAND_BREITE = 7;
const HOTSPOT_RING_BREITE = 3;

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

function bildUrl(daten: ImageData, kanal: Pilzkanal): string {
  const leinwand = document.createElement("canvas");
  leinwand.width = daten.width;
  leinwand.height = daten.height;
  const zeichnung = leinwand.getContext("2d");
  if (zeichnung === null) {
    throw new Error("Invariante verletzt: kein 2D-Zeichenkontext verfügbar");
  }
  zeichnung.putImageData(new ImageData(faerbeOverlay(daten.data, kanal), daten.width, daten.height), 0, 0);
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

function breite(stufen: readonly [number, number, number, number]): maplibregl.ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], stufen[0], stufen[1], stufen[2], stufen[3]];
}

/** Folgt dem Hell/Dunkel-Modus des Geräts: Hintergrundkarte und Wegfarben. */
export function folgeFarbschema(karte: maplibregl.Map, ebenen: readonly Kartenebene[]): void {
  const anwenden = (): void => {
    const schema = farbschema();
    karte.setPaintProperty("osm", "raster-brightness-min", schema.rasterHellMin);
    karte.setPaintProperty("osm", "raster-brightness-max", schema.rasterHellMax);
    karte.setPaintProperty("osm", "raster-hue-rotate", schema.rasterFarbton);
    karte.setPaintProperty("osm", "raster-saturation", schema.rasterSaettigung);
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

export function erzeugeKarte(container: HTMLElement, mitte: readonly [number, number]): maplibregl.Map {
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
  karte.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: true,
    }),
    "top-right",
  );
  karte.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
  // MapLibre klappt den kompakten Quellenhinweis beim Start auf; auf dem Handy verdeckt er dann die Karte.
  karte.on("load", () => {
    container.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
  });
  return karte;
}

export function fuegeEbenenHinzu(karte: maplibregl.Map, ebenen: readonly Kartenebene[], kanal: Pilzkanal): void {
  for (const { gebiet, daten } of ebenen) {
    karte.addSource(`heatmap-${gebiet.name}`, {
      type: "image",
      url: bildUrl(daten, kanal),
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
    karte.addSource(`boden-${gebiet.name}`, { type: "geojson", data: `daten/${gebiet.name}_boden.geojson` });
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
  karte.addSource(quelle, { type: "geojson", data: `daten/${gebiet.name}_wege.geojson` });
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

export function zeigePilz(karte: maplibregl.Map, ebenen: readonly Kartenebene[], kanal: Pilzkanal): void {
  for (const { gebiet, daten } of ebenen) {
    const quelle = karte.getSource(`heatmap-${gebiet.name}`);
    if (!(quelle instanceof maplibregl.ImageSource)) {
      throw new Error(`Invariante verletzt: Heatmap-Quelle für ${gebiet.name} fehlt`);
    }
    quelle.updateImage({ url: bildUrl(daten, kanal) });
  }
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

/** Kreisradius in Bildschirmpixeln für eine feste Bodengröße; wächst pro Zoomstufe um den Faktor 2.
 *  Exponentielle Interpolation mit Basis 2 ist dafür exakt. */
function festerRadius(meter: number): maplibregl.ExpressionSpecification {
  const pixelBeiZoomNull =
    meter / (WEB_MERCATOR_METER_PRO_PIXEL_BEI_ZOOM_0 * Math.cos((HOTSPOT_BREITE_GRAD * Math.PI) / 180));
  return [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    0,
    pixelBeiZoomNull,
    HOTSPOT_MAX_ZOOM,
    pixelBeiZoomNull * 2 ** HOTSPOT_MAX_ZOOM,
  ];
}

/** Ring-Ebene für Brennpunkte; liegt über der Heatmap, die Daten kommen mit zeigeHotspots. */
export function fuegeHotspotEbeneHinzu(karte: maplibregl.Map): void {
  karte.addSource(HOTSPOT_QUELLE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  // Zwei Ringe: dunkler Rand für Kontrast auf Rot und Gelb, farbiger Ring darüber.
  karte.addLayer({
    id: "hotspot-rand",
    type: "circle",
    source: HOTSPOT_QUELLE,
    paint: {
      "circle-radius": festerRadius(HOTSPOT_RADIUS_METER),
      "circle-opacity": 0,
      "circle-stroke-width": HOTSPOT_RAND_BREITE,
      "circle-stroke-color": "#1f3a2a",
      "circle-stroke-opacity": 0.85,
    },
  });
  karte.addLayer({
    id: "hotspot-ring",
    type: "circle",
    source: HOTSPOT_QUELLE,
    paint: {
      "circle-radius": festerRadius(HOTSPOT_RADIUS_METER),
      "circle-opacity": 0,
      "circle-stroke-width": HOTSPOT_RING_BREITE,
      // grün: heute günstig; lila: nur in den letzten Tagen günstig
      "circle-stroke-color": ["match", ["get", "art"], "letzte-tage", "#9b4dca", "#1fbf5b"],
    },
  });
}

export function zeigeHotspots(karte: maplibregl.Map, hotspots: readonly MarkierterHotspot[]): void {
  const quelle = karte.getSource(HOTSPOT_QUELLE);
  if (!(quelle instanceof maplibregl.GeoJSONSource)) {
    throw new Error("Invariante verletzt: Hotspot-Quelle fehlt");
  }
  quelle.setData({
    type: "FeatureCollection",
    features: hotspots.map((hotspot) => ({
      type: "Feature",
      properties: { flaecheHektar: hotspot.flaecheHektar, art: hotspot.art },
      geometry: { type: "Point", coordinates: [hotspot.laenge, hotspot.breite] },
    })),
  });
}
