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

Im Editor alles löschen, den **gesamten Inhalt der Datei [`worker/meldungen.js`](../worker/meldungen.js)** einfügen und
**„Deploy“** drücken. Die Datei ist die einzige Fassung des Codes (kein Abschreiben, kein Auseinanderlaufen). Der Worker:

- akzeptiert nur Anfragen von `https://mitwilhelm.github.io`,
- prüft jede Meldung streng (nur erlaubte Werte, Koordinaten rund um Barnim, Genauigkeit höchstens ±30 m, Texte begrenzt,
  Meldungs-ID im Format der Seite, Zeitpunkt ein echtes ISO-Datum der letzten 24 Stunden),
- begrenzt Massenmeldungen: höchstens 5 je IP-Adresse in 10 Minuten und 30 in der Stunde insgesamt,
- legt bei gleicher Meldungs-ID kein zweites Issue an, sondern nennt das erste,
- zeigt in Fehlermeldungen nie Eingaben oder Interna.

Getestet mit `node --test worker/meldungen.test.mjs` (12 Tests, nachgebildetes GitHub, kein Netzwerk). Gegen das echte
Cloudflare und GitHub ist jede Änderung erst nach deinem „Deploy“ und dem Test in Schritt 5 geprüft.

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

Erwartet: Antwort `{"ok":true,"nummer":…}` und ein neues Issue bei GitHub. Die Meldungs-ID und der Zeitpunkt müssen aktuell
sein; der Befehl erzeugt sie selbst. Ersetze `<URL>` durch deine Worker-Adresse.

```bash
JETZT=$(date -u +%s)000; ZEIT=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
curl -s -X POST '<URL>' -H 'Origin: https://mitwilhelm.github.io' -H 'Content-Type: application/json' \
  -d "{\"id\":\"m$JETZT\",\"zeitpunkt\":\"$ZEIT\",\"breite\":52.81,\"laenge\":13.82,\"genauigkeitMeter\":5,\"ergebnis\":\"nichts\",\"pilz\":\"steinpilz\",\"groesse\":null,\"kronendach\":[\"Kiefer\"],\"unterstand\":[\"Kein Unterstand\"],\"bestandsalter\":\"alt\",\"dichte\":\"mittel\",\"notiz\":\"Test, bitte schließen\"}"
```

Schließe das Test-Issue danach. Weitere Prüfungen (alle ohne neues Issue):

- Ohne `Origin`-Kopf: `403`. Vorabfrage des Browsers: `curl -s -i -X OPTIONS '<URL>' -H 'Origin: https://mitwilhelm.github.io' | head -3` zeigt `204`.
- Derselbe Befehl zweimal mit **gleicher** ID: Das zweite Mal kommt `"doppelt":true` mit der Nummer des ersten Issues.
- Mehr als 5 Meldungen in 10 Minuten von einer Adresse: `429`.

## Schritt 6: Missbrauch begrenzen

Eingebaut (siehe Schritt 3): Herkunftsprüfung, strenge Werte, Zeitfenster, Obergrenzen je IP und je Stunde, Doppelschutz.
Was **du** tun kannst:

- Schau in den ersten Tagen gelegentlich auf die Issues; alles mit dem Label `ungeprüft` prüfst du selbst, bevor es ins Modell geht.
- Die **Herkunftsprüfung** hält nur andere Webseiten ab, nicht jemanden mit einem eigenen Skript (der kann den Kopf fälschen).
  Echten Schutz davor bietet ein Captcha (Cloudflare Turnstile, kostenlos): Es braucht ein Widget in deinem Cloudflare-Konto und
  einen Schlüssel im Worker. Sag Bescheid, wenn du das willst.
- Bei Spam: Worker unter **Settings** → **Domains & Routes** deaktivieren oder den GitHub-Schlüssel bei GitHub widerrufen.
- Der Worker legt Issues unter **deinem** GitHub-Konto an. Wer meldet, erscheint dort nicht namentlich. Die Issues sind öffentlich.
- Setze dir einen Kalendertermin vor dem Ablauf des GitHub-Schlüssels (nach 1 Jahr).

## Schritt 7: Webseite angebunden (erledigt)

In der Meldungs-Liste der Seite gibt es je Meldung **„Senden“**: Die Meldung geht an den Worker (Adresse in
`web/src/clients/meldeserver.ts`), der ein Issue anlegt. Danach steht dort „gesendet (Issue #n)“, und ein zweites Senden
ist nicht mehr möglich (kein doppeltes Issue). Bei Fehler oder ohne Netz bleibt die Meldung im Handy, die Seite nennt
den Grund, und **„Über GitHub“** öffnet wie bisher das vorausgefüllte Issue (braucht ein GitHub-Konto).

Stand 2026-10-17: Der Worker nimmt Meldungen an (Test-Issue #11 mit den Labels `meldung`, `ungeprüft`). Das Feld
`modell` (Habitat-Stufe, Index am Ort) wird vom Worker nicht übernommen; es lässt sich aus den Koordinaten nachrechnen.
