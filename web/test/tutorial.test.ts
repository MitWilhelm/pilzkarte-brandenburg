// Tests für die Tutorial-Schrittlogik (src/tutorial.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fortschrittText, istLetzterSchritt, naechsterSchritt } from "../src/tutorial.ts";


test("vor und zurück wechseln die Schritte und bleiben am Anfang und Ende stehen", () => {
  assert.equal(naechsterSchritt(0, 6, "vor"), 1);
  assert.equal(naechsterSchritt(3, 6, "zurueck"), 2);
  assert.equal(naechsterSchritt(5, 6, "vor"), 5);
  assert.equal(naechsterSchritt(0, 6, "zurueck"), 0);
});

test("nur der letzte Schritt gilt als letzter", () => {
  assert.equal(istLetzterSchritt(5, 6), true);
  assert.equal(istLetzterSchritt(4, 6), false);
});

test("der Fortschritt wird ab eins gezählt", () => {
  assert.equal(fortschrittText(0, 6), "Schritt 1 von 6");
  assert.equal(fortschrittText(5, 6), "Schritt 6 von 6");
});

test("ein Schritt außerhalb der Liste ist eine verletzte Invariante", () => {
  assert.throws(() => naechsterSchritt(6, 6, "vor"), /Invariante verletzt: Tutorial-Schritt 6 von 6/);
  assert.throws(() => fortschrittText(0, 0), /Invariante verletzt: Tutorial mit 0 Schritten/);
});
