// Tests für die Brennpunkt-Suche in src/hotspots.ts (synthetische Daten-Bilder, kein Netzwerk).
import { test } from "node:test";
import assert from "node:assert/strict";
import { findeHotspots, hotspotart, koordinateAnPixel, MIN_STUFE } from "../src/hotspots.ts";
import { pixelAnStelle, type Gebiet } from "../src/geo.ts";

const BREITE = 60;
const HOEHE = 60;

function kleinesGebiet(): Gebiet {
  return {
    name: "probe",
    anzeigename: "Probe",
    mitte: [13.7, 52.9],
    breitePixel: BREITE,
    hoehePixel: HOEHE,
    ecken: [
      [13.69, 52.91],
      [13.71, 52.91],
      [13.71, 52.89],
      [13.69, 52.89],
    ],
  };
}

function bildMitBlock(stufe: number, block: { von: number; bis: number }): Uint8ClampedArray {
  const daten = new Uint8ClampedArray(BREITE * HOEHE * 4);
  for (let zeile = block.von; zeile < block.bis; zeile += 1) {
    for (let spalte = block.von; spalte < block.bis; spalte += 1) {
      daten[(zeile * BREITE + spalte) * 4 + 1] = stufe;
    }
  }
  return daten;
}

test("ein 30x30-Pixel-Block mit Stufe 95 ergibt genau einen Brennpunkt mit 9 Hektar und Anker in seiner Mitte", () => {
  const gebiet = kleinesGebiet();
  const treffer = findeHotspots({ daten: bildMitBlock(95, { von: 10, bis: 40 }), kanal: 1, gebiet });
  assert.equal(treffer.length, 1);
  const erster = treffer[0];
  assert.ok(erster !== undefined);
  assert.equal(erster.flaecheHektar, 9);
  const pixel = pixelAnStelle(gebiet, erster.laenge, erster.breite);
  assert.ok(pixel !== null);
  assert.ok(Math.abs(pixel.spalte - 25) <= 1 && Math.abs(pixel.zeile - 25) <= 1);
});

test("Stufe knapp unter der Schwelle ergibt keinen Brennpunkt", () => {
  const treffer = findeHotspots({ daten: bildMitBlock(MIN_STUFE - 1, { von: 10, bis: 40 }), kanal: 1, gebiet: kleinesGebiet() });
  assert.deepEqual(treffer, []);
});

test("ein zu kleiner Fleck von 2 Zellen wird nicht markiert", () => {
  const treffer = findeHotspots({ daten: bildMitBlock(100, { von: 10, bis: 20 }), kanal: 1, gebiet: kleinesGebiet() });
  assert.deepEqual(treffer, []);
});

test("der Pfifferling-Kanal ignoriert hohe Werte des Steinpilz-Kanals", () => {
  const treffer = findeHotspots({ daten: bildMitBlock(95, { von: 10, bis: 40 }), kanal: 2, gebiet: kleinesGebiet() });
  assert.deepEqual(treffer, []);
});

test("koordinateAnPixel ist die Umkehrung von pixelAnStelle", () => {
  const gebiet = kleinesGebiet();
  const [laenge, breite] = koordinateAnPixel(gebiet, 17, 42);
  assert.deepEqual(pixelAnStelle(gebiet, laenge, breite), { spalte: 17, zeile: 42 });
});

test("Hotspot-Art: heute günstig heißt heute, sonst nur in den letzten Tagen günstig heißt letzte-tage", () => {
  const faelle: readonly { indexHeute: number; hoechsterIndexLetzteTage: number; erwartet: string | null }[] = [
    { indexHeute: 60, hoechsterIndexLetzteTage: 60, erwartet: "heute" },
    { indexHeute: 20, hoechsterIndexLetzteTage: 75, erwartet: "letzte-tage" },
    { indexHeute: 59, hoechsterIndexLetzteTage: 59, erwartet: null },
    { indexHeute: 0, hoechsterIndexLetzteTage: 0, erwartet: null },
  ];
  for (const fall of faelle) {
    assert.equal(hotspotart(fall.indexHeute, fall.hoechsterIndexLetzteTage), fall.erwartet);
  }
});

test("der Umriss eines 3x3-Zellen-Blocks besteht nur aus seinen 12 Außenkanten auf dem Blockrand", () => {
  const gebiet = kleinesGebiet();
  const [erster] = findeHotspots({ daten: bildMitBlock(95, { von: 10, bis: 40 }), kanal: 1, gebiet });
  assert.ok(erster !== undefined);
  assert.equal(erster.umriss.length, 12);
  const [links, oben] = koordinateAnPixel(gebiet, 9.5, 9.5);
  const [rechts, unten] = koordinateAnPixel(gebiet, 39.5, 39.5);
  const toleranz = 1e-9;
  for (const strecke of erster.umriss) {
    for (const [laenge, breite] of strecke) {
      const isAmRand =
        Math.abs(laenge - links) < toleranz ||
        Math.abs(laenge - rechts) < toleranz ||
        Math.abs(breite - oben) < toleranz ||
        Math.abs(breite - unten) < toleranz;
      assert.ok(isAmRand, `Ecke ${String(laenge)}/${String(breite)} liegt nicht auf dem Blockrand`);
    }
  }
});

test("bei einer L-förmigen Fläche liegt der Ankerpunkt auf der Fläche, nicht im leeren Schwerpunkt", () => {
  const gebiet = kleinesGebiet();
  const daten = new Uint8ClampedArray(BREITE * HOEHE * 4);
  // L aus zwei Balken: Zeilen 0-9 über die ganze Breite, Spalten 0-9 über die ganze Höhe.
  for (let zeile = 0; zeile < HOEHE; zeile += 1) {
    for (let spalte = 0; spalte < BREITE; spalte += 1) {
      if (zeile < 10 || spalte < 10) {
        daten[(zeile * BREITE + spalte) * 4 + 1] = 95;
      }
    }
  }
  const [erster] = findeHotspots({ daten, kanal: 1, gebiet });
  assert.ok(erster !== undefined);
  const pixel = pixelAnStelle(gebiet, erster.laenge, erster.breite);
  assert.ok(pixel !== null);
  assert.ok(pixel.zeile < 10 || pixel.spalte < 10, `Anker bei ${String(pixel.spalte)}/${String(pixel.zeile)} liegt außerhalb der Fläche`);
});
