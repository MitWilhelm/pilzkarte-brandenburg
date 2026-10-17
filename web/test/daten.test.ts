// Tests für das Zusammenfügen von Haupt- und Reizker-Bild (src/clients/daten.ts, ohne Netzwerk).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fuegeReizkerEin, grenzeAusJson } from "../src/clients/daten.ts";

test("die Reizker-Stufe wird als Alpha eingesetzt, die anderen Kanäle bleiben", () => {
  const haupt = { data: new Uint8ClampedArray([1, 70, 80, 255, 2, 0, 0, 255]) };
  const reizker = { data: new Uint8ClampedArray([95, 95, 95, 255, 0, 0, 0, 255]) };
  assert.deepEqual([...fuegeReizkerEin(haupt, reizker).data], [1, 70, 80, 95, 2, 0, 0, 0]);
});

test("Bilder verschiedener Größe sind eine verletzte Invariante", () => {
  const haupt = { data: new Uint8ClampedArray(8) };
  const reizker = { data: new Uint8ClampedArray(4) };
  assert.throws(() => fuegeReizkerEin(haupt, reizker), /Invariante verletzt: Reizker-Bild/);
});

const QUADRAT = [[13.4, 52.5], [14.2, 52.5], [14.2, 53.1], [13.4, 53.1], [13.4, 52.5]];

test("die Grenze aus einem MultiPolygon liefert die Außenringe und ihr Rechteck", () => {
  const inhalt = { features: [{ geometry: { type: "MultiPolygon", coordinates: [[QUADRAT, [[13.6, 52.7], [13.7, 52.7], [13.7, 52.8], [13.6, 52.7]]]] } }] };
  const grenze = grenzeAusJson(inhalt);
  assert.equal(grenze.ringe.length, 1);
  assert.deepEqual([grenze.west, grenze.sued, grenze.ost, grenze.nord], [13.4, 52.5, 14.2, 53.1]);
});

test("ein einfaches Polygon wird wie ein MultiPolygon mit einem Teil gelesen", () => {
  assert.equal(grenzeAusJson({ features: [{ geometry: { type: "Polygon", coordinates: [QUADRAT] } }] }).ringe.length, 1);
});

test("eine Grenze mit anderer Geometrie ist eine verletzte Invariante", () => {
  assert.throws(() => grenzeAusJson({ features: [{ geometry: { type: "Point", coordinates: [13, 52] } }] }), /Invariante verletzt: Grenze hat die Geometrie Point/);
});
