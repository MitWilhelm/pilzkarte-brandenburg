// Tests für Meldungen (src/meldung.ts): Prüfung der Werte, Issue-Text und Adresse (rein, ohne Netzwerk).
import { test } from "node:test";
import assert from "node:assert/strict";
import { issueUrl, koordinatentext, kurztext, meldungAlsIssue, pruefeMeldung } from "../src/meldung.ts";

test("eine vollständige Fundmeldung wird geprüft und unverändert zurückgegeben", () => {
  const roh = {
    id: "m1759650000000",
    zeitpunkt: "2026-10-05T07:00:00.000Z",
    breite: 52.99622,
    laenge: 13.71053,
    genauigkeitMeter: 8,
    ergebnis: "fund",
    pilz: "steinpilz",
    groesse: "mittel",
    kronendach: ["Kiefer", "Buche"],
    unterstand: ["Eiche"],
    bestandsalter: "alt",
    dichte: "licht",
    notiz: "am Wegrand",
    modell: { gebiet: "joachimsthal", stufe: 85, brennpunkt: "heute", wachstumsindex: 71 },
  };
  assert.deepEqual(pruefeMeldung(roh), roh);
});

test("ungültige Meldungen werden mit der Ursache abgelehnt", () => {
  const gueltig = {
    id: "m1",
    zeitpunkt: "2026-10-05T07:00:00.000Z",
    breite: 52.9,
    laenge: 13.7,
    genauigkeitMeter: 8,
    ergebnis: "fund",
    pilz: "steinpilz",
    groesse: "jung",
    kronendach: ["Kiefer"],
    unterstand: ["Kein Unterstand"],
    bestandsalter: "mittel",
    dichte: "mittel",
    notiz: "",
    modell: { gebiet: null, stufe: null, brennpunkt: null, wachstumsindex: null },
  };
  assert.doesNotThrow(() => pruefeMeldung(gueltig));
  const faelle: readonly { readonly name: string; readonly roh: unknown; readonly muster: RegExp }[] = [
    { name: "unbekannte Pilzart", roh: { ...gueltig, pilz: "fliegenpilz" }, muster: /pilz/ },
    { name: "Fund ohne Größe", roh: { ...gueltig, groesse: null }, muster: /Ergebnis fund passt nicht/ },
    { name: "nichts gefunden mit Größe", roh: { ...gueltig, ergebnis: "nichts" }, muster: /Ergebnis nichts passt nicht/ },
    { name: "Koordinate außerhalb Deutschlands", roh: { ...gueltig, breite: 10 }, muster: /breite/ },
    { name: "Koordinate nicht als Zahl", roh: { ...gueltig, laenge: "13.7" }, muster: /laenge/ },
    { name: "leeres Kronendach", roh: { ...gueltig, kronendach: [] }, muster: /kronendach/ },
    { name: "unbekannte Baumart", roh: { ...gueltig, kronendach: ["Palme"] }, muster: /kronendach/ },
    { name: "Kein Unterstand mit Baumart", roh: { ...gueltig, unterstand: ["Kein Unterstand", "Buche"] }, muster: /Kein Unterstand/ },
    { name: "Notiz zu lang", roh: { ...gueltig, notiz: "x".repeat(501) }, muster: /notiz/ },
    { name: "kein Zeitpunkt", roh: { ...gueltig, zeitpunkt: "gestern" }, muster: /zeitpunkt/ },
    { name: "Stufe über 100", roh: { ...gueltig, modell: { ...gueltig.modell, stufe: 101 } }, muster: /modell.stufe/ },
    { name: "kein Objekt", roh: "Text", muster: /Objekt erwartet/ },
  ];
  for (const fall of faelle) {
    assert.throws(() => pruefeMeldung(fall.roh), (fehler: unknown) => fehler instanceof Error && fehler.message.startsWith("Invariante verletzt:") && fall.muster.test(fehler.message), fall.name);
  }
});

test("der Issue-Text enthält die Rohdaten als JSON, die sich wieder zur gleichen Meldung prüfen lassen", () => {
  const meldung = pruefeMeldung({
    id: "m2",
    zeitpunkt: "2026-10-05T07:00:00.000Z",
    breite: 52.99554,
    laenge: 13.70809,
    genauigkeitMeter: 12,
    ergebnis: "nichts",
    pilz: "pfifferling",
    groesse: null,
    kronendach: ["Kiefer", "Eiche"],
    unterstand: ["Sträucher"],
    bestandsalter: "unbekannt",
    dichte: "dicht",
    notiz: "Zeile 1\nZeile 2 mit \"Anführungszeichen\"",
    modell: { gebiet: "joachimsthal", stufe: 0, brennpunkt: "keiner", wachstumsindex: 64 },
  });
  const { titel, text } = meldungAlsIssue(meldung);
  assert.equal(titel, "Meldung: Nichts gefunden (Pfifferling), 2026-10-05 52.99554, 13.70809");
  assert.match(text, /kein Habitat, Wachstumsindex 64, nicht in einer Top-Fläche/);
  const json = /```json\n([\s\S]*)\n```/.exec(text)?.[1];
  assert.ok(json !== undefined);
  assert.deepEqual(pruefeMeldung(JSON.parse(json)), meldung);
});

test("die Issue-Adresse zeigt auf das Repository und kodiert Titel, Text und Label", () => {
  const meldung = pruefeMeldung({
    id: "m3",
    zeitpunkt: "2026-10-05T07:00:00.000Z",
    breite: 52.9,
    laenge: 13.7,
    genauigkeitMeter: 5,
    ergebnis: "fund",
    pilz: "steinpilz",
    groesse: "alt",
    kronendach: ["Kiefer"],
    unterstand: ["Buche"],
    bestandsalter: "alt",
    dichte: "licht",
    notiz: "ä & ? #",
    modell: { gebiet: null, stufe: null, brennpunkt: null, wachstumsindex: null },
  });
  const url = new URL(issueUrl(meldung));
  assert.equal(url.origin + url.pathname, "https://github.com/MitWilhelm/pilzkarte-brandenburg/issues/new");
  assert.equal(url.searchParams.get("labels"), "meldung");
  assert.equal(url.searchParams.get("title"), meldungAlsIssue(meldung).titel);
  assert.equal(url.searchParams.get("body"), meldungAlsIssue(meldung).text);
});

test("Kurztext und Koordinatentext nennen Pilzart, Datum und fünf Nachkommastellen", () => {
  const meldung = pruefeMeldung({
    id: "m4",
    zeitpunkt: "2026-10-05T07:00:00.000Z",
    breite: 52.9,
    laenge: 13.7,
    genauigkeitMeter: 5,
    ergebnis: "fund",
    pilz: "steinpilz",
    groesse: "jung",
    kronendach: ["Kiefer"],
    unterstand: ["Kein Unterstand"],
    bestandsalter: "mittel",
    dichte: "mittel",
    notiz: "",
    modell: { gebiet: null, stufe: null, brennpunkt: null, wachstumsindex: null },
  });
  assert.equal(kurztext(meldung), "Fund Steinpilz, 2026-10-05");
  assert.equal(koordinatentext(52.9, 13.7), "52.90000, 13.70000");
});
