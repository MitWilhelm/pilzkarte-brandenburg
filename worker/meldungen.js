// Cloudflare Worker: nimmt Meldungen von der Pilzkarte entgegen und legt daraus ein GitHub-Issue an.
// Der GitHub-Schlüssel (GITHUB_TOKEN) liegt nur bei Cloudflare als Secret, nie auf der Webseite oder im Repository.
// Schutz: Herkunft, Größe, strenge Werte, Zeitfenster, Obergrenze je IP (Cache API) und je Stunde insgesamt (über die
// Issues bei GitHub), keine doppelten Meldungs-IDs. Anleitung: docs/anleitung-cloudflare-worker.md, Risiken: docs/sicherheit.md.

const ERLAUBTER_URSPRUNG = "https://mitwilhelm.github.io";
const ERGEBNISSE = ["fund", "nichts"];
const PILZE = ["steinpilz", "pfifferling", "edelreizker"];
const GROESSEN = ["jung", "mittel", "alt", "gemischt"];
const BESTANDSALTER = ["jung", "mittel", "alt", "unbekannt"];
const DICHTEN = ["licht", "mittel", "dicht"];
const BAUMARTEN = ["Kiefer", "Fichte", "Douglasie", "Lärche", "Buche", "Eiche", "Birke", "Erle", "Sonstige"];
const UNTERSTAND = [...BAUMARTEN, "Sträucher", "Kein Unterstand"];
const GEBIET = { sued: 52.5, nord: 53.2, west: 13.2, ost: 14.3 }; // grob um den Landkreis Barnim
const MAX_BYTES = 6000;
const MAX_GENAUIGKEIT_METER = 30;
const MAX_NOTIZ_ZEICHEN = 500;
const ID_MUSTER = /^m\d{13}$/; // die Seite vergibt "m" plus Millisekunden-Zeitstempel
const ZEIT_MUSTER = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const MAX_ALTER_MS = 24 * 3600 * 1000; // eine Meldung wird sofort gesendet; Älteres ist verdächtig
const MAX_ZUKUNFT_MS = 5 * 60 * 1000;
const MAX_JE_STUNDE = 30; // alle Absender zusammen
const MAX_JE_IP = 5; // je Zeitfenster
const IP_FENSTER_SEKUNDEN = 600;
const STUNDE_MS = 3600 * 1000;

class Abweisung extends Error {
  constructor(status, text) {
    super(text);
    this.status = status;
  }
}

function antwort(status, daten) {
  const kopf = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ERLAUBTER_URSPRUNG,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  };
  // Status 204 (Vorabfrage des Browsers) darf keinen Inhalt haben, sonst wirft Cloudflare einen Fehler 500.
  const inhalt = status === 204 ? null : JSON.stringify(daten);
  return new Response(inhalt, { status, headers: kopf });
}

function text(wert, feld, maximum) {
  if (typeof wert !== "string" || wert.length > maximum) throw new Abweisung(400, `${feld}: Text fehlt oder ist zu lang`);
  return wert.replaceAll("`", "'");
}

function auswahl(wert, feld, erlaubt) {
  if (!erlaubt.includes(wert)) throw new Abweisung(400, `${feld}: Wert nicht erlaubt`);
  return wert;
}

function liste(wert, feld, erlaubt) {
  if (!Array.isArray(wert) || wert.length === 0 || wert.length > erlaubt.length) throw new Abweisung(400, `${feld}: Liste fehlt oder ist zu lang`);
  return [...new Set(wert.map((eintrag) => auswahl(eintrag, feld, erlaubt)))];
}

function zahl(wert, feld, minimum, maximum) {
  if (typeof wert !== "number" || !Number.isFinite(wert) || wert < minimum || wert > maximum) {
    throw new Abweisung(400, `${feld}: Zahl fehlt oder liegt außerhalb`);
  }
  return wert;
}

export function pruefe(roh, jetztMs = Date.now()) {
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) throw new Abweisung(400, "Meldung fehlt");
  const ergebnis = auswahl(roh.ergebnis, "ergebnis", ERGEBNISSE);
  const zeitpunkt = text(roh.zeitpunkt, "zeitpunkt", 30);
  const zeit = Date.parse(zeitpunkt);
  if (!ZEIT_MUSTER.test(zeitpunkt) || Number.isNaN(zeit)) throw new Abweisung(400, "zeitpunkt: kein ISO-Datum");
  if (jetztMs - zeit > MAX_ALTER_MS || zeit - jetztMs > MAX_ZUKUNFT_MS) throw new Abweisung(400, "zeitpunkt: nicht aktuell");
  const id = text(roh.id, "id", 20);
  if (!ID_MUSTER.test(id)) throw new Abweisung(400, "id: falsches Format");
  return {
    id,
    zeitpunkt,
    breite: zahl(roh.breite, "breite", GEBIET.sued, GEBIET.nord),
    laenge: zahl(roh.laenge, "laenge", GEBIET.west, GEBIET.ost),
    genauigkeitMeter: zahl(roh.genauigkeitMeter, "genauigkeitMeter", 0, MAX_GENAUIGKEIT_METER),
    ergebnis,
    pilz: auswahl(roh.pilz, "pilz", PILZE),
    groesse: ergebnis === "fund" ? auswahl(roh.groesse, "groesse", GROESSEN) : null,
    kronendach: liste(roh.kronendach, "kronendach", BAUMARTEN),
    unterstand: liste(roh.unterstand, "unterstand", UNTERSTAND),
    bestandsalter: auswahl(roh.bestandsalter, "bestandsalter", BESTANDSALTER),
    dichte: auswahl(roh.dichte, "dichte", DICHTEN),
    notiz: text(roh.notiz ?? "", "notiz", MAX_NOTIZ_ZEICHEN),
  };
}

function alsIssue(meldung) {
  const art = meldung.ergebnis === "fund" ? "Fund" : "Nichts gefunden";
  const datum = meldung.zeitpunkt.slice(0, 10);
  return {
    title: `Meldung (Web): ${art} ${meldung.pilz}, ${datum} ${meldung.breite.toFixed(5)}, ${meldung.laenge.toFixed(5)}`,
    body: "Eingang über die Webseite ohne GitHub-Konto, ungeprüft.\n\n```json\n" + JSON.stringify(meldung, null, 2) + "\n```",
    labels: ["meldung", "ungeprüft"],
  };
}

function githubKopf(umgebung) {
  return {
    Authorization: `Bearer ${umgebung.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "pilzkarte-meldungen",
    "Content-Type": "application/json",
  };
}

// Obergrenze je IP: Zähler im Cache des Rechenzentrums (kein Speicher nötig). Ein Zähler je Rechenzentrum und Fenster ist
// nicht streng genau, bremst aber Massenmeldungen von einer Adresse.
async function pruefeIp(anfrage, cache) {
  const ip = anfrage.headers.get("CF-Connecting-Ip") ?? "unbekannt";
  const fenster = Math.floor(Date.now() / (IP_FENSTER_SEKUNDEN * 1000));
  const schluessel = new Request(`https://drossel.invalid/${encodeURIComponent(ip)}/${String(fenster)}`);
  const treffer = await cache.match(schluessel);
  const bisher = treffer === undefined ? 0 : Number(await treffer.text());
  if (!Number.isInteger(bisher) || bisher < 0) throw new Abweisung(500, "Zähler beschädigt");
  if (bisher >= MAX_JE_IP) throw new Abweisung(429, "Zu viele Meldungen von dieser Adresse. Bitte später erneut versuchen.");
  await cache.put(schluessel, new Response(String(bisher + 1), { headers: { "Cache-Control": `max-age=${String(IP_FENSTER_SEKUNDEN)}` } }));
}

// Obergrenze insgesamt und Doppelschutz: Die Issues der letzten Stunde bei GitHub sind der gemeinsame Speicher.
// Gleiche Meldungs-ID: kein zweites Issue, sondern die Nummer des ersten (so zählt ein erneutes Senden nicht doppelt).
async function pruefeGitHub(meldung, umgebung) {
  const seitMs = Date.now() - STUNDE_MS;
  const adresse = `https://api.github.com/repos/${umgebung.REPO}/issues?state=all&labels=meldung&per_page=100&since=${encodeURIComponent(new Date(seitMs).toISOString())}`;
  const antwortListe = await fetch(adresse, { headers: githubKopf(umgebung) });
  if (!antwortListe.ok) throw new Abweisung(502, `GitHub-Liste antwortete ${String(antwortListe.status)}`);
  const liste = await antwortListe.json();
  if (!Array.isArray(liste)) throw new Abweisung(502, "GitHub-Liste ohne Liste");
  const neu = liste.filter((eintrag) => Date.parse(eintrag.created_at) >= seitMs);
  const doppelt = neu.find((eintrag) => typeof eintrag.body === "string" && eintrag.body.includes(`"id": "${meldung.id}"`));
  if (doppelt !== undefined) return doppelt.number;
  if (neu.length >= MAX_JE_STUNDE) throw new Abweisung(429, "Im Moment gehen sehr viele Meldungen ein. Bitte später erneut versuchen.");
  return null;
}

export default {
  async fetch(anfrage, umgebung, kontext = {}) {
    const cache = kontext.cache ?? caches.default;
    try {
      if (anfrage.method === "OPTIONS") return antwort(204, {});
      if (anfrage.method !== "POST") return antwort(405, { fehler: "Nur POST" });
      if (anfrage.headers.get("Origin") !== ERLAUBTER_URSPRUNG) return antwort(403, { fehler: "Ursprung nicht erlaubt" });
      const rohtext = await anfrage.text();
      if (rohtext.length > MAX_BYTES) return antwort(413, { fehler: "Meldung zu groß" });
      let roh;
      try {
        roh = JSON.parse(rohtext);
      } catch {
        return antwort(400, { fehler: "Kein gültiges JSON" });
      }
      const meldung = pruefe(roh);
      await pruefeIp(anfrage, cache);
      const vorhandenes = await pruefeGitHub(meldung, umgebung);
      if (vorhandenes !== null) return antwort(200, { ok: true, nummer: vorhandenes, doppelt: true });
      const github = await fetch(`https://api.github.com/repos/${umgebung.REPO}/issues`, {
        method: "POST",
        headers: githubKopf(umgebung),
        body: JSON.stringify(alsIssue(meldung)),
      });
      if (!github.ok) throw new Abweisung(502, `GitHub antwortete ${String(github.status)}`);
      const issue = await github.json();
      return antwort(201, { ok: true, nummer: issue.number });
    } catch (fehler) {
      if (fehler instanceof Abweisung) return antwort(fehler.status, { fehler: fehler.message });
      return antwort(500, { fehler: "Interner Fehler" });
    }
  },
};
