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
const HEATMAP_DECKKRAFT = 0.68;
const BODEN_LINIENBREITE = 0.6;
const HOTSPOT_QUELLE = "hotspots";
const HOTSPOT_RADIUS = 20; // Bildschirmpixel: bleibt bei jedem Zoom gut antippbar und sichtbar
const HOTSPOT_RAND_BREITE = 7;
const HOTSPOT_RING_BREITE = 3;

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
      layers: [{ id: "osm", type: "raster", source: "osm" }],
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
  }
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

/** Ring-Ebene für Brennpunkte; liegt über der Heatmap, die Daten kommen mit zeigeHotspots. */
export function fuegeHotspotEbeneHinzu(karte: maplibregl.Map): void {
  karte.addSource(HOTSPOT_QUELLE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  // Zwei Ringe: dunkler Rand für Kontrast auf Rot und Gelb, farbiger Ring darüber.
  karte.addLayer({
    id: "hotspot-rand",
    type: "circle",
    source: HOTSPOT_QUELLE,
    paint: {
      "circle-radius": HOTSPOT_RADIUS,
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
      "circle-radius": HOTSPOT_RADIUS,
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
