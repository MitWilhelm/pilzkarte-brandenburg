// Tests für die Verlaufszeilen der Stellen-Vorschau (src/ansicht.ts), mit der echten Open-Meteo-Antwort aus den Fixtures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { trendZeilen } from "../src/ansicht.ts";
import { wetterAusAntwort } from "../src/clients/openmeteo.ts";
import { indexverlauf } from "../src/wachstum.ts";

const antwort: unknown = JSON.parse(
  readFileSync(new URL("./fixtures/openmeteo_joachimsthal.json", import.meta.url), "utf8"),
);

test("der Verlauf einer Stelle beginnt mit Heute, folgt der Vorhersage und hat Werte von 0 bis 100", () => {
  const reihe = wetterAusAntwort(antwort);
  const zeilen = trendZeilen(indexverlauf(reihe.tage, reihe.heute, "steinpilz"));
  assert.ok(zeilen.length >= 5 && zeilen.length <= 8, `${String(zeilen.length)} Tage`);
  assert.equal(zeilen[0]?.name, "Heute");
  assert.equal(zeilen.filter((zeile) => zeile.isHeute).length, 1, "nur der erste Tag ist Heute");
  assert.ok(zeilen.every((zeile) => zeile.index >= 0 && zeile.index <= 100));
});

test("die Tage nach Heute heißen Wochentage ohne Punkt, aufeinanderfolgend", () => {
  const reihe = wetterAusAntwort(antwort);
  const namen = trendZeilen(indexverlauf(reihe.tage, reihe.heute, "pfifferling")).slice(1).map((zeile) => zeile.name);
  const wochentage = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  assert.ok(namen.every((name) => wochentage.includes(name)), namen.join(","));
  const erster = wochentage.indexOf(namen[0] ?? "");
  namen.forEach((name, nummer) => {
    assert.equal(name, wochentage[(erster + nummer) % 7]);
  });
});

test("ein leerer Verlauf ergibt keine Zeilen", () => {
  assert.deepEqual(trendZeilen([]), []);
});
