// Tests für das Senden an den Meldeserver (src/clients/meldeserver.ts) mit einem nachgebildeten Abruf, ohne Netzwerk.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MELDE_WORKER_URL, sendeAnWorker, type Abruf } from "../src/clients/meldeserver.ts";
import { pruefeMeldung } from "../src/meldung.ts";

function beispiel(): ReturnType<typeof pruefeMeldung> {
  return pruefeMeldung({
    id: "m1", zeitpunkt: "2026-10-17T08:00:00.000Z", breite: 52.81, laenge: 13.82, genauigkeitMeter: 5,
    ergebnis: "nichts", pilz: "edelreizker", groesse: null, kronendach: ["Kiefer"], unterstand: ["Kein Unterstand"],
    bestandsalter: "alt", dichte: "mittel", notiz: "", modell: { gebiet: null, stufe: null, brennpunkt: null, wachstumsindex: null },
  });
}

test("eine angenommene Meldung liefert die Issue-Nummer und wird als JSON an den Worker gesendet", async () => {
  const aufrufe: { url: string; optionen: RequestInit }[] = [];
  const abruf: Abruf = (url, optionen) => {
    aufrufe.push({ url, optionen });
    return Promise.resolve(new Response(JSON.stringify({ ok: true, nummer: 11 }), { status: 201 }));
  };
  const meldung = beispiel();
  assert.equal(await sendeAnWorker(meldung, abruf), 11);
  const [aufruf] = aufrufe;
  assert.equal(aufrufe.length, 1);
  if (aufruf === undefined) {
    throw new Error("Der Abruf wurde nicht aufgerufen");
  }
  assert.equal(aufruf.url, MELDE_WORKER_URL);
  assert.equal(aufruf.optionen.method, "POST");
  const rohtext = aufruf.optionen.body;
  assert.equal(typeof rohtext, "string");
  const inhalt: unknown = JSON.parse(typeof rohtext === "string" ? rohtext : "");
  assert.deepEqual(inhalt, meldung);
});

test("lehnt der Worker ab, steht Status und Grund im Fehler", async () => {
  const abruf: Abruf = () => Promise.resolve(new Response(JSON.stringify({ fehler: "Wert x nicht erlaubt" }), { status: 400 }));
  await assert.rejects(sendeAnWorker(beispiel(), abruf), /Status 400\): Wert x nicht erlaubt/);
});

test("ohne Netz meldet der Fehler den fehlenden Meldeserver und trägt die Ursache", async () => {
  const abruf: Abruf = () => Promise.reject(new TypeError("Failed to fetch"));
  await assert.rejects(sendeAnWorker(beispiel(), abruf), (fehler: Error) => /nicht erreichbar/.test(fehler.message) && fehler.cause instanceof TypeError);
});

test("eine Antwort ohne Issue-Nummer ist eine verletzte Invariante", async () => {
  const abruf: Abruf = () => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 201 }));
  await assert.rejects(sendeAnWorker(beispiel(), abruf), /Invariante verletzt: Worker-Antwort/);
});

test("eine Antwort, die kein JSON ist (z. B. Cloudflare-Fehlerseite), nennt den Status", async () => {
  const abruf: Abruf = () => Promise.resolve(new Response("error code: 1101", { status: 500 }));
  await assert.rejects(sendeAnWorker(beispiel(), abruf), /Status 500 ohne lesbaren Inhalt/);
});
