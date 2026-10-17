# Sicherheit: Angriffsszenarien, Maßnahmen, Restrisiken

Stand 2026-10-17, vier Prüfrunden (Analyse, Härtung, erneuter Angriff auf die eigenen Lösungen, Prüfung der live laufenden Fassung). Geprüft wurden die Seite
(GitHub Pages), der Meldeserver (Cloudflare Worker), das Repository mit GitHub Actions und der nächtliche Prüfauftrag.
Es ist eine eigene Prüfung, kein Gutachten und kein Penetrationstest durch Dritte.

## Was geschützt werden soll

- **Besucher:** keine Fremdcodes im Browser, kein unnötiges Weitergeben von IP-Adresse und Standort.
- **Daten und Modell:** Meldungen dürfen nicht unbemerkt das Habitat-Modell verfälschen.
- **Zugänge:** GitHub-Schlüssel des Workers, Zugang zum Repository, Cloudflare-Konto.
- **Verfügbarkeit:** Seite und Meldeweg sollen nicht durch Spam lahmgelegt werden.

## Angriffsszenarien und Maßnahmen

| # | Szenario | Maßnahme | Geprüft durch | Restrisiko |
|---|---|---|---|---|
| 1 | Fremder Code auf der Seite (XSS, eingeschleustes Skript) | Kein `innerHTML`/`eval` im Code (Suche); Content-Security-Policy als meta-Tag: nur eigene Dateien, OSM-Kacheln, Open-Meteo, Meldeserver; keine Inline-Skripte | Suche nach Senken; im Browser Versuche mit fremdem Skript, Inline-Skript, fremdem Bild, `fetch`, iframe: alle blockiert, Verstoß gemeldet | meta-CSP kann kein `frame-ancestors`; Eval-Sperre per Werkzeug nicht beweisbar (siehe unten) |
| 2 | Anfällige Bibliothek (Lieferkette) | MapLibre 5.11 → 6.14 (GHSA-jrc7-96c5-q579, bei uns nie ausnutzbar: kein `setHTML`); Dependabot wöchentlich; exakte Versionen im `package.json`; Aktionen mit festem Commit | `npm audit`: 0 Funde, alle Tests grün, Karte im Browser | neue Funde zwischen den Dependabot-Läufen |
| 3 | Besucher-IP an Google (Schriften) | Schriften liegen auf der eigenen Seite (OFL, 45 KB) | Keine Anfrage an fonts.googleapis.com mehr, CSP erlaubt keine fremden Schriften | – |
| 4 | Genauer Standort an Dritte | Wetterabruf nur mit auf 0,01° (~1 km) gerundeten Koordinaten; Referrer nur Ursprung | Test der Abruf-URL | OSM-Kacheln und Open-Meteo sehen trotzdem die grobe Gegend und die IP |
| 5 | Meldungs-Spam über den Worker | Obergrenze je IP (5 in 10 Minuten) und insgesamt (30 je Stunde, über die Issues bei GitHub), Meldungs-ID einmalig (doppelt: erstes Issue), Zeitfenster 24 h | 12 Worker-Tests mit nachgebildetem GitHub; Fuzz mit 6.000 zufällig veränderten Anfragen: nie Fehler 500, nie ein Feld außerhalb der Liste | Wer viele IPs hat, kann trotzdem 30 Issues je Stunde erzeugen; eine solche Flut sperrt echte Meldungen bis zu eine Stunde (Fehler 429, nichts geht verloren, das Formular bleibt offen); ein Captcha (Turnstile) wäre die nächste Stufe |
| 6 | Einschleusen von Text in Issues (Mentions, Markdown, Links) | Strenge Werte, nur Listen-Werte für Baumarten, ISO-Zeit mit festem Muster, Backticks entfernt, Freitext nur im JSON-Block | Test mit `@evil`, `(@evil)`, Markdown-Link; Fuzz: Titel und Body immer im erwarteten Format | `notiz` (500 Zeichen) bleibt Freitext im JSON-Block |
| 7 | Gefälschte Funde verfälschen das Modell | Label `ungeprüft`; Web-Funde zählen nicht für Modellauswertungen; Änderungen am Modell nur auf einem Zweig mit Zustimmung | Regel im nächtlichen Auftrag, Prüfskript wertet nur `Nutzer` aus | Du musst Web-Funde prüfen und bestätigen |
| 8 | Prompt-Injection in den nächtlichen Prüfauftrag | Auftrag behandelt Issue-Text als Daten, nutzt nur geprüfte Felder, ignoriert `notiz`, darf `.github/`, `worker/` und Zugänge nie ändern, höchstens 10 Datensätze je Lauf | Prompt neu geschrieben und gelesen; nicht mit einem echten Angriff getestet | Ein Sprachmodell lässt sich nie zu 100 % absichern; deshalb Rechtebegrenzung und Bericht an dich |
| 9 | Fremde Seite ruft den Worker auf | Herkunftsprüfung (`Origin`) | Test mit falscher Herkunft: 403 | Ein Skript (kein Browser) kann den Kopf fälschen; dann greifen Nr. 5 bis 7 |
| 10 | Schlüssel des Workers gestohlen | Schlüssel nur bei Cloudflare, feingranular: nur Issues, nur dieses Repository | Suche nach Schlüsseln im Code und im ganzen Verlauf: nichts gefunden | Wer ihn bekommt, kann Issues anlegen und ändern (nicht den Code) |
| 11 | Manipulierte GitHub Action | Feste Commits statt beweglicher Tags, Schreibrechte nur im Veröffentlichen-Job, kein `pull_request_target`, keine Geheimnisse im Bau | Workflow gelesen, Lauf erfolgreich | Aktion selbst könnte kompromittiert sein (Dependabot hilft bei Updates) |
| 12 | Clickjacking (Seite in fremdem Rahmen) | Mit GitHub Pages nicht per Header möglich; CSP verbietet fremde Rahmen für **eingebettete** Inhalte, nicht das Einbetten der Seite | – | Gering: Es gibt keine Konten und keine sensiblen Aktionen; Standort braucht die Erlaubnis des Besuchers |

## Prüfrunden

1. **Runde 1 (Analyse):** Suche nach `innerHTML`, `eval` usw. (keine Treffer), Workflow gelesen, `npm audit` (1 kritische Meldung), Live-Header
   (nur HSTS), Wetter-Abruf (4 Nachkommastellen), Worker mit 10 Fehlversuchen (alle abgewiesen), Titel-Einschleusung am Worker
   nachgestellt (`@evil 2026-10-17` wurde als Datum akzeptiert), Schlüssel-Suche im Verlauf (nichts), Google Fonts, E-Mail in Commits.
2. **Runde 2 (Härtung und erster Gegentest):** CSP, eigene Schriften, gerundete Koordinaten, MapLibre 6, Worker neu mit Obergrenzen und
   strengen Werten (`worker/meldungen.js`), Dependabot, Aktionen festgesetzt, Auftrag gehärtet. Gegentest: fremde Skripte, Bilder,
   `fetch`, iframe im Browser blockiert; Fuzz am Worker mit 6.000 Anfragen; echte Meldungen vom Oktober (Issues 2–10) werden vom neuen
   Worker akzeptiert, die Test-IDs 11 und 12 zu Recht nicht.
3. **Runde 3 (erneuter Angriff auf die eigenen Lösungen):** Alle Rechner, die der gebaute Code ansprechen kann, aus `dist/` ausgelesen und mit der
   CSP verglichen: Abgerufen werden nur OSM-Kacheln, Open-Meteo und der Meldeserver (alle erlaubt); `github.com`, `komoot.com`,
   `google.com`, `maplibre.org` und `openstreetmap.org` sind nur Links, die der Besucher selbst öffnet. Kein Verweis auf Google Fonts
   mehr. Echte Anfrage der Seite an den Worker: keine CSP-Verletzung, nur die gewollte CORS-Abweisung der Herkunft localhost.
   Befunde der Runde 3: (a) Eine Flut kann echte Meldungen bis zu eine Stunde sperren (oben in Nr. 5 vermerkt, Captcha als nächste Stufe);
   (b) die Eval-Sperre ließ sich nicht beweisen, weil das Prüfwerkzeug `eval` über den Entwickler-Kanal ausführt, der die CSP umgeht; sie
   folgt aus `script-src 'self'` ohne `unsafe-eval`; (c) beim Einbetten in einen fremden Rahmen meldet der Browser zwar `onload`, die CSP
   hat den Inhalt aber blockiert (Verstoß `frame-src` gemeldet). Keine neuen Lücken gefunden, die eine Änderung nötig machten.

4. **Runde 4 (live laufende Fassung, nach deinen Einstellungen bei GitHub und Cloudflare):**
   - Der bei Cloudflare laufende Worker-Code stimmt mit `worker/meldungen.js` überein (über die Cloudflare-Verbindung gelesen).
   - Zehn Abweisungs-Tests live (Zeitstempel mit `@evil`, `(@evil)`, falsche ID, Skript als Baumart, unbekannte Baumart und Pilzart, zu altes
     Datum, Koordinate außerhalb, kaputtes JSON, 7 KB, falsche Herkunft, falsche Methode): alle mit 400/403/405/413 abgewiesen, Fehlertexte
     nennen nur das Feld, nie die Eingabe; Vorabfrage 204 mit `nosniff` und `no-store`.
   - **Neuer Befund:** Der Doppelschutz über die GitHub-Liste griff nicht sofort. Dieselbe Meldungs-ID vier Sekunden später legte ein zweites
     Issue an (Issues 28 und 29), weil die Liste bei GitHub nach dem Anlegen noch einige Sekunden hinterherhinkt. **Behoben:** Der Worker
     merkt sich jede angelegte ID zusätzlich eine Stunde im Cache des Rechenzentrums und antwortet bei Wiederholung sofort mit der ersten
     Nummer (dann zählt der Versuch auch nicht für die IP-Grenze). Neuer Test mit leerer GitHub-Liste (13 Tests grün). Die neue Fassung
     muss bei Cloudflare noch einmal eingespielt werden.
   - **Neuer Befund (Fehler auf dem PC):** Auf einem breiten Bildschirm ließ sich weiter herauszoomen, als die graue Fläche reichte; links und rechts
     war die Karte wieder bunt. Ursachen: Die Außenfläche (Welt mit Loch) wurde nicht gezeichnet, und der Bewegungsraum (0,5° um den Barnim) war
     kleiner als ein breites Bild. **Behoben:** Das Verlaufsbild reicht jetzt 66 km über die Grenze (610 × 630 Pixel, 12 KB) und ist selbst die
     Grenze für Verschieben und Herauszoomen; das Loch der Außenfläche ist im Uhrzeigersinn gezeichnet. Geprüft auf 1400 × 850 (sichtbar 147 × 89 km,
     alles grau) und auf Handygröße 375 × 812 (sichtbar 75 × 163 km, ganzer Barnim im Bild, alles grau).
   - Push-Zugang, Live-Seite (CSP, keine Google-Anfrage, HSTS), `npm audit` (0 Funde), Suche nach Schlüsseln (nichts) und die Dependabot-Vorschläge
     (15 offene Pull-Requests, darunter große Sprünge wie TypeScript 5.9 → 7.0 und ESLint 9 → 10) geprüft. Nichts davon wurde übernommen.
   - Nicht geprüft: Push protection (ein absichtlicher Test mit falschem Schlüssel würde diesen öffentlich machen) und die IP-Grenze live (die
     Grenze liegt für alle auf deiner Adresse; der Test hätte deine eigenen Meldungen 10 Minuten blockiert). Beides ist lokal getestet.

## Offen / nur du kannst es tun

- **Worker neu einspielen:** `worker/meldungen.js` bei Cloudflare einfügen und „Deploy“ drücken (Anleitung Schritt 3); danach Schritt 5 testen.
  Solange die alte Fassung läuft, fehlen Obergrenzen und Doppelschutz.
- **2-Faktor-Anmeldung** bei GitHub und Cloudflare einschalten.
- **GitHub-Einstellungen** (Repository → Settings): Secret scanning mit Push protection, Dependabot alerts, Private vulnerability reporting
  aktivieren; Branch-Schutz für `main` (Pull-Request nötig) nur, wenn du das willst, denn es bremst die direkten Pushes.
- **Zugangsschlüssel auf dem Mac:** Der klassische Schlüssel für Pushes darf alle Repositories des Kontos ändern (auch künftige). Solange es nur
  dieses eine Repository gibt, ist das Risiko begrenzt (Entscheidung des Nutzers, 2026-10-17); sinnvoll bleibt ein feingranularer Schlüssel nur
  für dieses Repository (Contents und Workflows: Lesen und Schreiben).
- **Private E-Mail:** In GitHub unter Settings → Emails „Keep my email addresses private“ und „Block command line pushes that expose my
  email“ einschalten; deine echte Adresse steht in älteren Commits und bleibt dort sichtbar.
- **Captcha** (Cloudflare Turnstile) für den Meldeweg, wenn Spam auftritt.
