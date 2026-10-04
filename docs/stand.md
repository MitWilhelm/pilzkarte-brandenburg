# Projektstand (Übergabe)

Stand: 03.10.2026, 23:15 Uhr. Für jede neue Claude-Code-Sitzung: zuerst `CLAUDE.md`, dann diese Datei lesen.

## Erledigt

| Bereich | Wo | Stand |
|---|---|---|
| Rohdaten | Release `daten-v1` | DLR-Baumarten 2022, LFB-Standortskarte (nur Geometrie), LFB-Waldflächen |
| Zuschnitt Testgebiete | `pipeline/io_zuschnitt.py`, `daten/` | Joachimsthal, Schwärzesee (je 6 × 6 km) |
| Bodenwerte | `pipeline/io_stok_abfrage.py`, Workflow `boden-abfrage.yml` | GetFeatureInfo beim LFB für alle 1.463 Flächen, `daten/stok_antworten.jsonl` |
| Habitat-Heatmap v2 | `pipeline/habitat.py`, `nachbarschaft.py`, `io_heatmap.py` | Baum × Boden × Mischung, Stufen 50–100 relativ zum Gebiet |
| Webdaten | `pipeline/io_webdaten.py` → `web/public/daten/` | Daten-PNG (R Baumart, G Steinpilz, B Pfifferling), Boden-GeoJSON |
| Wachstumsindex | `web/src/wachstum.ts`, `clients/openmeteo.ts` | Regen-Auslöser, Latenz, Bodentemp., Feuchte, Saison, Frost |
| Webseite | `web/` | MapLibre + OSM, GPS, Punkt-Infos, Google Maps/Komoot, Schutzgebiet-Hinweis |
| Veröffentlichung | Workflow `pages.yml` | Build und Tests grün; Deploy nur von `main` erlaubt |

## Offen

1. **Pull Request #1 (`webseite` → `main`) mergen** – erst dann geht die Seite auf
   `https://mitwilhelm.github.io/pilzkarte-brandenburg/` live. Merge braucht die Zustimmung des Nutzers.
2. Live-Seite prüfen: GPS, Wetterabruf, Kartenhintergrund auf dem Handy.
3. Große Version (ganz Brandenburg): Baumarten- und Standortsdaten landesweit, Boden-Abfrage in
   Etappen (≈ 228.000 Flächen, bei 1 Abfrage/s mehrere Tage – Strategie nötig), Heatmap als Kacheln.
4. Habitat v3: Bestandshöhe aus LGB-Höhendaten (nDOM) als Alters-Näherung.
5. Kalibrierung mit Funddaten (GBIF) und Rückmeldungen des Nutzers aus dem Wald.

## Netzwerk

Die Cloud-Umgebung braucht Zugriff auf diese Hosts (Netzwerk „Custom“ + Standardliste oder „Full“):

```
api.open-meteo.com
www.brandenburg-forst.de
download.geoservice.dlr.de
isk.geobasis-bb.de
data.geobasis-bb.de
inspire.brandenburg.de
tile.openstreetmap.org
api.gbif.org
mitwilhelm.github.io
```

Ohne diesen Zugriff laufen Netzabrufe über GitHub Actions (siehe Workflows `boden-abfrage.yml`, `wetter-probe.yml`).

## Branches

`main` ← (PR #1) `webseite` ← `habitat-v2` ← `habitat-heatmap` ← `boden-abfrage` ← `daten-zuschnitt`.
Alle Arbeit steckt in `webseite`; die älteren Branches können nach dem Merge gelöscht werden.

## Große Version: Erkenntnisse vom 04.10.2026 (Nacht)

- **Rohdaten im Release `daten-v1` sind landesweit:** `stok_25833.gml` enthält laut Kopfzeile 227.989 Standortflächen (`numberMatched`), `treespecies_de_2022.tif` (550 MB, ganz Deutschland) und `ifgk_wld_25833.gml` (137 MB). Abdeckung der Waldflächen in Brandenburg noch nicht im Einzelnen geprüft.
- **Erreichbarkeit aus der Cloud-Umgebung (Stand heute Nacht):** `brandenburg-forst.de` (WMS/WFS-Capabilities 200), `api.open-meteo.com`, `data.geobasis-bb.de`, `api.gbif.org`, `tile.openstreetmap.org` erreichbar. Open-Meteo kann mit 429 antworten (gemeinsame Adresse), dann langsamer abrufen.
- **Bodenwerte landesweit – Stand der Prüfung:**
  - WFS des LFB hat keine Feature-Typen (Capabilities leer) und liefert daher keine Attribute.
  - Die GetFeatureInfo-Abfrage (`nfgr1`, `nfgr2`, `wb` … je Fläche) bleibt der sichere Weg: 228.000 Abfragen bei 1/s dauern ca. 63 Stunden, also rund 11 GitHub-Actions-Läufe zu je 6 Stunden. Das braucht ein Etappen-Verfahren (Start-Index, Wiederaufnahme).
  - Versuch Farbdekodierung: GetMap mit Stil `kolorit` und Legende (Klassen nach `nfgr1`, z. B. K2, M2, Z2). Test gegen die 600 bekannten Antworten im 10-km-Ausschnitt Joachimsthal: 344 richtig, 66 falsch, 190 Farbe nicht erkannt. Zu ungenau, um die Abfrage zu ersetzen; als grobe Vorstufe denkbar.
  - Versuch Sammelabfrage mit großem Toleranzradius (`FI_POLYGON_TOLERANCE`): lieferte 0 Treffer, auch an einem bekannten Punkt. Nach zwei gescheiterten Versuchen (Regel 10) nicht weiter verfolgt.
- **Entscheidung nötig (Nutzer):** Etappen-Abfrage über Actions (ca. 63 h Laufzeit insgesamt) starten, oder Bodenwerte vorerst weglassen und die landesweite Heatmap nur aus Baumart und Mischung berechnen.
