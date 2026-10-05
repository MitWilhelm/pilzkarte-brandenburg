// Tests für die Auswahl der Top-Sammelplätze und das Prüfen von tageswerte.json (src/tageswerte.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { tageswerteAusJson, topSammelplaetze, wetterSchluessel, type Tagesbrennpunkt } from "../src/tageswerte.ts";

function punkt(name: string, art: Tagesbrennpunkt["art"], flaecheHektar: number, laenge: number): Tagesbrennpunkt {
  // Längengrade 0,1° auseinander sind bei 52,8° Breite gut 6 km: weit genug für getrennte Tipps.
  const kern = { laenge, breite: 52.8, flaecheHektar: 9, mittlereStufe: 95, ecken: [[laenge, 52.8], [laenge, 52.8], [laenge, 52.8], [laenge, 52.8]] as const };
  return { gebietName: name, laenge, breite: 52.8, flaecheHektar, zellen: [1, 2, 3], art, indexHeute: 70, kern };
}

test("heute wachsende Flächen kommen vor denen der letzten Tage, auch wenn diese größer sind", () => {
  const top = topSammelplaetze([punkt("alt-gross", "letzte-tage", 500, 13.5), punkt("heute-klein", "heute", 10, 13.6)], 5);
  assert.deepEqual(top.map((eintrag) => eintrag.gebietName), ["heute-klein", "alt-gross"]);
});

test("innerhalb derselben Art entscheidet die zusammenhängende Größe, bei Gleichstand der Index", () => {
  const top = topSammelplaetze(
    [
      punkt("klein", "heute", 20, 13.5),
      punkt("gross", "heute", 90, 13.6),
      { ...punkt("gleich-hoch", "heute", 50, 13.7), indexHeute: 80 },
      { ...punkt("gleich-tief", "heute", 50, 13.8), indexHeute: 60 },
    ],
    5,
  );
  assert.deepEqual(top.map((eintrag) => eintrag.gebietName), ["gross", "gleich-hoch", "gleich-tief", "klein"]);
});

test("eine Fläche näher als 3 km an einem besseren Tipp zählt als derselbe Ort und rückt nicht nach", () => {
  const top = topSammelplaetze([punkt("a", "heute", 100, 13.5), punkt("a-nachbar", "heute", 90, 13.52), punkt("b", "heute", 80, 13.7)], 5);
  assert.deepEqual(top.map((eintrag) => eintrag.gebietName), ["a", "b"]);
});

test("es werden höchstens so viele Tipps wie verlangt ausgewählt", () => {
  const punkte = [13.0, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6].map((laenge, nummer) => punkt(`p${String(nummer)}`, "heute", 10 + nummer, laenge));
  assert.equal(topSammelplaetze(punkte, 5).length, 5);
});

test("nahe Stellen teilen sich eine Wetter-Rasterzelle, entfernte nicht", () => {
  assert.equal(wetterSchluessel(52.801, 13.701), wetterSchluessel(52.804, 13.704));
  assert.notEqual(wetterSchluessel(52.80, 13.70), wetterSchluessel(52.86, 13.70));
});

test("tageswerte.json wird geprüft und eine unbekannte Art meldet eine verletzte Invariante", () => {
  const gueltig = { erstellt: "2026-10-05T04:00:00Z", steinpilz: [punkt("a", "heute", 12, 13.5)], pfifferling: [] };
  assert.equal(tageswerteAusJson(gueltig).steinpilz[0]?.flaecheHektar, 12);
  const falsch = { ...gueltig, steinpilz: [{ ...punkt("a", "heute", 12, 13.5), art: "morgen" }] };
  assert.throws(() => tageswerteAusJson(falsch), /Invariante verletzt: tageswerte.json, unbekannte Art morgen/);
});
