// Tests für den Ladefortschritt (src/laden.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { ANTEIL_VORSCHAU, ladeanteil, ladetext } from "../src/laden.ts";

test("ohne Vorschau und ohne Kacheln ist der Anteil 0, mit Vorschau der Vorschau-Anteil", () => {
  assert.equal(ladeanteil(false, 0, 26), 0);
  assert.equal(ladeanteil(true, 0, 26), ANTEIL_VORSCHAU);
});

test("nach allen Kacheln ist der Anteil genau 1, in der Mitte dazwischen", () => {
  assert.equal(ladeanteil(true, 26, 26), 1);
  assert.ok(Math.abs(ladeanteil(true, 13, 26) - (ANTEIL_VORSCHAU + (1 - ANTEIL_VORSCHAU) / 2)) < 1e-12);
});

test("mehr fertige als insgesamt vorhandene Kacheln sind eine verletzte Invariante", () => {
  assert.throws(() => ladeanteil(true, 27, 26), /Invariante verletzt: 27 von 26 Kacheln fertig/);
  assert.throws(() => ladeanteil(true, 0, 0), /Invariante verletzt: 0 Kacheln insgesamt/);
});

test("der Text wechselt mit dem Fortschritt", () => {
  assert.equal(ladetext(0), "Barnim wird geöffnet …");
  assert.equal(ladetext(0.35), "Waldstücke werden bewertet …");
  assert.equal(ladetext(1), "Fertig");
  assert.throws(() => ladetext(-0.1), /Invariante verletzt/);
});
