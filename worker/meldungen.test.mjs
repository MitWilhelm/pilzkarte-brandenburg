// Tests für den Meldeserver (worker/meldungen.js) mit nachgebildetem GitHub und Cache, ohne Netzwerk.
// Aufruf: node --test worker/
import { test } from "node:test";
import assert from "node:assert/strict";
import worker, { pruefe } from "./meldungen.js";

const URSPRUNG = "https://mitwilhelm.github.io";
const UMGEBUNG = { REPO: "a/b", GITHUB_TOKEN: "geheim-nur-im-test" };

function meldung(ueberschreibe = {}) {
  const jetzt = Date.now();
  return {
    id: `m${String(jetzt)}`,
    zeitpunkt: new Date(jetzt).toISOString(),
    breite: 52.81, laenge: 13.82, genauigkeitMeter: 5,
    ergebnis: "nichts", pilz: "edelreizker", groesse: null,
    kronendach: ["Kiefer"], unterstand: ["Kein Unterstand"],
    bestandsalter: "alt", dichte: "mittel", notiz: "",
    ...ueberschreibe,
  };
}

function einfacherCache() {
  const speicher = new Map();
  return {
    match: (anfrage) => Promise.resolve(speicher.has(anfrage.url) ? new Response(speicher.get(anfrage.url)) : undefined),
    put: async (anfrage, antwort) => { speicher.set(anfrage.url, await antwort.text()); },
  };
}

// Nachgebildetes GitHub: Liste der letzten Issues und Anlegen; zählt die Aufrufe.
function githubAttrappe(vorhandene = [], listeStatus = 200) {
  const aufrufe = { liste: 0, angelegt: [] };
  globalThis.fetch = (url, optionen = {}) => {
    if (optionen.method === "POST") {
      aufrufe.angelegt.push(JSON.parse(optionen.body));
      return Promise.resolve(new Response(JSON.stringify({ number: 100 + aufrufe.angelegt.length }), { status: 201 }));
    }
    aufrufe.liste += 1;
    return Promise.resolve(new Response(JSON.stringify(vorhandene), { status: listeStatus }));
  };
  return aufrufe;
}

async function sende(inhalt, kopf = {}, cache = einfacherCache()) {
  const anfrage = new Request("https://worker.example/", {
    method: "POST",
    headers: { Origin: URSPRUNG, "CF-Connecting-Ip": "203.0.113.7", ...kopf },
    body: typeof inhalt === "string" ? inhalt : JSON.stringify(inhalt),
  });
  const antwort = await worker.fetch(anfrage, UMGEBUNG, { cache });
  return { status: antwort.status, daten: antwort.status === 204 ? null : await antwort.json() };
}

test("eine gültige Meldung legt ein Issue mit den Labels meldung und ungeprüft an", async () => {
  const gh = githubAttrappe();
  const { status, daten } = await sende(meldung());
  assert.equal(status, 201);
  assert.equal(daten.nummer, 101);
  assert.deepEqual(gh.angelegt[0].labels, ["meldung", "ungeprüft"]);
  assert.match(gh.angelegt[0].title, /^Meldung \(Web\): Nichts gefunden edelreizker, \d{4}-\d{2}-\d{2} 52\.81000, 13\.82000$/);
});

test("die Vorabfrage des Browsers (OPTIONS) liefert 204 ohne Inhalt und die erlaubte Herkunft", async () => {
  const antwort = await worker.fetch(new Request("https://worker.example/", { method: "OPTIONS", headers: { Origin: URSPRUNG } }), UMGEBUNG, { cache: einfacherCache() });
  assert.equal(antwort.status, 204);
  assert.equal(antwort.headers.get("Access-Control-Allow-Origin"), URSPRUNG);
  assert.equal(antwort.headers.get("X-Content-Type-Options"), "nosniff");
});

test("fremde Herkunft und falsche Methode werden abgewiesen, ohne GitHub zu fragen", async () => {
  const gh = githubAttrappe();
  assert.equal((await sende(meldung(), { Origin: "https://boese.example" })).status, 403);
  const get = await worker.fetch(new Request("https://worker.example/", { method: "GET" }), UMGEBUNG, { cache: einfacherCache() });
  assert.equal(get.status, 405);
  assert.equal(gh.liste, 0);
});

test("ein Zeitstempel mit eingeschmuggeltem Text wie @jemand wird abgewiesen (Titel-Einschleusung)", async () => {
  githubAttrappe();
  for (const zeitpunkt of ["@evil 2026-10-17", "(@evil) 2026-10-17T10:00:00Z", "2026-10-17", "Oct 17 2026 [x](http://e.vil)"]) {
    const { status, daten } = await sende(meldung({ zeitpunkt }));
    assert.equal(status, 400, zeitpunkt);
    assert.doesNotMatch(JSON.stringify(daten), /evil/);
  }
});

test("zu alte und zu weit in der Zukunft liegende Zeitpunkte sind nicht aktuell", () => {
  const jetzt = Date.parse("2026-10-17T12:00:00Z");
  assert.throws(() => pruefe(meldung({ id: "m1792224000000", zeitpunkt: "2026-10-15T12:00:00.000Z" }), jetzt), /nicht aktuell/);
  assert.throws(() => pruefe(meldung({ id: "m1792224000000", zeitpunkt: "2026-10-17T12:10:00.000Z" }), jetzt), /nicht aktuell/);
  assert.doesNotThrow(() => pruefe(meldung({ id: "m1792224000000", zeitpunkt: "2026-10-17T11:59:00.000Z" }), jetzt));
});

test("Baumarten und Unterstand müssen aus den erlaubten Listen kommen, die Meldungs-ID das Format der Seite haben", async () => {
  githubAttrappe();
  for (const abweichung of [
    { kronendach: ["<script>alert(1)</script>"] },
    { kronendach: [] },
    { unterstand: ["Ananas"] },
    { id: "test1" },
    { id: "m1; DROP TABLE" },
    { pilz: "knollenblaetter" },
    { notiz: "x".repeat(501) },
    { genauigkeitMeter: 31 },
    { breite: 10 },
  ]) {
    assert.equal((await sende(meldung(abweichung))).status, 400, JSON.stringify(abweichung).slice(0, 40));
  }
});

test("Fehlermeldungen spiegeln keine Eingaben zurück und verraten keine Interna", async () => {
  githubAttrappe();
  const kaputt = await sende('{"a":');
  assert.deepEqual(kaputt, { status: 400, daten: { fehler: "Kein gültiges JSON" } });
  const falsch = await sende(meldung({ pilz: "SECRET-ECHO-12345" }));
  assert.doesNotMatch(JSON.stringify(falsch.daten), /SECRET-ECHO/);
  const gross = await sende({ notiz: "a".repeat(7000) });
  assert.equal(gross.status, 413);
});

test("von einer IP sind höchstens fünf Meldungen je Zeitfenster möglich, die sechste bekommt 429", async () => {
  const gh = githubAttrappe();
  const cache = einfacherCache();
  const stati = [];
  for (let nummer = 0; nummer < 6; nummer += 1) {
    stati.push((await sende(meldung({ id: `m${String(Date.now() + nummer)}` }), {}, cache)).status);
  }
  assert.deepEqual(stati, [201, 201, 201, 201, 201, 429]);
  assert.equal(gh.angelegt.length, 5);
  assert.equal((await sende(meldung(), { "CF-Connecting-Ip": "198.51.100.9" }, cache)).status, 201, "andere IP ist nicht betroffen");
});

test("sind in der letzten Stunde schon 30 Meldungen eingegangen, wird keine weitere angelegt (alle Absender zusammen)", async () => {
  const jetzt = Date.now();
  const vorhandene = Array.from({ length: 30 }, (_, nummer) => ({ number: nummer + 1, created_at: new Date(jetzt - 1000).toISOString(), body: `"id": "m${String(jetzt - 5000 - nummer)}"` }));
  const gh = githubAttrappe(vorhandene);
  const { status } = await sende(meldung());
  assert.equal(status, 429);
  assert.equal(gh.angelegt.length, 0);
});

test("eine schon vorhandene Meldungs-ID legt kein zweites Issue an, sondern nennt das erste", async () => {
  const eintrag = meldung();
  const gh = githubAttrappe([{ number: 42, created_at: new Date().toISOString(), body: `"id": "${eintrag.id}"` }]);
  const { status, daten } = await sende(eintrag);
  assert.equal(status, 200);
  assert.deepEqual(daten, { ok: true, nummer: 42, doppelt: true });
  assert.equal(gh.angelegt.length, 0);
});

test("antwortet GitHub nicht, wird nichts angelegt und die Meldung scheitert mit 502 (sicher statt offen)", async () => {
  const gh = githubAttrappe([], 500);
  const { status } = await sende(meldung());
  assert.equal(status, 502);
  assert.equal(gh.angelegt.length, 0);
});

test("der Schlüssel taucht in keiner Antwort auf", async () => {
  githubAttrappe();
  const { daten } = await sende(meldung());
  assert.doesNotMatch(JSON.stringify(daten), /geheim-nur-im-test/);
});
