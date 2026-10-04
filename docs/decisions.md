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

## 2026-10-03 — Habitat Version 2: Mischfaktor und relative Stufen

- **Kontext:** Version 1 stufte 60–80 % des Waldes in 90–100 ein (siehe oben).
- **Entscheidung:**
  - Mischfaktor: Anteil *anderer* Wirtsbaumarten im 70 × 70 m-Fenster; ab 25 % voll gemischt.
    Gesamtwert = Baum × Boden × (0,6 + 0,4 × Mischfaktor) – ein Reinbestand behält 60 %.
  - Anzeige-Stufe 50–100 nach **mittlerem Rang** im Gebiet; gleiche Werte bekommen den
    Mittelrang ihres Blocks, damit große gleichartige Reinbestände nicht geschlossen oben landen.
  - Fenstersumme über ein Integralbild in numpy statt scipy (keine neue Abhängigkeit).
- **Grenze:** 59–66 % der Waldpixel sind reiner Kiefernbestand auf gleichem Boden und damit
  wertgleich; innerhalb davon trennt erst ein weiteres Merkmal (z. B. Bestandshöhe/-alter).
  Einzelne Laubbaum-Pixel erzeugen sichtbare quadratische Höfe (eckiges Fenster).
- **Verworfen:** Rang mit oberem Blockrang – setzte große gleiche Blöcke zu optimistisch in 90–100.

## 2026-10-04 — Regen-Auslöser: 10 mm auf guten Standorten (statt 6 mm)

- **Kontext:** Ursprünglich 12 mm in 3 Tagen (eigene Annahme ohne Quelle). Am 03.10. auf Angabe
  des Nutzers 6 mm für Standorte ab Habitat-Stufe 80, damit ein Fund nach nur 6,3 mm Regen erklärbar
  wird. Der Nutzer möchte weniger Fehlalarme; Recherche am 04.10.
- **Quellen:**
  - Salerni, Paoli, Perini (2023), Italian Journal of Mycology: Steinpilz in Weißtannen-Beständen,
    sehr starke Regen (≥ 20 mm) mit positivem Effekt, besonders am 12. Tag danach.
  - Brejon Lamartinière & Hoffman, Preprint bioRxiv (Dez. 2025, nicht begutachtet), 10 Jahre
    Monitoring (1.905 Fruchtkörper) im Buchenwald bei Bielefeld, Fenster: Mittel der 5 Tage vor
    jedem Fund. Ergebnisse: die meisten Funde bei 0–7 mm Tagesmittel (Dichte-Maximum unter 3 mm
    und um 15 °C); kein klarer Zusammenhang zwischen Regen und Fundwahrscheinlichkeit; unter
    17,5 °C oft Fruchtkörper auch ganz ohne Regen; keine Funde nur bei über 17,5 °C und unter
    1 mm/Tag. Modell: Anzahl steigt linear mit dem Regen (5-Tage-Mittel), Temperatur-Optimum
    13,2 °C. Bodenfeuchte kann dem Regen bis zu einem Monat nachlaufen (zitiert: Karavani 2018).
    Korrektur: Eine frühere Zusammenfassung von mir nannte hier „26 Tage“ und „20-Tage-Mittel“,
    beides stammte aus einem fehlerhaften Suchergebnis und steht so nicht in der Studie.
  - Praxis-Faustregeln (Presse/Pilzsachverständige): 40–50 l/m² durchfeuchten den Boden,
    Fruchtkörper ~14 Tage später.
- **Entscheidung:** Auslöser auf Standorten ab Stufe 80: 10 mm in 3 Tagen; sonst weiter 12 mm.
  Kein Beleg für 6 mm; die Quellen sprechen eher für mehr Regen als Auslöser.
- **Folge:** Mit dem Wetter vom 13.09.–04.10. (höchstens 6,6 mm in 3 Tagen) gibt es keinen
  Auslöser mehr; der Index fällt bei Joachimsthal auf ~20, obwohl der Nutzer dort Steinpilze fand.
- **Grenze der Entscheidung:** Die Bielefeld-Daten sprechen gegen einen harten Regen-Auslöser
  überhaupt: Fruchtkörper erscheinen auch ohne Regen, wenn Temperatur und Bodenfeuchte passen;
  Regen erhöht vor allem die Menge. Ein harter Auslöser erzeugt daher eher übersehene Funde als
  weniger Fehlalarme. Gegen Fehlalarme hilft laut Studie eher die Temperatur (über 17,5 °C und
  trocken: keine Funde).
- **Verworfen:** 20 mm (Salerni) – Studie in Weißtanne/Italien, in Brandenburgs Kiefernsand selten
  erreicht. Offen für einen eigenen Schritt: Regenfaktor stufenlos statt harter Schwelle.

## 2026-10-04 — Regenfaktor stufenlos statt harter Auslöser

- **Kontext:** Die Bielefeld-Studie (siehe Eintrag davor) fand Steinpilze oft auch ohne Regen,
  solange es nicht warm und trocken war; Regen erhöht vor allem die Menge. Harte Auslöser (6/10/12 mm)
  übersahen die Funde des Nutzers bei Joachimsthal (Ende September, kaum Regen).
- **Entscheidung (vom Nutzer so gewünscht):**
  - Wirksamer Regen = Regen der letzten bis zu 21 (Steinpilz) bzw. 26 Tage (Pfifferling), je Tag
    gewichtet nach Abstand: 0,35 in den ersten Tagen, 1,0 nach 1–2 Wochen, 0,6 beim Abklingen.
  - Regenfaktor = Grundwert + (1 − Grundwert) × min(1, wirksamer Regen / 20 mm).
    Grundwert 0,2; bei feuchtem Boden und 10–17 °C (5-Tage-Mittel der Luft) bis 0,5
    („mittlerer Index“ ohne Regen). Die Feuchte geht stufenlos ein (6–14 Vol.-%).
  - Neuer Faktor: über 17,5 °C und unter 1 mm/Tag (beides 5-Tage-Mittel) × 0,2.
  - Dafür wird zusätzlich das Tagesmittel der Lufttemperatur bei Open-Meteo abgefragt.
  - Habitat-Stufe beeinflusst den Wachstumsindex nicht mehr (die 6/10-mm-Regel für Stufe ab 80 entfällt).
- **Ergebnis mit echtem Wetter (Joachimsthal):** 24.09.–04.10. Index 70–76 („Günstig“), danach bis
  10.10. Prognose 55–67. Ohne jeden Regen läge der Index bei feuchtem Boden höchstens bei 50,
  also unter der Ring-Schwelle 60.
- **Verworfen:** feste mm-Schwelle mit Bodenbedingung – erzeugt Sprünge und übersehene Funde.
