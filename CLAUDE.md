# CLAUDE.md — Programmierregeln für dieses Projekt

Dieses Dokument fasst die bindenden Regeln zusammen, nach denen in diesem
Repository entwickelt wird (Pilz-Habitatkarte Brandenburg). Sie gelten für
**jeden** Code, der hier entsteht — unabhängig davon, welches Tool oder
welche Session ihn schreibt.

Herkunft: übernommen aus den Regeln eines früheren Projekts des Nutzers,
auf dieses Projekt zugeschnitten (Python-Datenaufbereitung + TypeScript-Web).

---

## Projektziel

Eine mobile Webseite, die für Steinpilz und Pfifferling zeigt, **wo** sie in
Brandenburg wachsen können (vorberechnete Habitat-Heatmap) und **wann** sich
die Suche lohnt (täglicher Wachstumsindex aus Wetterdaten). Dazu GPS-Standort
und ein Link zur Navigation (Google Maps / Komoot). Nutzer: nur der Eigentümer.

Gebiet: Landkreis Barnim (die früheren Testgebiete Joachimsthal und Schwärzesee liegen darin).

## Phasenplan

1. **Daten** — Rohdaten prüfen, Testgebiete zuschneiden, an der Grenze validieren
2. **Modell** — Habitat-Bewertung (Baumart × Standort) und Wachstumsindex (Wetter)
3. **Heatmap** — Habitat-Raster berechnen und als Kartenkacheln ausliefern
4. **Webseite** — Karte, Punkt-Infos, GPS, Navigationslink
5. **Server** — ganz Brandenburg, eigener Server

Reihenfolge und Inhalt einzelner Phasen können sich im Projektverlauf
ändern, die Regeln darunter nicht.

## Aufbau

- `pipeline/` — Python: Datenaufbereitung und Heatmap-Berechnung (offline)
- `web/` — TypeScript: die Webseite, die im Browser läuft
- `docs/decisions.md` — größere Entscheidungen
- Rohdaten liegen **nicht** im Git, sondern im GitHub-Release `daten-v1`

---

## Regel 1 — Planen vor Code

- Bei Änderungen über mehrere Dateien: zuerst einen kurzen Plan vorlegen,
  dann auf ausdrückliches OK warten, bevor Code geschrieben wird.
- Faustregel: max. 3 Dateien bzw. ~150 Zeilen pro Schritt.
- Ein Thema pro Schritt — nicht mehrere unabhängige Änderungen bündeln.
- Bei Unsicherheit: fragen, nicht raten.

## Regel 2 — Änderungsbericht nach jeder Code-Antwort

Jede Antwort, die Code ändert, endet mit vier Punkten:

1. **Was** wurde geändert
2. **Warum** (die Begründung, nicht nur die Beschreibung)
3. **Wie prüfen** (welche Tests/Befehle das belegen)
4. **Was nicht geprüft** wurde

Punkt 4 wird **nie** weggelassen. Für Befehle, die nicht tatsächlich
ausgeführt wurden, wird nie behauptet, sie "sollten funktionieren".

## Regel 3 — Ausnahmen müssen markiert sein

Jede Abweichung von einer dieser Regeln braucht einen Kommentar direkt
über der betroffenen Zeile:

```python
# Ausnahme (Regel 4, Versions-Pin statt neuer Abhaengigkeit): ...
```

Mehr als zwei Ausnahmen in einer Datei: stoppen und nachfragen.

## Regel 4 — Explizit statt clever

- Keine Abstraktion, bevor ein Muster nicht mindestens dreimal
  tatsächlich vorkommt.
- Ohne Regel-3-Ausnahme verboten: `eval`/`exec` (Python und JS),
  `getattr`/`setattr` bzw. Property-Zugriff mit variablem Namen,
  Monkeypatching, Metaklassen, DI-Container, Plugin-Registries, Event-Bus,
  erzwungene Basisklassen.
- Keine neue Abhängigkeit, ohne vorher Zweck, Größe und Alternative
  darzulegen.
- Kein `__init__.py` / `index.ts`, das nur re-exportiert.

## Regel 5 — Reine Funktionen, I/O an den Rändern

- Funktionen für Habitat-Bewertung, Wachstumsindex und Kartenberechnung
  haben keinen Zugriff auf Dateisystem, Netzwerk oder Konsole.
- I/O lebt ausschließlich in Edge-Modulen: Python `pipeline/io_*.py`,
  TypeScript `web/src/clients/`.
- Öffentliche Schnittstelle sichtbar machen: Python `__all__`,
  TypeScript nur explizite `export`s.

## Regel 6 — Typisierung und Benennung

- Volle Typannotationen überall, kein blankes `Any` / `any`.
- Falls wirklich nötig: benannter Type-Alias mit `# Warum:` / `// Warum:`.
- Kein unbegründetes `# type: ignore`, `cast()`, `as`-Cast oder `@ts-ignore`.
- Benannte Dataclasses/Pydantic-Modelle bzw. TypeScript-Typen statt roher
  Dicts/Objekte.
- Maximal 3 Funktionsparameter — sonst in ein benanntes Objekt bündeln.
- Keine verschachtelten Ternaries.
- Klassen nur für echten Zustand, kein Modul-Level-State außer echten
  Konstanten.
- Keine Abkürzungen, außer `id`/`url`/`db`.
- Booleans heißen `is_x`/`has_x`/`can_x` (TS: `isX`/`hasX`/`canX`).
- Magic Numbers werden zu benannten Konstanten (z. B. Schwellen für Regen,
  Temperatur, Bodenfeuchte).
- Kein bare `except:` bzw. leeres `catch {}`.
- Fehler werden mit `raise ... from err` bzw. `new Error(..., { cause })`
  weitergereicht, nie verschluckt.

## Regel 7 — Invarianten statt Annahmen

- Laufzeit-Invarianten werden explizit geprüft und mit festem Präfix
  gemeldet: `"Invariante verletzt: ..."`, inklusive des konkreten Werts.
- Kein `assert` in Produktionscode (nur in Tests erlaubt).
- Kein `value or default` / `value ?? default` oder stillschweigendes
  `.get(key, default)`, wenn das einen echten Fehler verdecken würde.

## Regel 8 — Kommentare erklären Warum, nicht Was

- Kommentare nur dort, wo sie etwas erklären, das der Code nicht zeigt:
  API-Eigenheiten, Koordinatensysteme, Grenzen externer Daten, Workarounds.
- Jede Datei bekommt einen 2–3-zeiligen Kopfkommentar mit ihrem Zweck.
- Größere Entscheidungen in `docs/decisions.md`: Kontext, Entscheidung,
  verworfene Alternative.

## Regel 9 — Tests vor/mit jeder Verhaltensänderung

- Reihenfolge der Testarten: echter Lauf gegen die reale Quelle/Datei >
  gezielte Unit-Tests > Mocks zuletzt.
- Mocks nur dort, wo ein echter Lauf unmöglich ist: Netzwerk, Zeit, Zufall.
- Parametrisierte Tabellen-Tests sind willkommen.
- Testnamen auf Deutsch, in Prosaform.
- Keine geteilten Fixtures/Factories/Vererbung zwischen Tests.
- Werkzeuge werden tatsächlich ausgeführt, ihre Ausgabe wird gezeigt:
  - Python: `pytest`, `mypy`, `ruff`
  - TypeScript: `tsc --noEmit`, `eslint`, `node --test`

## Regel 10 — Bei Fehlern: Ursache vor Lösung

- Erst die Ursache verstehen, dann den Fix schreiben.
- Nach zwei gescheiterten Versuchen: stoppen und nachfragen.
- Keine versteckten Workarounds (Tests deaktivieren, Prüfungen abschwächen,
  Testgebiete heimlich verkleinern) ohne das klar als solches zu benennen.

## Regel 11 — Externe Daten an der Grenze validieren

- Externe Daten (DLR-Baumarten, LFB-Standortskarte, LFB-Waldflächen,
  Open-Meteo, OpenStreetMap) werden einmal an der Grenze in ein
  Pydantic-Modell/Dataclass bzw. einen geprüften TS-Typ validiert —
  nicht wiederholt downstream.
- Koordinatensystem jeder Quelle wird beim Einlesen geprüft
  (DLR: EPSG:3035, LFB: EPSG:25833, Web: EPSG:4326/3857).
- Kein chained Pandas-Indexing (`.loc` statt `df[...][...]`).
- Docstrings nur auf der öffentlichen Schnittstelle.
- Keine Truthiness-Prüfung auf Werten, die legitim 0/leer sein können
  (Baumart-Code 0 = Kiefer!).
- Keine Seiteneffekte beim Modul-Import.
- API-Clients dokumentieren Rate-Limits und Retry-Verhalten im Datei-Kopf
  (Open-Meteo: < 10.000 Abrufe/Tag, nur nicht-kommerziell).

## Regel 12 — Webseite

Semantisches HTML, kein inline `onclick` oder `style`, `id`/`data-*` als
HTML↔JS-Vertrag, kein `innerHTML` mit dynamischen Daten, Alt-Texte, Labels
für Formularfelder. Mobil zuerst: Die Seite wird im Wald auf dem Handy benutzt.

## Regel 13 — Lizenzen und Quellen

- Jede Datenquelle wird mit Lizenz in `README.md` geführt und auf der
  Webseite genannt (CC-BY-4.0, Datenlizenz Deutschland, ODbL, Open-Meteo).
- Code, Texte und Gestaltung anderer Pilzkarten-Dienste werden nicht
  übernommen.

---

## Checkliste vor Abschluss jedes Schritts

- [ ] Funktionen sind erklärbar, keine versteckte Komplexität
- [ ] Vollständige Typisierung
- [ ] Invarianten statt `assert`
- [ ] Keine Magic Numbers
- [ ] Ausnahmen markiert (Regel 3), höchstens 2 pro Datei
- [ ] Keine unangekündigten neuen Abhängigkeiten oder Abstraktionen
- [ ] Logik und I/O sind getrennt
- [ ] Rate-Limits dokumentiert
- [ ] Koordinatensysteme geprüft
- [ ] Tests/Typprüfung/Linter tatsächlich ausgeführt, Ausgabe gezeigt
- [ ] 4-Punkte-Änderungsbericht geschrieben
- [ ] Unsicherheiten offen benannt

---

## Arbeitsweise

- Der Nutzer wird aktiv nach fehlenden Informationen oder Entscheidungen
  gefragt, statt Annahmen zu treffen.
- Erklärungen erfolgen schrittweise und nachvollziehbar, nicht als
  Fachjargon-Dump — der Nutzer wird durch den Prozess geführt.
- Git-Workflow: Arbeit auf Feature-Branches, klare Commit-Nachrichten,
  regelmäßiges Pushen. Niemals direkt auf `main` pushen ohne ausdrückliche
  Erlaubnis.
- Rohdaten (GeoTIFF, GML) werden nie ins Git committet; sie liegen im
  Release `daten-v1`. Abgeleitete, kleine Dateien (zugeschnittene
  Testgebiete, Kacheln) dürfen ins Repo, wenn sie unter 25 MB bleiben.
- Secrets (API-Keys etc.) werden nie in versionierten Dateien abgelegt;
  `.env` ist gitignored und wird vor jedem Commit dagegen geprüft.
