// Tests für den Handy-Speicher der Meldungen (src/clients/meldespeicher.ts) mit einem einfachen Speicher im Arbeitsspeicher.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ladeMeldungen, loescheMeldung, markiereGeoeffnet, speichereMeldung, type Speicher } from "../src/clients/meldespeicher.ts";
import { pruefeMeldung } from "../src/meldung.ts";

class Arbeitsspeicher implements Speicher {
  private readonly eintraege = new Map<string, string>();
  get length(): number {
    return this.eintraege.size;
  }
  key(nummer: number): string | null {
    return [...this.eintraege.keys()][nummer] ?? null;
  }
  getItem(schluessel: string): string | null {
    return this.eintraege.get(schluessel) ?? null;
  }
  setItem(schluessel: string, wert: string): void {
    this.eintraege.set(schluessel, wert);
  }
  removeItem(schluessel: string): void {
    this.eintraege.delete(schluessel);
  }
}

test("gespeicherte Meldungen kommen unverändert zurück, die neueste zuerst", () => {
  const speicher = new Arbeitsspeicher();
  const alt = pruefeMeldung({
    id: "m1", zeitpunkt: "2026-10-04T08:00:00.000Z", breite: 52.9, laenge: 13.7, genauigkeitMeter: 6,
    ergebnis: "nichts", pilz: "steinpilz", groesse: null, kronendach: ["Kiefer"], unterstand: ["Kein Unterstand"],
    bestandsalter: "mittel", dichte: "licht", notiz: "", modell: { gebiet: null, stufe: null, brennpunkt: null, wachstumsindex: null },
  });
  const neu = pruefeMeldung({
    id: "m2", zeitpunkt: "2026-10-05T08:00:00.000Z", breite: 52.91, laenge: 13.71, genauigkeitMeter: 9,
    ergebnis: "fund", pilz: "pfifferling", groesse: "alt", kronendach: ["Buche"], unterstand: ["Sträucher"],
    bestandsalter: "alt", dichte: "mittel", notiz: "x", modell: { gebiet: "joachimsthal", stufe: 90, brennpunkt: "heute", wachstumsindex: 70 },
  });
  speichereMeldung(speicher, alt);
  speichereMeldung(speicher, neu);
  const geladen = ladeMeldungen(speicher);
  assert.deepEqual(geladen.meldungen.map((eintrag) => eintrag.meldung), [neu, alt]);
  assert.deepEqual(geladen.unlesbar, []);
});

test("Geöffnet-Vermerk und Löschen gelten nur für die gewählte Meldung", () => {
  const speicher = new Arbeitsspeicher();
  const meldung = pruefeMeldung({
    id: "m3", zeitpunkt: "2026-10-05T08:00:00.000Z", breite: 52.9, laenge: 13.7, genauigkeitMeter: 6,
    ergebnis: "nichts", pilz: "steinpilz", groesse: null, kronendach: ["Kiefer"], unterstand: ["Kein Unterstand"],
    bestandsalter: "mittel", dichte: "licht", notiz: "", modell: { gebiet: null, stufe: null, brennpunkt: null, wachstumsindex: null },
  });
  speichereMeldung(speicher, meldung);
  assert.equal(ladeMeldungen(speicher).meldungen[0]?.geoeffnetAm, null);
  markiereGeoeffnet(speicher, "m3", new Date("2026-10-05T09:00:00.000Z"));
  assert.equal(ladeMeldungen(speicher).meldungen[0]?.geoeffnetAm, "2026-10-05T09:00:00.000Z");
  loescheMeldung(speicher, "m3");
  assert.deepEqual(ladeMeldungen(speicher), { meldungen: [], unlesbar: [] });
  assert.equal(speicher.length, 0);
});

test("ein beschädigter Eintrag wird mit Ursache gemeldet und bleibt erhalten, die übrigen bleiben lesbar", () => {
  const speicher = new Arbeitsspeicher();
  const meldung = pruefeMeldung({
    id: "m4", zeitpunkt: "2026-10-05T08:00:00.000Z", breite: 52.9, laenge: 13.7, genauigkeitMeter: 6,
    ergebnis: "nichts", pilz: "steinpilz", groesse: null, kronendach: ["Kiefer"], unterstand: ["Kein Unterstand"],
    bestandsalter: "mittel", dichte: "licht", notiz: "", modell: { gebiet: null, stufe: null, brennpunkt: null, wachstumsindex: null },
  });
  speichereMeldung(speicher, meldung);
  speicher.setItem("pilzkarte-meldung:kaputt", "{nicht json");
  speicher.setItem("anderes:ding", "bleibt unberührt");
  const geladen = ladeMeldungen(speicher);
  assert.equal(geladen.meldungen.length, 1);
  assert.equal(geladen.unlesbar.length, 1);
  const defekt = geladen.unlesbar[0];
  assert.ok(defekt !== undefined);
  assert.equal(defekt.schluessel, "pilzkarte-meldung:kaputt");
  assert.match(defekt.grund, /JSON/);
  assert.equal(speicher.getItem("pilzkarte-meldung:kaputt"), "{nicht json");
});

test("ein Speicher, der das Schreiben verweigert, meldet das mit Ursache", () => {
  const voll: Speicher = {
    length: 0,
    key: () => null,
    getItem: () => null,
    removeItem: () => undefined,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  const meldung = pruefeMeldung({
    id: "m5", zeitpunkt: "2026-10-05T08:00:00.000Z", breite: 52.9, laenge: 13.7, genauigkeitMeter: 6,
    ergebnis: "nichts", pilz: "steinpilz", groesse: null, kronendach: ["Kiefer"], unterstand: ["Kein Unterstand"],
    bestandsalter: "mittel", dichte: "licht", notiz: "", modell: { gebiet: null, stufe: null, brennpunkt: null, wachstumsindex: null },
  });
  assert.throws(
    () => {
      speichereMeldung(voll, meldung);
    },
    (fehler: unknown) => fehler instanceof Error && /nicht möglich/.test(fehler.message) && fehler.cause instanceof Error,
  );
});
