// Tests für die reinen Index-Funktionen in src/wachstum.ts (node --test, ohne Netzwerk).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bodenfeuchtefaktor,
  bodentemperaturfaktor,
  frostfaktor,
  regenfaktor,
  saisonfaktor,
  tageSeitAusloeser,
  tagesindex,
  type Tageswetter,
} from "../src/wachstum.ts";

function tag(datum: string, regenMm: number, lufttempMinC = 8): Tageswetter {
  return { datum, regenMm, lufttempMinC, bodentempC: 13, bodenfeuchte: 0.18 };
}

function reihe(regen: readonly number[]): Tageswetter[] {
  return regen.map((mm, nummer) => tag(`2026-09-${String(nummer + 1).padStart(2, "0")}`, mm));
}

test("ein kräftiger Regen wird als Auslöser erkannt und die Tage danach werden gezählt", () => {
  const tage = reihe([0, 15, 0, 0, 0, 0, 0, 0]);
  assert.equal(tageSeitAusloeser(tage, 7), 6);
});

test("mehrere kleine Regen innerhalb von drei Tagen zählen zusammen als Auslöser", () => {
  const tage = reihe([5, 4, 4, 0, 0]);
  assert.equal(tageSeitAusloeser(tage, 4), 2);
});

test("ohne genug Regen gibt es keinen Auslöser", () => {
  assert.equal(tageSeitAusloeser(reihe([2, 3, 1, 0, 4, 2]), 5), null);
});

test("der Regenfaktor ist eine Woche nach dem Auslöser beim Steinpilz am höchsten", () => {
  assert.equal(regenfaktor("steinpilz", 10), 1);
  assert.ok(regenfaktor("steinpilz", 2) < 0.5);
  assert.ok(regenfaktor("steinpilz", 30) < 0.5);
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
  assert.equal(ergebnis.tageSeitAusloeser, 10);
  assert.equal(ergebnis.index, 100);
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
