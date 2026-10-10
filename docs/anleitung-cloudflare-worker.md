# Anleitung: Meldungen ohne GitHub-Konto (Cloudflare Worker)

**Ziel:** Jeder kann auf der Pilzkarte eine Meldung abschicken, auch ohne GitHub-Konto. Ein kleiner Dienst bei
Cloudflare (ein „Worker“) prüft die Meldung und legt daraus selbst ein GitHub-Issue an. Es bleibt ein Issue mit den
Labels `meldung` und `ungeprüft`; ins Modell fließt es erst nach deiner Prüfung.

**Kosten:** keine. Der kostenlose Tarif erlaubt 100.000 Aufrufe pro Tag, ohne Kreditkarte.
**Dauer:** etwa 20 Minuten. Menünamen bei Cloudflare und GitHub können von dieser Beschreibung abweichen; die Namen
sind der Stand beim Schreiben und wurden nicht live gegengeprüft.

**Sicherheitsregel:** Den GitHub-Schlüssel (Token) schickst du niemandem, auch nicht Claude. Du trägst ihn nur selbst in
Schritt 4 bei Cloudflare ein. Er gehört nie in eine Datei oder ins Repository.

## Schritt 1: Cloudflare-Konto anlegen

1. Öffne <https://dash.cloudflare.com/sign-up>.
2. E-Mail-Adresse und ein neues Passwort eingeben (Passwort-Manager empfohlen), „Sign up“.
3. Bestätigungs-Mail öffnen und den Link anklicken.
4. Falls nach einer Domain gefragt wird: überspringen (Skip / „Add a site later“). Du brauchst keine eigene Domain.
5. Optional, aber sinnvoll: Zwei-Faktor-Anmeldung unter „My Profile“ → „Authentication“ einschalten.

## Schritt 2: Worker anlegen

1. Im Menü links **„Workers & Pages“** (je nach Ansicht unter „Compute“) öffnen.
2. **„Create“** → **„Create Worker“** (oder „Start with Hello World!“).
3. Name: `pilzkarte-meldungen`. Daraus wird die Adresse `https://pilzkarte-meldungen.<dein-name>.workers.dev`.
   Beim ersten Mal fragt Cloudflare nach einem Namen für deinen `workers.dev`-Bereich; wähle etwas Neutrales.
4. **„Deploy“** drücken (der Beispielcode ist egal), danach **„Edit code“**.

## Schritt 3: Code einfügen

Im Editor alles löschen und den folgenden Code einfügen, dann **„Deploy“**. Er prüft jede Meldung streng (nur
erlaubte Werte, nur Koordinaten rund um Barnim, Genauigkeit höchstens ±30 m, Texte begrenzt) und akzeptiert nur
Anfragen, die von `https://mitwilhelm.github.io` kommen. Ich habe ihn lokal mit Beispielmeldungen und einer
nachgebildeten GitHub-Antwort getestet; gegen das echte GitHub und Cloudflare ist er noch nicht gelaufen.

```js
// Cloudflare Worker: nimmt Meldungen von der Pilzkarte entgegen und legt daraus ein GitHub-Issue an.
// Der GitHub-Schlüssel (GITHUB_TOKEN) liegt nur hier als Secret, nie auf der Webseite.

const ERLAUBTER_URSPRUNG = "https://mitwilhelm.github.io";
const ERGEBNISSE = ["fund", "nichts"];
const PILZE = ["steinpilz", "pfifferling"];
const GROESSEN = ["jung", "mittel", "alt", "gemischt"];
const BESTANDSALTER = ["jung", "mittel", "alt", "unbekannt"];
const DICHTEN = ["licht", "mittel", "dicht"];
const GEBIET = { sued: 52.5, nord: 53.2, west: 13.2, ost: 14.3 }; // grob um den Landkreis Barnim
const MAX_BYTES = 6000;
const MAX_GENAUIGKEIT_METER = 30;

function antwort(status, daten) {
  const kopf = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ERLAUBTER_URSPRUNG,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  return new Response(JSON.stringify(daten), { status, headers: kopf });
}

function text(wert, maximum) {
  if (typeof wert !== "string" || wert.length > maximum) throw new Error("Text fehlt oder ist zu lang");
  return wert.replaceAll("`", "'");
}

function auswahl(wert, erlaubt) {
  if (!erlaubt.includes(wert)) throw new Error(`Wert ${String(wert)} nicht erlaubt`);
  return wert;
}

function liste(wert, maximalAnzahl) {
  if (!Array.isArray(wert) || wert.length > maximalAnzahl) throw new Error("Liste fehlt oder ist zu lang");
  return wert.map((eintrag) => text(eintrag, 40));
}

function zahl(wert, minimum, maximum) {
  if (typeof wert !== "number" || !Number.isFinite(wert) || wert < minimum || wert > maximum) {
    throw new Error("Zahl fehlt oder liegt außerhalb");
  }
  return wert;
}

export function pruefe(roh) {
  if (typeof roh !== "object" || roh === null) throw new Error("Meldung fehlt");
  const ergebnis = auswahl(roh.ergebnis, ERGEBNISSE);
  const zeitpunkt = text(roh.zeitpunkt, 30);
  if (Number.isNaN(Date.parse(zeitpunkt))) throw new Error("Zeitpunkt ungültig");
  return {
    id: text(roh.id, 40),
    zeitpunkt,
    breite: zahl(roh.breite, GEBIET.sued, GEBIET.nord),
    laenge: zahl(roh.laenge, GEBIET.west, GEBIET.ost),
    genauigkeitMeter: zahl(roh.genauigkeitMeter, 0, MAX_GENAUIGKEIT_METER),
    ergebnis,
    pilz: auswahl(roh.pilz, PILZE),
    groesse: ergebnis === "fund" ? auswahl(roh.groesse, GROESSEN) : null,
    kronendach: liste(roh.kronendach, 8),
    unterstand: liste(roh.unterstand, 8),
    bestandsalter: auswahl(roh.bestandsalter, BESTANDSALTER),
    dichte: auswahl(roh.dichte, DICHTEN),
    notiz: text(roh.notiz ?? "", 500),
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

export default {
  async fetch(anfrage, umgebung) {
    if (anfrage.method === "OPTIONS") return antwort(204, {});
    if (anfrage.method !== "POST") return antwort(405, { fehler: "Nur POST" });
    if (anfrage.headers.get("Origin") !== ERLAUBTER_URSPRUNG) return antwort(403, { fehler: "Ursprung nicht erlaubt" });
    const rohtext = await anfrage.text();
    if (rohtext.length > MAX_BYTES) return antwort(413, { fehler: "Meldung zu groß" });
    let meldung;
    try {
      meldung = pruefe(JSON.parse(rohtext));
    } catch (fehler) {
      return antwort(400, { fehler: String(fehler.message) });
    }
    const github = await fetch(`https://api.github.com/repos/${umgebung.REPO}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${umgebung.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "pilzkarte-meldungen",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(alsIssue(meldung)),
    });
    if (!github.ok) return antwort(502, { fehler: `GitHub antwortete ${github.status}` });
    const issue = await github.json();
    return antwort(201, { ok: true, nummer: issue.number });
  },
};
```

## Schritt 4: GitHub-Schlüssel erzeugen und bei Cloudflare eintragen

**a) Schlüssel bei GitHub (nur Issues, nur dieses Repository):**

1. GitHub → Profilbild → **Settings** → ganz unten **Developer settings** → **Personal access tokens** →
   **Fine-grained tokens** → **Generate new token**.
2. Name: `pilzkarte-meldungen`. Ablauf: 1 Jahr (Erinnerung im Kalender setzen).
3. **Repository access:** „Only select repositories“ → nur `pilzkarte-brandenburg`.
4. **Permissions** → **Repository permissions** → **Issues: Read and write**. Sonst nichts.
5. **Generate token** und den Schlüssel kopieren (er wird nur einmal angezeigt).

Hinweis: Beim Push hat bei dir ein feingranularer Schlüssel einen 403-Fehler gegeben, weil dort „Contents“ nötig war.
Für Issues reicht die Berechtigung „Issues“; wenn doch ein 403 kommt, melde dich.

**b) Schlüssel bei Cloudflare:**

1. Worker `pilzkarte-meldungen` → **Settings** → **Variables and Secrets** → **Add**.
2. Typ **Secret**, Name `GITHUB_TOKEN`, Wert: der kopierte Schlüssel. Speichern.
3. Nochmal **Add**, Typ **Text** (Plaintext), Name `REPO`, Wert `MitWilhelm/pilzkarte-brandenburg`. Speichern.
4. **Deploy** (Änderungen werden erst danach wirksam).

## Schritt 5: Testen (ohne die Webseite)

Ersetze `<URL>` durch deine Worker-Adresse. Erwartet: Antwort `{"ok":true,"nummer":…}` und ein neues Issue
bei GitHub.

```bash
curl -s -X POST '<URL>' -H 'Origin: https://mitwilhelm.github.io' -H 'Content-Type: application/json' \
  -d '{"id":"test1","zeitpunkt":"2026-10-10T10:00:00Z","breite":52.81,"laenge":13.82,"genauigkeitMeter":5,"ergebnis":"nichts","pilz":"steinpilz","groesse":null,"kronendach":["Kiefer"],"unterstand":["Kein Unterstand"],"bestandsalter":"alt","dichte":"mittel","notiz":"Test, bitte schließen"}'
```

Schließe das Test-Issue danach. Ohne den `Origin`-Kopf muss die Antwort `403` sein.

## Schritt 6: Missbrauch begrenzen

- **Ratenbegrenzung:** Cloudflare → dein Konto → **Security** → **WAF** → **Rate limiting rules** (steht nur zur Verfügung,
  wenn eine Domain im Konto ist; sonst lass es zunächst weg). Alternativ nur ein paar Tage die Issues beobachten.
- **Der `Origin`-Schutz hält nur andere Webseiten ab**, nicht jemanden mit einem eigenen Skript. Deshalb gibt es das
  Label `ungeprüft`, die Wertebereiche und die Koordinatenbegrenzung, und nichts fließt ungeprüft ins Modell.
- Bei Spam: Worker unter **Settings** → **Domains & Routes** deaktivieren oder den GitHub-Schlüssel widerrufen.
- Der Worker legt Issues unter **deinem** GitHub-Konto an. Wer Meldungen schickt, erscheint dort nicht namentlich.
- Datenschutz: Die Meldung enthält Koordinaten, Zeit und Waldangaben, aber keine Namen. Das Issue ist öffentlich.

## Schritt 7: Webseite anbinden (macht Claude)

Wenn der Worker läuft, schicke Claude **nur die Worker-Adresse** (nicht den Schlüssel). Die Seite bekommt dann:

- den Knopf „Senden“ schickt die Meldung zuerst an den Worker; bei Erfolg steht sie als „gesendet“ in der Liste,
- bei Fehler oder ohne Netz bleibt die Meldung im Handy gespeichert, und es gibt weiter den bisherigen Weg über das
  GitHub-Issue,
- Tests für den neuen Weg.
