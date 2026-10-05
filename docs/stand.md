# Projektstand (Übergabe)

Stand: 05.10.2026. Für jede neue Claude-Code-Sitzung: zuerst `CLAUDE.md`, dann diese Datei, dann `docs/decisions.md`.

## Lage in einem Satz

Die mobile Karte „Pilzkarte Barnim“ ist live (GitHub Pages, gebaut von `main`) für die Testgebiete Joachimsthal und
Schwärzesee. Fokus ist der Landkreis Barnim; ganz Brandenburg ist zurückgestellt.

## Läuft und ist live

| Bereich | Wo | Stand |
|---|---|---|
| Habitat-Heatmap | `pipeline/habitat.py`, `nachbarschaft.py`, `io_heatmap.py` | Baum × Boden × Mischung, Stufen 50–100 relativ zum Gebiet; Wegrand +15 % nur an Forstwegen und Pfaden; ohne Höhendaten, ohne Hang |
| Wachstumsindex | `web/src/wachstum.ts` | Regen stufenlos (voll ab 20 mm, Annahme), Lufttemperatur 11–15,5 °C optimal, Hitze-Bremse, Feuchte, Saison, Frost |
| Wege | `pipeline/io_waldwege.py` → `web/public/daten/*_wege.geojson` | OSM: Straße (gelb), Forstweg (weiß), Pfad (gestrichelt) |
| Brennpunkte | `web/src/hotspots.ts`, `karte.ts` | Umrisse ab Stufe 85, Türkis = Index heute günstig, Pink = nur letzte 7 Tage; Knopf „Nur Brennpunkte“ |
| Melden | `web/src/meldung.ts`, `melden.ts`, `clients/meldespeicher.ts` | Fund oder „Nichts gefunden“ + Waldbeschreibung, nur mit GPS ≤ 30 m, im Handy gespeichert, „Senden“ öffnet GitHub-Issue (Label `meldung`) |
| Barnim-Bodenwerte | `daten/barnim_stok_antworten_1.jsonl`, `_2.jsonl`, `_nachholen.jsonl` | Alle 21.763 Standortflächen abgefragt, alle mit Bodenangaben (34 Nachholer) |

## Offen (in dieser Reihenfolge sinnvoll)

1. **Barnim-Karte bauen:** Baumarten und Waldflächen für den Landkreis zuschneiden (Grenze: `daten/barnim_grenze_25833.geojson`),
   Wege aus OSM holen, Heatmap aus den Barnim-Antworten rechnen, Webexport und Gebietsliste erweitern. Noch kein Code dafür.
2. **Meldungen auswerten:** Issues mit Label `meldung` einsammeln und mit der Heatmap abgleichen (Hotspot ohne Fund,
   Fund ohne Hotspot). Das Label `meldung` im Repository anlegen. Auswertungsskript fehlt.
3. **Funde auswerten:** Die Funde liegen in `daten/funde.csv` (öffentlich, vom Nutzer erlaubt). Neue Funde kommen über die
   Melde-Funktion als Issues; sie in die CSV übernehmen und gegen die Heatmap prüfen.
4. **Handy-Test der Live-Seite** (nie auf echtem Handy geprüft): GPS, Melden, Knopf „Nur Brennpunkte“, Umrisse, Dunkelmodus.
5. **Aufräumen:** `pipeline/io_hoehe.py` und `.github/workflows/hoehendaten.yml` sind ohne Verwendung (Hang und Kronenhöhe
   verworfen); mypy-Fehler `pipeline/nachbarschaft.py:31`; Recherche-ZIP liegt öffentlich im Release; alte Branches
   (`webseite`, `habitat-v2`, `habitat-heatmap`, `boden-abfrage`, `daten-zuschnitt`) löschen.
6. **Ungeklärt:** Unterstand (Buche/Eiche unter Kiefer) ist von keiner Karte sichtbar; reine Kiefernflächen trennt das Modell
   schwach (6 Funde, mittlerer Rang 62 %). Dafür sind die Meldungen gedacht.

## Lokal arbeiten

```
git clone https://github.com/MitWilhelm/pilzkarte-brandenburg.git && cd pilzkarte-brandenburg
pip install -e ".[dev]"          # Python 3.12 oder neuer (pyproject.toml)
ruff check pipeline tests && ruff format --check pipeline tests && mypy && pytest
cd web && npm ci && npx tsc --noEmit && npx eslint . && node --test && node build.mjs   # Ergebnis: web/dist
python -m pipeline.io_heatmap && python -m pipeline.io_webdaten                         # Heatmap neu, Export nach web/public/daten
```

Recherche und Notizen liegen in `docs/recherche/` (Bericht: `wachstum-modell-bericht.md`, Quellenlisten: `notizen/`).
Rohdaten (nicht im Git) aus dem Release `daten-v1` nach `rohdaten/` laden: `treespecies_de_2022.tif` (ganz Deutschland, 550 MB),
`stok_25833.gml` (Standortskarte Brandenburg), `ifgk_wld_25833.gml` (Waldflächen). Dort liegen außerdem drei LGB-Kachelpaare
(bDOM/DGM) und das Recherche-ZIP. Pushen auf `main` löst den Webseiten-Build aus; nur nach Rückfrage (siehe `CLAUDE.md`).

## Stolpersteine (gelernt)

- **Lokal entfallen die GitHub-Actions-Umwege** weitgehend: Sie waren nur nötig, weil die Cloud-Umgebung Overpass, die
  Open-Meteo-Archive und teils den LGB-Server nicht erreichte. Die Workflows laufen nur bei Push auf den Arbeitsbranch.
- **LGB-Server** liefert nur ~30–80 KB/s (eine bDOM-Kachel 8–22 Minuten); flächendeckend nicht vertretbar.
- **Open-Meteo** antwortet gelegentlich mit 429/503; die Seite zeigt dann kein Wetter (Umriss je Fläche fehlt still).
- **Overpass** meldet 504 bei Überlast; `io_waldwege.py` wiederholt dreimal. Nur eine Abfrage gleichzeitig.
- **GPS-Werte des Browsers** sind Prototyp-Getter (`"x" in obj`, nicht `Object.entries`); siehe `standortAusGpsEreignis`.
- **Vor jedem Commit** `ruff check`, `ruff format --check`, `mypy`, `pytest` und die Web-Prüfungen ausführen (zweimal wegen
  Zeilenlänge nachgebessert).
- **Kronenhöhe aus Meta/ETH** ist unbrauchbar (r = 0,33 bzw. 0,12 gegen LGB), Details in `docs/decisions.md`.

## Branches

`main` ist live. Der Arbeitsbranch `claude/cool-hamilton-x8pj44` ist identisch mit `main`.
