// Tests für die reinen Index-Funktionen in src/wachstum.ts (node --test, ohne Netzwerk).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bodenfeuchtefaktor,
  bodentemperaturfaktor,
  frostfaktor,
  hitzefaktor,
  regenfaktor,
  saisonfaktor,
  tagesindex,
  wirksamerRegen,
  type Tageswetter,
} from "../src/wachstum.ts";

function tag(datum: string, regenMm: number, lufttempMinC = 8): Tageswetter {
  return { datum, regenMm, lufttempMinC, lufttempMittelC: 13, bodentempC: 13, bodenfeuchte: 0.18 };
}

function reihe(regen: readonly number[]): Tageswetter[] {
  return regen.map((mm, nummer) => tag(`2026-09-${String(nummer + 1).padStart(2, "0")}`, mm));
}

test("Regen zählt eine bis zwei Wochen danach voll, kurz danach und nach drei Wochen weniger", () => {
  assert.equal(wirksamerRegen(reihe([10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 10, "steinpilz"), 10);
  assert.equal(wirksamerRegen(reihe([0, 0, 10]), 2, "steinpilz"), 3.5);
  assert.equal(wirksamerRegen(reihe([10, ...Array.from({ length: 22 }, () => 0)]), 22, "steinpilz"), 0);
});

test("der Regenfaktor steigt stufenlos und ist bei gutem Boden auch ohne Regen mittel", () => {
  const faelle: readonly { mm: number; bodenanteil: number; erwartet: number }[] = [
    { mm: 0, bodenanteil: 0, erwartet: 0.2 },
    { mm: 0, bodenanteil: 1, erwartet: 0.5 },
    { mm: 0, bodenanteil: 0.5, erwartet: 0.35 },
    { mm: 10, bodenanteil: 1, erwartet: 0.75 },
    { mm: 20, bodenanteil: 0, erwartet: 1 },
    { mm: 40, bodenanteil: 1, erwartet: 1 },
  ];
  for (const fall of faelle) {
    assert.ok(Math.abs(regenfaktor(fall.mm, fall.bodenanteil) - fall.erwartet) < 1e-9, JSON.stringify(fall));
  }
});

test("warm und trocken bremst stark, warm mit Regen oder kühl und trocken nicht", () => {
  assert.equal(hitzefaktor(18, 0.5), 0.2);
  assert.equal(hitzefaktor(18, 2), 1);
  assert.equal(hitzefaktor(15, 0), 1);
});

test("Bodentemperatur zwischen 10 und 18 Grad ist ideal, Kälte und Hitze senken den Faktor", () => {
  assert.equal(bodentemperaturfaktor(14), 1);
  assert.equal(bodentemperaturfaktor(4), 0);
  assert.equal(bodentemperaturfaktor(7), 0.5);
  assert.ok(bodentemperaturfaktor(22) < 1);
});

test("trockener Sand senkt den Feuchtefaktor, schließt aber nichts ganz aus", () => {
  assert.equal(bodenfeuchtefaktor(0.02), 0.25);
  assert.equal(bodenfeuchtefaktor(0.2), 1);
});

test("Anfang Oktober ist Hochsaison für den Steinpilz und Spätsaison für den Pfifferling", () => {
  assert.equal(saisonfaktor("steinpilz", "2026-10-03"), 1);
  assert.equal(saisonfaktor("pfifferling", "2026-10-03"), 0.6);
  assert.equal(saisonfaktor("pfifferling", "2026-12-15"), 0.05);
});

test("Nachtfrost in den letzten drei Tagen senkt den Index", () => {
  const tage = [tag("2026-10-01", 0, 5), tag("2026-10-02", 0, -4), tag("2026-10-03", 0, 6)];
  assert.equal(frostfaktor(tage, 2), 0.2);
});

test("zehn Tage nach kräftigem Regen bei mildem feuchtem Boden ergibt im Oktober Index 100 für den Steinpilz", () => {
  const tage = Array.from({ length: 12 }, (_, nummer) =>
    tag(`2026-10-${String(nummer + 1).padStart(2, "0")}`, nummer === 1 ? 20 : 0),
  );
  const ergebnis = tagesindex(tage, 11, "steinpilz");
  assert.equal(ergebnis.wirksamerRegenMm, 20);
  assert.equal(ergebnis.index, 100);
});

test("ohne Regen, aber mit feuchtem Boden und 13 Grad ergibt sich ein mittlerer Index von 50", () => {
  const tage = Array.from({ length: 12 }, (_, nummer) => tag(`2026-10-${String(nummer + 1).padStart(2, "0")}`, 0));
  assert.equal(tagesindex(tage, 11, "steinpilz").index, 50);
});

test("ein Tag außerhalb der Reihe meldet eine verletzte Invariante", () => {
  assert.throws(() => tagesindex(reihe([0]), 3, "pfifferling"), /Invariante verletzt/);
});

test("die Wortskala ordnet den Index in fünf Stufen ein", async () => {
  const { indexWort } = await import("../src/wachstum.ts");
  assert.equal(indexWort(85), "Sehr günstig");
  assert.equal(indexWort(20), "Mäßig");
  assert.equal(indexWort(0), "Ungünstig");
});
