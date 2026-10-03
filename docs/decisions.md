# Entscheidungen

Größere Entscheidungen mit Kontext, Entscheidung und verworfener Alternative.

## 2026-10-03 — Rohdaten im GitHub-Release statt im Git

- **Kontext:** Die Rohdaten sind 130–550 MB groß. Git erlaubt maximal 100 MB
  pro Datei, der Web-Upload 25 MB. Die Arbeitsumgebung von Claude erreicht
  die Originalserver (DLR, LFB) nicht, GitHub aber schon.
- **Entscheidung:** Rohdaten liegen als Assets im Release `daten-v1`
  (bis 2 GB pro Datei). Ins Git kommen nur abgeleitete, kleine Dateien.
- **Verworfen:** Git LFS — begrenztes Freikontingent, zusätzliche Einrichtung.

## 2026-10-03 — Vorberechnete Heatmap statt Live-Abfrage

- **Kontext:** Die Habitat-Eignung soll flächig sichtbar sein wie bei
  bestehenden Pilzkarten-Diensten.
- **Entscheidung:** Habitat-Raster wird offline in `pipeline/` aus
  Baumarten + Standortskarte + Waldflächen berechnet. Nur das Wetter
  (Wachstumsindex) wird live im Browser abgerufen.
- **Verworfen:** Punktweise Abfrage von Kartendiensten im Browser — keine
  flächige Darstellung, abhängig von fremden Servern im Wald.

## 2026-10-03 — Zwei Sprachen: Python offline, TypeScript im Browser

- **Kontext:** Geodaten-Verarbeitung (Raster, GML, Umprojektion) ist in
  Python ausgereift; die Webseite läuft im Browser.
- **Entscheidung:** `pipeline/` in Python, `web/` in TypeScript.
- **Verworfen:** Alles in JavaScript — Geodaten-Werkzeuge dort deutlich
  schwächer.

## 2026-10-03 — Habitat-Regeln Version 1 und Umgang mit nfgr4

- **Kontext:** Bodenwerte kommen per GetFeatureInfo vom LFB (`nfgr1..nfgr4`, Anteile `az1..az3`).
  `nfgr4` hat kein Anteilsfeld; `az1..az3` ergeben ohne ihn immer 10/10.
- **Entscheidung:** Bewertet werden nur `nfgr1..nfgr3`. Habitat = Baumart-Punkte × Boden-Punkte
  (gut 1,0 / mittel 0,6 / gering 0,3 / ungeeignet 0), Nassstandorte (N, O, Ü) = 0,
  Feuchte 3 (nicht in der Legende, vermutlich trocken) = 0,6.
- **Befund:** Zu wenig Trennschärfe – 60–80 % des Waldes erreichen Stufe 90–100, weil Kiefer
  und die häufigsten Böden (Z2, M2) beide als „gut“ gelten. Version 2 braucht weitere Merkmale.
- **Verworfen:** `nfgr4` als vierten Anteil zu zählen – widerspricht der Anteilssumme.
