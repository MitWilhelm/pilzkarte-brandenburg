// Karten-Rand: MapLibre mit OpenStreetMap-Hintergrund, Heatmap-Bildern je Gebiet und Bodenflächen.
// OSM-Kacheln: Nutzungsrichtlinie verlangt Namensnennung und geringe Last (private Nutzung).
import maplibregl from "maplibre-gl";
import { faerbeOverlay, kreisPolygon, standortAusGpsEreignis, type Gebiet, type Pilzkanal, type Standort } from "./geo.ts";
import { faerbeBrennpunkte, type Brennpunktflaeche } from "./hotspots.ts";

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
const TIPP_FENSTER_ABSTAND = 26; // Pixel vom Mittelpunkt der runden Tipp-Markierung
const TIPP_QUELLE = "tipp-kerne";
const TIPP_RAHMEN_RAND = "tipp-kerne-rand";
const TIPP_RAHMEN = "tipp-kerne-linie";

export interface Kartenebene {
  readonly gebiet: Gebiet;
  readonly daten: ImageData;
}

export interface Heatmapansicht {
  readonly kanal: Pilzkanal;
  readonly brennpunkte: readonly Brennpunktflaeche[] | null; // null: normale Heatmap; sonst Flächen farbig, Rest grau
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
): maplibregl.Map {
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
  karte.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
  // MapLibre klappt den kompakten Quellenhinweis beim Start auf; auf dem Handy verdeckt er dann die Karte.
  karte.on("load", () => {
    container.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
  });
  return karte;
}

const GPS_FEHLER_VERWEIGERT = 1; // GeolocationPositionError.PERMISSION_DENIED
const HINWEIS_GPS_BLOCKIERT =
  "Der Standort ist für diese Seite nicht freigegeben, deshalb sind GPS und Melden aus. Android: Einstellungen › Apps › Ihr Browser (z. B. Opera, Chrome) › Berechtigungen › Standort › Zulassen, und im Browser für diese Seite den Standort erlauben. iPhone: Einstellungen › Datenschutz & Sicherheit › Ortungsdienste einschalten, dort „Safari-Websites“ auf „Beim Verwenden der App“. Danach den Standort-Knopf erneut tippen.";
const HINWEIS_GPS_KEIN_SIGNAL = "Kein GPS-Standort gefunden. Kurz unter freiem Himmel warten und den Standort-Knopf erneut tippen.";
const HINWEIS_GPS_FEHLT = "Dieser Browser kann keinen Standort liefern.";
const GPS_OPTIONEN: PositionOptions = { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 };
const GPS_ZOOM = 15;
const GPS_QUELLE = "gps-genauigkeit";

/** Was der GPS-Knopf meldet: jeden neuen Standort und ein Problem (null: keins). */
export interface Gpsmeldungen {
  readonly beiStandort: (standort: Standort) => void;
  readonly beiProblem: (hinweis: string | null) => void;
}

function zeigeGenauigkeit(karte: maplibregl.Map, standort: Standort): void {
  const flaeche = {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Polygon" as const, coordinates: [kreisPolygon([standort.laenge, standort.breite], standort.genauigkeitMeter).map(([x, y]) => [x, y])] },
  };
  const quelle = karte.getSource(GPS_QUELLE);
  if (quelle instanceof maplibregl.GeoJSONSource) {
    quelle.setData(flaeche);
    return;
  }
  karte.addSource(GPS_QUELLE, { type: "geojson", data: flaeche });
  karte.addLayer({ id: GPS_QUELLE, type: "fill", source: GPS_QUELLE, paint: { "fill-color": "#2f7bf6", "fill-opacity": 0.15 } });
}

/**
 * Eigener GPS-Knopf statt MapLibres GeolocateControl: Jedes Antippen fragt den Standort aktiv ab (der Browser zeigt
 * dabei seine Freigabe-Abfrage). MapLibre prüfte die Erlaubnis nur einmal beim Laden und schaltete den Knopf bei
 * "verweigert" dauerhaft ab, auch wenn der Nutzer danach freigab (gemeldet mit Opera auf Android).
 * Zweites Antippen beendet die Ortung.
 */
export function richteGpsEin(karte: maplibregl.Map, knopf: HTMLButtonElement, meldungen: Gpsmeldungen): void {
  let beobachtung: number | null = null;
  let isErsterStandort = true;
  const punkt = document.createElement("div");
  punkt.className = "gps-punkt";
  const markierung = new maplibregl.Marker({ element: punkt });
  const beende = (): void => {
    if (beobachtung !== null) {
      navigator.geolocation.clearWatch(beobachtung);
    }
    beobachtung = null;
    knopf.setAttribute("aria-pressed", "false");
    delete knopf.dataset["zustand"];
  };
  fuegeKnopfHinzu(karte, knopf);
  knopf.addEventListener("click", () => {
    if (beobachtung !== null) {
      beende();
      markierung.remove();
      return;
    }
    if (!("geolocation" in navigator)) {
      meldungen.beiProblem(HINWEIS_GPS_FEHLT);
      return;
    }
    isErsterStandort = true;
    knopf.setAttribute("aria-pressed", "true");
    knopf.dataset["zustand"] = "sucht";
    beobachtung = navigator.geolocation.watchPosition(
      (position) => {
        const standort = standortAusGpsEreignis(position);
        knopf.dataset["zustand"] = "aktiv";
        markierung.setLngLat([standort.laenge, standort.breite]).addTo(karte);
        zeigeGenauigkeit(karte, standort);
        if (isErsterStandort) {
          isErsterStandort = false;
          karte.easeTo({ center: [standort.laenge, standort.breite], zoom: Math.max(karte.getZoom(), GPS_ZOOM) });
        }
        meldungen.beiProblem(null);
        meldungen.beiStandort(standort);
      },
      (fehler) => {
        meldungen.beiProblem(fehler.code === GPS_FEHLER_VERWEIGERT ? HINWEIS_GPS_BLOCKIERT : HINWEIS_GPS_KEIN_SIGNAL);
        if (fehler.code === GPS_FEHLER_VERWEIGERT) {
          beende();
        }
      },
      GPS_OPTIONEN,
    );
  });
}

/** Neue Kartenebenen kommen unter die Tipp-Rahmen, damit später geladene Kacheln sie nicht überdecken. */
function vorTipps(karte: maplibregl.Map): string | undefined {
  return karte.getLayer(TIPP_RAHMEN_RAND) === undefined ? undefined : TIPP_RAHMEN_RAND;
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
    }, vorTipps(karte));
    karte.addSource(`boden-${gebiet.name}`, { type: "geojson", data: `${gebiet.ordner}/${gebiet.name}_boden.geojson` });
    // Unsichtbare Füllung, damit ein Tipp die Bodenfläche findet; Linien nur auf Wunsch sichtbar.
    karte.addLayer({
      id: `boden-flaeche-${gebiet.name}`,
      type: "fill",
      source: `boden-${gebiet.name}`,
      paint: { "fill-opacity": 0 },
    }, vorTipps(karte));
    karte.addLayer({
      id: `boden-linie-${gebiet.name}`,
      type: "line",
      source: `boden-${gebiet.name}`,
      layout: { visibility: "none" },
      paint: { "line-color": "#4b3a6b", "line-width": BODEN_LINIENBREITE },
    }, vorTipps(karte));
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
  }, vorTipps(karte));
  karte.addLayer({
    id: `wege-rand-${gebiet.name}`,
    type: "line",
    source: quelle,
    filter: ["==", ["get", "art"], "weg"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": schema.wegRand, "line-width": breite(WEG_RAND_BREITE) },
  }, vorTipps(karte));
  karte.addLayer({
    id: `wege-${gebiet.name}`,
    type: "line",
    source: quelle,
    filter: ["==", ["get", "art"], "weg"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": schema.weg, "line-width": breite(WEG_BREITE) },
  }, vorTipps(karte));
  karte.addLayer({
    id: `strassen-rand-${gebiet.name}`,
    type: "line",
    source: quelle,
    filter: ["==", ["get", "art"], "strasse"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": schema.strasseRand, "line-width": breite(STRASSE_RAND_BREITE) },
  }, vorTipps(karte));
  karte.addLayer({
    id: `strassen-${gebiet.name}`,
    type: "line",
    source: quelle,
    filter: ["==", ["get", "art"], "strasse"],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": schema.strasse, "line-width": breite(STRASSE_BREITE) },
  }, vorTipps(karte));
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


/** Eine Tipp-Markierung: Nummer, Stelle und die Zeilen für das Fenster beim Antippen. */
export interface Tippmarke {
  readonly nummer: number;
  readonly laenge: number;
  readonly breite: number;
  readonly zeilen: readonly string[];
  readonly ecken: readonly (readonly [number, number])[]; // Rahmen der Kernfläche (bis 10 ha)
}

const SVG_NS = "http://www.w3.org/2000/svg";

function pfad(d: string, klasse: string): SVGPathElement {
  const element = document.createElementNS(SVG_NS, "path");
  element.setAttribute("d", d);
  element.setAttribute("class", klasse);
  return element;
}

function pilzSymbol(): SVGSVGElement {
  const symbol = document.createElementNS(SVG_NS, "svg");
  symbol.setAttribute("viewBox", "0 0 24 24");
  symbol.setAttribute("width", "24");
  symbol.setAttribute("height", "24");
  symbol.setAttribute("aria-hidden", "true");
  // Steinpilz: breiter brauner Hut, dicker heller Stiel
  symbol.append(pfad("M9 12.5h6l.8 6.2a3.8 3.8 0 0 1-7.6 0z", "tipp-stiel"), pfad("M2.5 12.5C3.2 6.8 7.2 4 12 4s8.8 2.8 9.5 8.5z", "tipp-hut"));
  return symbol;
}

/** Setzt die Tipp-Markierungen (Pilz-Symbol mit Nummer) und rahmt ihre Kernfläche; Antippen öffnet ein Fenster. */
export function zeigeTipps(karte: maplibregl.Map, tipps: readonly Tippmarke[]): void {
  karte.addSource(TIPP_QUELLE, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: tipps.map((tipp) => ({
        type: "Feature",
        properties: { nummer: tipp.nummer },
        geometry: { type: "LineString", coordinates: [...tipp.ecken, ...tipp.ecken.slice(0, 1)].map(([laenge, breite]) => [laenge, breite]) },
      })),
    },
  });
  // Dunkler Rand unter der türkisen Linie: sichtbar auf Heatmap-Rot wie auf hellem Hintergrund.
  karte.addLayer({ id: TIPP_RAHMEN_RAND, type: "line", source: TIPP_QUELLE, paint: { "line-color": "#0b0f14", "line-width": 6 } });
  karte.addLayer({ id: TIPP_RAHMEN, type: "line", source: TIPP_QUELLE, paint: { "line-color": "#00e5ff", "line-width": 3 } });
  for (const tipp of tipps) {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "tipp-marke";
    knopf.setAttribute("aria-label", `Tipp ${String(tipp.nummer)}: ${tipp.zeilen.join(", ")}`);
    const nummer = document.createElement("span");
    nummer.className = "tipp-nummer";
    nummer.textContent = String(tipp.nummer);
    knopf.append(pilzSymbol(), nummer);
    const inhalt = document.createElement("div");
    inhalt.className = "tipp-fenster";
    for (const zeile of tipp.zeilen) {
      const absatz = document.createElement("p");
      absatz.textContent = zeile;
      inhalt.append(absatz);
    }
    const fenster = new maplibregl.Popup({ offset: TIPP_FENSTER_ABSTAND, maxWidth: "260px" }).setDOMContent(inhalt);
    new maplibregl.Marker({ element: knopf, anchor: "center" }).setLngLat([tipp.laenge, tipp.breite]).setPopup(fenster).addTo(karte);
  }
}
