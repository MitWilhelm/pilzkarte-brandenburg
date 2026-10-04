// Tests für die Prüfung der Open-Meteo-Antwort – gegen eine echte, per GitHub Actions geholte Antwort.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { wetterAusAntwort, wetterUrl } from "../src/clients/openmeteo.ts";
import { indexverlauf } from "../src/wachstum.ts";

const echteAntwort: unknown = JSON.parse(
  readFileSync(new URL("./fixtures/openmeteo_joachimsthal.json", import.meta.url), "utf8"),
);

interface Rohantwort {
  hourly: Record<string, (number | null)[]>;
}

// Frische Kopie je Test, damit sich die Tests nicht gegenseitig verändern (Regel 9: keine geteilten Fixtures).
function frischeAntwort(): Rohantwort {
  const text = readFileSync(new URL("./fixtures/openmeteo_joachimsthal.json", import.meta.url), "utf8");
  const inhalt: unknown = JSON.parse(text);
  if (typeof inhalt !== "object" || inhalt === null || !("hourly" in inhalt) || typeof inhalt.hourly !== "object" || inhalt.hourly === null) {
    throw new Error("Invariante verletzt: Testdatei ohne hourly");
  }
  const stundlich: Record<string, (number | null)[]> = {};
  for (const [name, werte] of Object.entries(inhalt.hourly)) {
    if (Array.isArray(werte)) {
      stundlich[name] = werte.map((wert): number | null => (typeof wert === "number" ? wert : null));
    }
  }
  return { ...inhalt, hourly: stundlich };
}

test("die echte Antwort ergibt 27 Tage mit Bodenwerten und heute an Position 20", () => {
  const reihe = wetterAusAntwort(echteAntwort);
  assert.equal(reihe.tage.length, 27); // letzter Tag ohne Bodenprognose
  assert.equal(reihe.heute, 20);
  assert.equal(reihe.tage[0]?.datum, "2026-09-14");
});

test("Bodentemperatur und Bodenfeuchte sind plausible Tagesmittel", () => {
  for (const tag of wetterAusAntwort(echteAntwort).tage) {
    assert.ok(tag.bodentempC > -10 && tag.bodentempC < 35, `Bodentemperatur ${String(tag.bodentempC)}`);
    assert.ok(tag.bodenfeuchte >= 0 && tag.bodenfeuchte <= 0.6, `Bodenfeuchte ${String(tag.bodenfeuchte)}`);
  }
});

test("aus der echten Antwort entsteht ein Verlauf von heute plus sechs Tagen mit Index 0 bis 100", () => {
  const reihe = wetterAusAntwort(echteAntwort);
  const verlauf = indexverlauf(reihe.tage, reihe.heute, "steinpilz");
  assert.equal(verlauf.length, 7);
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

test("fehlende Bodenwerte am Prognose-Ende (null) kürzen die Reihe statt Fehler zu werfen", () => {
  const antwort = frischeAntwort();
  for (const feldname of ["soil_temperature_6cm", "soil_moisture_3_to_9cm"]) {
    const werte = antwort.hourly[feldname];
    assert.ok(werte !== undefined);
    for (let stunde = werte.length - 21; stunde < werte.length; stunde += 1) {
      werte[stunde] = null;
    }
  }
  const reihe = wetterAusAntwort(antwort);
  assert.equal(reihe.tage.length, 27);
  assert.equal(reihe.heute, 20);
});

test("fehlende Bodenwerte für heute melden eine verletzte Invariante", () => {
  const antwort = frischeAntwort();
  const werte = antwort.hourly["soil_temperature_6cm"];
  assert.ok(werte !== undefined);
  werte[20 * 24 + 5] = null;
  assert.throws(() => wetterAusAntwort(antwort), /Invariante verletzt: Bodenwerte für .* fehlen/);
});
