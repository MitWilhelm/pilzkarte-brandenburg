// Tests für die reinen Geo-Hilfen in src/geo.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { baumartName, googleMapsRoute, pixelAnStelle, standortAusGpsEreignis, stufeninfo, type Gebiet } from "../src/geo.ts";

// Werte wie in web/public/daten/gebiete.json (Export vom 03.10.2026).
function joachimsthal(): Gebiet {
  return {
    name: "joachimsthal",
    anzeigename: "Joachimsthal",
    mitte: [13.745, 52.979],
    breitePixel: 672,
    hoehePixel: 673,
    ecken: [
      [13.694949, 53.009198],
      [13.795107, 53.009198],
      [13.795107, 52.948802],
      [13.694949, 52.948802],
    ],
  };
}

test("die linke obere Ecke liegt im ersten Pixel", () => {
  assert.deepEqual(pixelAnStelle(joachimsthal(), 13.69496, 53.00919), { spalte: 0, zeile: 0 });
});

test("die Gebietsmitte liegt ungefähr in der Bildmitte, wegen Mercator leicht nach unten versetzt", () => {
  const pixel = pixelAnStelle(joachimsthal(), 13.745, 52.979);
  assert.ok(pixel !== null);
  assert.ok(Math.abs(pixel.spalte - 336) <= 1);
  assert.ok(Math.abs(pixel.zeile - 336) <= 2);
});

test("eine Stelle außerhalb des Gebiets ergibt kein Pixel", () => {
  assert.equal(pixelAnStelle(joachimsthal(), 13.5, 52.9), null);
});

test("Stufen werden den fünf Klassen zugeordnet und null bleibt ohne Klasse", () => {
  assert.equal(stufeninfo(95)?.name, "Sehr gut");
  assert.equal(stufeninfo(50)?.name, "Möglich");
  assert.equal(stufeninfo(0), null);
});

test("Baumart-Index 0 ist Kiefer und 255 bedeutet kein Wald", () => {
  assert.equal(baumartName(0), "Kiefer");
  assert.equal(baumartName(255), null);
  assert.throws(() => baumartName(42), /Invariante verletzt/);
});

test("der Google-Maps-Link enthält das Ziel mit fünf Nachkommastellen", () => {
  assert.equal(
    googleMapsRoute(52.81512, 13.71234),
    "https://www.google.com/maps/dir/?api=1&destination=52.81512,13.71234",
  );
});

test("die Heatmap färbt nur Pixel mit Stufe und lässt den Rest durchsichtig", async () => {
  const { faerbeOverlay } = await import("../src/geo.ts");
  const daten = new Uint8ClampedArray([0, 95, 0, 255, 0, 0, 55, 255]);
  assert.deepEqual([...faerbeOverlay(daten, 1)], [122, 28, 18, 255, 0, 0, 0, 0]);
  assert.deepEqual([...faerbeOverlay(daten, 2)], [0, 0, 0, 0, 250, 228, 150, 255]);
});

test("ein GPS-Ereignis mit Werten am Prototyp (wie im Browser) wird gelesen, ein unvollständiges abgelehnt", () => {
  class Koordinaten {
    get latitude(): number {
      return 52.99622;
    }
    get longitude(): number {
      return 13.71053;
    }
    get accuracy(): number {
      return 8.5;
    }
  }
  class Position {
    get coords(): Koordinaten {
      return new Koordinaten();
    }
    get timestamp(): number {
      return 1759650000000;
    }
  }
  assert.deepEqual(standortAusGpsEreignis(new Position()), {
    breite: 52.99622,
    laenge: 13.71053,
    genauigkeitMeter: 8.5,
    zeitpunktMs: 1759650000000,
  });
  assert.throws(() => standortAusGpsEreignis({ coords: { latitude: 52.9 }, timestamp: 1 }), /Invariante verletzt: GPS-Ereignis/);
  assert.throws(() => standortAusGpsEreignis(null), /Invariante verletzt: GPS-Ereignis/);
  assert.throws(
    () => standortAusGpsEreignis({ coords: { latitude: "52.9", longitude: 13.7, accuracy: 5 }, timestamp: 1 }),
    /latitude ist keine Zahl/,
  );
});
