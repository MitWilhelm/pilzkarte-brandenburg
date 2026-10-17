// Tests für das Zusammenfügen von Haupt- und Reizker-Bild (src/clients/daten.ts, ohne Netzwerk).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fuegeReizkerEin } from "../src/clients/daten.ts";

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
