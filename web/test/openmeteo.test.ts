// Tests für die Prüfung der Open-Meteo-Antwort – gegen eine echte, per GitHub Actions geholte Antwort.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { wetterAusAntwort, wetterUrl } from "../src/clients/openmeteo.ts";
import { indexverlauf } from "../src/wachstum.ts";

const echteAntwort: unknown = JSON.parse(
  readFileSync(new URL("./fixtures/openmeteo_joachimsthal.json", import.meta.url), "utf8"),
);

test("die echte Antwort ergibt 28 Tage mit heute an Position 20", () => {
  const reihe = wetterAusAntwort(echteAntwort);
  assert.equal(reihe.tage.length, 28);
  assert.equal(reihe.heute, 20);
  assert.equal(reihe.tage[0]?.datum, "2026-09-13");
});

test("Bodentemperatur und Bodenfeuchte sind plausible Tagesmittel", () => {
  for (const tag of wetterAusAntwort(echteAntwort).tage) {
    assert.ok(tag.bodentempC > -10 && tag.bodentempC < 35, `Bodentemperatur ${String(tag.bodentempC)}`);
    assert.ok(tag.bodenfeuchte >= 0 && tag.bodenfeuchte <= 0.6, `Bodenfeuchte ${String(tag.bodenfeuchte)}`);
  }
});

test("aus der echten Antwort entsteht ein Verlauf von heute plus sieben Tagen mit Index 0 bis 100", () => {
  const reihe = wetterAusAntwort(echteAntwort);
  const verlauf = indexverlauf(reihe.tage, reihe.heute, "steinpilz");
  assert.equal(verlauf.length, 8);
  for (const tag of verlauf) {
    assert.ok(tag.index >= 0 && tag.index <= 100);
  }
});

test("eine Antwort ohne Tageswerte meldet eine verletzte Invariante", () => {
  assert.throws(() => wetterAusAntwort({ hourly: {} }), /Invariante verletzt: Open-Meteo-Antwort ohne Feld daily/);
});

test("die Abfrage-URL fordert 20 Tage Vergangenheit in Ortszeit an", () => {
  const url = new URL(wetterUrl(52.979, 13.745));
  assert.equal(url.searchParams.get("past_days"), "20");
  assert.equal(url.searchParams.get("timezone"), "Europe/Berlin");
});
