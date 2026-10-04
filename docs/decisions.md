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

## 2026-10-04 — Modell nach Volltext-Studien: Wegränder, Temperaturkurve, Wetter je Ring

- **Kontext:** Recherche-Bericht und 13 vom Nutzer bereitgestellte Volltexte (u. a. Martínez-Peña 2012 FEM und
  Mycorrhiza, Parladé 2017, Tahvanainen 2016, Karavani 2018, Ágreda 2015, Bonet 2010, de-Miguel 2014,
  van Strien 2018, Brejon Lamartinière & Hoffman 2025 Preprint).
- **Entscheidungen:**
  - Habitat: Steinpilz auf armen Böden (A) jetzt „gut“ wie Z und M – Ertrag stieg mit Sand, Säure, C/N
    (Martínez-Peña 2012 FEM). Kahlschlag (DLR „Kronenverlust“) bleibt 0 (Parladé 2017: Myzel bricht ein).
  - Habitat: Aufschlag 15 % bis ~20–25 m neben OSM-Wegen und -Pfaden (dünnere Streu, mehr Licht;
    van Strien 2018 fand mehr Mykorrhiza-Pilze an Wegrändern). Bewusst klein, da indirekt belegt.
  - Index: Die Bodentemperatur-Schwellen (10–18 °C in 6 cm, ohne Beleg) sind ersetzt durch einen Faktor der
    Lufttemperatur im 5-Tage-Mittel: 1 bei 11–15,5 °C, stufenlos bis 0,2 bei 5 bzw. 21 °C (Optimum 13,2 °C und
    Funde meist 7–19 °C laut Bielefeld-Preprint; kühle Fruchtmonate günstig laut Tahvanainen 2016).
  - Ringe: Index je Ring aus dem Wetter an dieser Stelle (Raster ~2 km), nicht mehr aus der Gebietsmitte.
  - Unverändert, aber als Annahme gekennzeichnet: „voll ab 20 mm wirksamem Regen“ (R20-Klimaindex bei
    Salerni 2023, keine biologische Schwelle). Regen bleibt Hauptsignal (Karavani 2018: Regen-Modell besser
    als Bodenfeuchte-Modell); Regen in der Fruchtsaison zählt (Parladé 2017).
- **Vergleich alt/neu (sehr kleine Stichprobe, nur als Hinweis):**
  - Habitat: 4 Steinpilz-Fundorte mit genauen Koordinaten (2 Nutzer, 2 GBIF/iNaturalist) gegen 78 andere
    Pilzfunde derselben Gebiete (Target-Group-Background nach Phillips et al. 2009). Mittleres Perzentil der
    Fundorte im Gebiet 41 → 55; AUC 0,73 → 0,74. Der Pfifferling-Fundort (1 Punkt) lag alt wie neu bei Stufe 100.
  - Index: 8 Funddaten (6 GBIF 2024/2025, 2 Nutzer 2026 mit geschätztem Datum) mit historischem Wetter
    (Open-Meteo Historical Forecast, über GitHub Actions). Mittleres Perzentil des Funddatums unter allen
    Saisontagen 74 → 79; 6 von 8 Funden an Tagen über dem 70. Perzentil.
- **Nicht umgesetzt (fehlende Daten):** Bestandesalter/Grundfläche (Optimumkurve in 6 Studien belegt; braucht
  Kronenhöhe aus LGB-nDOM), Exposition (braucht Geländemodell), Stickstoff-Abschlag (UBA-Daten nur auf Anfrage),
  Buchenmast-Abschlag (Mastjahr-Daten).
