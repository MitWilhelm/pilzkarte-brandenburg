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

## 2026-10-05 — Straßen, Umrisse, Höhendaten verworfen, Fokus Barnim

- **Kontext:** Wegrand-Aufschlag, Brennpunkt-Anzeige und Höhendaten (Kronenhöhe, Hang) waren offen.
- **Entscheidungen:**
  - OSM-Wege in drei Arten: Straße für Autos (gelb), Forstweg (weiß), Pfad (gestrichelt). Der Wegrand-Aufschlag
    (15 %, ~25 m) gilt nur noch an Forstwegen und Pfaden: Die Belege (dünnere Streu, mehr Licht) betreffen
    Waldwege, an Autostraßen kommen Stickstoff, Salz und Staub hinzu. Wirkung: 8 % des Waldes in Joachimsthal ändern
    sich um im Mittel 3,5 Stufen; an den Fundstellen praktisch nichts.
  - Brennpunkte als Umriss der 100-m-Zellen in Signalfarben (Türkis heute, Pink letzte 7 Tage) statt Ring im
    Schwerpunkt. Grund: Bei verwinkelten Flächen lag der Ring neben der Fläche (Fund bei 52.9956/13.7105: 96-ha-Fläche,
    Ring 750 m entfernt). Dazu ein Knopf „Nur Brennpunkte“ (Rest der Karte grau).
  - Hang/Nordlage wird nicht verwendet (Brandenburg flach, Nutzer: „Hang weglassen“). `hangfaktor` und
    `strukturfaktor` bleiben in `pipeline/habitat.py` mit Tests, werden aber von `io_heatmap.py` nicht aufgerufen.
  - Fokus bis auf Weiteres: Landkreis Barnim, nicht ganz Brandenburg. Die Webseite heißt „Pilzkarte Barnim“.
- **Höhendaten (LGB bDOM/DGM):** Der Server liefert nur ~30–80 KB/s (auch beim Nutzer zu Hause: 39 MB in 8 min), die
  Verbindung riss nach 9 von 128 Kacheln ab. Alle bDOM-Kacheln wären 17–47 h. Verworfen für jetzt.
- **Freie Kronenhöhenkarten:** ETH-Weltkarte 2020 (10 m) taugt nicht: in beiden Testgebieten 21–29 m für fast alle
  Waldpixel, auch auf Kahlschlägen. Meta/WRI (1 m, CC-BY-4.0) streut plausibel (Kiefer Median 17–18 m, P10 10–11 m),
  ist aber nicht gegen LGB-Messwerte geprüft. An den Fundstellen (15 m, gleichmäßiges Dach) trennt sie nicht.
- **Funde und Modell:** 6 Steinpilz-Funde (4 Joachimsthal, 2 GBIF Schwärzesee) liegen im Mittel bei Rang 62 % im Gebiet;
  alle 4 in Joachimsthal in Stufe 85 oder höher (Rang 64–85 %). Schwärzesee: GBIF 2025 Stufe 84 (Rang 57 %), GBIF 2024
  Stufe 64 (Rang 5 %). Ein erster Wert für den Fund vom 04.10. (53.00103/13.71483, Stufe 67) beruhte auf einer falschen
  Koordinate; der Nutzer hat sie korrigiert (52°59'46.4"N 13°42'37.9"E = 52.99622/13.71053, Stufe 85). Das wurde zunächst
  fälschlich als zweiter Fund gezählt. Reine Kiefernflächen auf Z2 trennt das Modell trotzdem schwach; Unterstand
  (Buche/Eiche unter Kiefer) ist von keiner Karte sichtbar.
- **Verworfen:** Mischungsabzug abschwächen (0,8 oder 1,0): flacht die Karte ab (bei 1,0 gibt es keine Fläche ab Stufe 85
  mehr); der Anlass (Stufe 67 an einer falschen Koordinate) entfiel.

## 2026-10-05 — Meldungen (Funde und Fehlanzeigen) per GitHub-Issue

- **Kontext:** Das Modell trennt reine Kiefernflächen schwach (6 Funde, mittlerer Rang 62 %). Gute Daten kommen nur aus
  der Praxis: Funde, Fehlanzeigen und Waldbeschreibung (Kronendach, Unterstand, Alter, Dichte) mit genauer Stelle.
  Ein Fund hatte zunächst eine falsche Koordinate; deshalb prüft die Seite die GPS-Genauigkeit.
- **Entscheidung:** Der Knopf „Fund oder Nichts gefunden melden“ ist nur mit GPS-Standort bedienbar (Genauigkeit
  höchstens ±30 m, Standort nicht älter als 60 s). Das Formular fragt Ergebnis, Pilzart, Größe (nur bei Fund),
  Kronendach, Unterstand, Bestandsalter, Dichte, Notiz. Die Meldung wird sofort im Handy gespeichert (localStorage, je
  Meldung ein Schlüssel; geht ohne Netz) und zusätzlich mit dem Modellstand an der Stelle (Habitat-Stufe, Lage zu den
  Umrissen, Wachstumsindex am Tag). „Senden“ öffnet ein vorausgefülltes GitHub-Issue (Label `meldung`, Rohdaten als
  JSON im Text); der Nutzer bestätigt dort nur. Issues sind öffentlich, das ist mit dem Nutzer abgestimmt.
- **Warum Fehlanzeigen:** Nur mit „hier gesucht, nichts gefunden“ lässt sich prüfen, wo das Modell zu optimistisch
  ist (Hotspot-Umriss ohne Fund), nicht nur, wo es Funde trifft.
- **Verworfen:** Externer Formulardienst (neue Abhängigkeit, Daten bei Dritten); Schreib-Token in der Seite (Secret im
  Browser); nur Export als Datei (mehr Handarbeit, nichts im Wald prüfbar).
- **Grenzen:** „Issue geöffnet“ heißt nicht „abgeschickt“ (GitHub meldet nichts zurück). Die Auswertung der Issues
  (Abgleich mit der Heatmap) ist noch nicht gebaut.

## 2026-10-05 — Kronenhöhe: freie Karten gegen LGB-Messwerte geprüft, verworfen

- **Kontext:** Drei LGB-Kachelpaare (bDOM 0,2 m, DGM 1 m) wurden vom Nutzer heruntergeladen und im Release `daten-v1`
  abgelegt (33413-5872, 33413-5873, 33412-5867; 29.800 Waldzellen à 10 m). Kronenhöhe = bDOM (auf 1 m gemittelt) − DGM,
  je 10-m-Zelle das obere Quartil. Vergleich mit den freien Karten auf derselben Fläche.
- **Ergebnis:**
  - Meta/WRI (1 m): Korrelation r = 0,33, Bias −6,3 m, RMSE 9,9 m. Die Karte staucht: Zellen mit LGB 0–5 m liegen
    bei Meta im Median bei 13 m, solche mit 25–40 m bei 16 m. Kahlschlag und Altbestand sind kaum zu trennen.
  - ETH (10 m, 2020): r = 0,12, Bias +4,8 m; fast alle Zellen 22–29 m, unabhängig von der LGB-Höhe.
  - Beide sind für ein Habitat-Modell nach Bestandesalter **nicht brauchbar**.
- **Funde gegen LGB (nur Hinweis, 4 Funde in einer Kachel, räumlich nicht unabhängig):** Die vier Funde in Joachimsthal
  stehen in hohem Bestand (P75-Kronenhöhe 25–27 m, Rang 61–84 % im Gebiet) mit überdurchschnittlich ungleichmäßigem
  Kronendach (Streuung der Höhe Rang 58–95 %, Lücken bis 0 m im 50-m-Fenster). Die ursprüngliche, falsche Koordinate
  des Fundes vom 04.10. lag dagegen in einem gleichmäßigen, geschlossenen Dach (Streuung Rang 18 %, Schluss 100 %), das
  nicht zu „Kiefer/Buche“ passte; die korrigierte Koordinate passt (P75 27 m, Streuung Rang 58 %). Ungleichmäßigkeit
  kann auch nur Wegnähe widerspiegeln.
- **Entscheidung:** Das Modell bleibt unverändert (Nutzer: „Verändere erstmal nichts“). Eine Kronenhöhen-Ebene gäbe es
  nur aus LGB-bDOM; für den Landkreis Barnim (~1.480 km²) wären das ~1.500 Kacheln à 38 MB (~56 GB), bei ~80 KB/s nicht
  vertretbar. Besser: die Meldungen (Waldbeschreibung, Fehlanzeigen) sammeln und daran die Hotspots prüfen.

## 2026-10-05 — Barnim-Zuschnitt: Baumarten-Raster in EPSG:25833

- **Kontext:** Für die Barnim-Karte (Plan in `docs/stand.md`) werden Baumarten und Standortflächen auf den Landkreis
  geschnitten. Die Testgebiete behalten das DLR-Raster in EPSG:3035; Grenze, Standortflächen und die geplanten
  10-km-Kacheln liegen aber in EPSG:25833.
- **Entscheidung:** `pipeline/io_barnim_zuschnitt.py` projiziert das DLR-Raster einmal mit nächstem Nachbarn (Codes,
  keine Mittelwerte) auf ein 10-m-Raster in EPSG:25833, an vollen 10 m ausgerichtet; außerhalb der Kreisgrenze 999.
  Standortflächen zählen wie in `io_barnim_punkte.py`, wenn ihr Innenpunkt im Kreis liegt; ihre ID (`barnim-N`) kommt
  über `localId` aus `daten/barnim_stok_punkte.csv`, nicht aus der Reihenfolge.
- **Prüfung:** 70.758 ha Wald (55 % Kiefer), 21.763 Flächen (alle IDs zugeordnet). 5.000 Zufallspixel gegen das
  DLR-Original: 99,74 % gleich (Rest: Mittelpunkte auf Zellgrenzen). Dateien 2,0 MB (Raster) und 16,6 MB (Flächen),
  beide unter 25 MB und damit im Git.
- **Verworfen:** Raster in EPSG:3035 lassen – dann müssten Kacheln, Grenze und Flächen bei jedem Schritt umgerechnet
  werden, und 10-km-Kacheln in 25833 schnitten das 3035-Raster schief.

## 2026-10-05 — Barnim-Heatmap: eine Rangfolge für den Kreis, Datenfehler der Standortskarte

- **Kontext:** Schritt 4 des Plans Barnim-Karte (`python -m pipeline.io_heatmap barnim`). Die LFB-Antworten für den
  ganzen Kreis enthalten Fälle, die in den Testgebieten nicht vorkamen.
- **Entscheidungen:**
  - Stufen 50–100 nach mittlerem Rang über **ganz Barnim** (vom Nutzer so festgelegt), nicht je Kachel.
  - Standort-Endung **v** (z. B. `K2v`, 0,35 % der Anteile) wird gelesen wie g und w, aber nicht bewertet. Die
    Bedeutung steht in keiner gefundenen Legende (LfU-Textkarten nennen nur g = schwach grundfrisch, w = wechselfrisch);
    **Annahme**, bei Klärung prüfen.
  - 15 Flächen nennen denselben Code dreifach mit falscher Summe (`M2` 10/10/10, `K2` 4/4/4): als ein Standort mit
    vollem Anteil gelesen. Andere falsche Summen bleiben eine verletzte Invariante.
  - 14 Flächen haben nur Sonderangaben ohne Bodengruppe (z. B. `Sol_bn`, `TrB_sh`): wie Pixel ohne Standortfläche,
    also kein Habitat.
  - Wegstückchen unter ~1 m an der Waldgrenze (nach dem Runden ein Punkt) werden nicht geschrieben.
- **Prüfung:** Laufzeit 12 s, 2,7 GB Arbeitsspeicher, je Pilzart 2 MB. Testgebiete Byte für Byte unverändert. Funde
  f01–f07 (alle im Barnim): Stufe Barnim 91/83/79/88/83/68/99, vorher im Testgebiet 93/85/91/90/84/64/100.
- **Verworfen:** Rang je 10-km-Kachel – Stufen wären an Kachelgrenzen nicht vergleichbar.

## 2026-10-05 — Testgebiete Joachimsthal und Schwärzesee entfernt

- **Kontext:** Beide liegen im Barnim und gehen in der Barnim-Karte auf; die Webseite nutzt nur noch die 10-km-Kacheln.
- **Entscheidung (Nutzer: „lösche das alte Testgebiet“):** Testgebiet-Daten (`daten/joachimsthal_*`, `schwaerzesee_*`,
  `stok_antworten.jsonl`, `stok_punkte.csv`, `web/public/daten/gebiete.json` und die Web-Dateien beider Gebiete) und der
  nur dafür genutzte Code (`io_zuschnitt.py`, `io_stok_punkte.py`, Testgebiet-Teile in `io_heatmap.py`, `io_webdaten.py`,
  `io_waldwege.py`, `gebiete.py`, Workflow `boden-abfrage.yml`) sind entfernt. Die Läufe brauchen keinen Zusatz `barnim`
  mehr. `io_hoehe.py` samt Test und Workflow `hoehendaten.yml` fiel mit weg: Es hing an den Testgebieten und war seit dem
  Verwerfen von Hang und Kronenhöhe ohnehin ungenutzt. Die Sprungliste der Webseite nennt die beiden Orte weiter.
- **Prüfung:** Alle Barnim-Ausgaben nach dem Umbau Byte für Byte gleich (Wege, Heatmap, Kacheln).
- **Verworfen:** Nur die Dateien löschen und den Code stehen lassen – die Testgebiet-Läufe wären ins Leere gelaufen.

## 2026-10-05 — Tageswerte morgens vorberechnet, Top-5-Steinpilz-Tipps auf der Karte

- **Kontext:** Jedes Handy holte das Wetter je Brennpunkt selbst (47 Abrufe für 2 Kacheln, für ganz Barnim mehrere
  hundert je Aufruf; Open-Meteo antwortete zeitweise mit 429/503). Der Nutzer wünscht einen Abruf täglich morgens und
  Tipps für die besten Steinpilz-Plätze als Markierung auf der Karte (keine Rangliste als Text).
- **Entscheidung:**
  - Der Workflow `pages.yml` läuft zusätzlich täglich um 04:00 UTC. `web/scripts/tageswerte.ts` sucht in allen
    25 Kacheln die Brennpunkte (dieselbe Funktion `findeHotspots` wie im Browser), holt je ~2-km-Rasterzelle einmal das
    Wetter (heute 346 Abrufe, 16 s) und schreibt `daten/barnim/tageswerte.json` (nur ins Pages-Artefakt, kein Commit).
    Die Seite liest diese Datei; live bleiben nur Index oben und angetippte Stelle. Fehlt die Datei, bewertet die Seite
    wie bisher live.
  - Top 5 (`topSammelplaetze`): zuerst türkis (wächst heute), dann pink; innerhalb davon größte zusammenhängende Fläche,
    bei Gleichstand höherer Index. Tipps näher als 3 km an einem besseren gelten als derselbe Ort (große Flächen werden an
    Kachelgrenzen geteilt). Markierung: Steinpilz im weißen Kreis mit Nummer; Antippen zeigt Größe, Wachstum, Index, Stand.
  - Neue Entwicklungs-Abhängigkeit `pngjs` (7.0.0, keine weiteren Abhängigkeiten, 650 KB entpackt), nur für das Lesen der
    Kachel-PNGs im Vorberechnungs-Lauf, nicht in der Webseite.
- **Grenzen:** Wetter bis zu einem Tag alt. Pfifferling-Tipps gibt es nicht (Wunsch: Steinpilz).
- **Nachtrag (Nutzer: Tipps höchstens 10 ha):** Die Auswahl der 5 Brennpunkte bleibt (Farbe, Größe); die Markierung zeigt
  aber auf deren besten Kern: das 3 × 3-Zellen-Quadrat (9 ha) ganz innerhalb der Fläche mit der höchsten mittleren
  Habitat-Stufe (`besterKern`), bei zu schmalen Flächen die beste Einzelzelle (1 ha). Der Kern wird als türkiser Rahmen
  gezeichnet. Dabei behoben: `position: relative` an der Markierung überschrieb MapLibres absolute Lage, die Tipps 2–5
  standen dadurch versetzt.
- **Verworfen:** Brennpunkt-Suche zusätzlich in Python – zwei Fassungen derselben Regel könnten auseinanderlaufen.

## 2026-10-05 — Bestandshöhe aus dem LGB-nDOM im Habitat-Modell (nur Abwertung)

- **Kontext:** Der Nutzer wollte die Höhenprüfung für ganz Barnim und die Wirkung auf Bewertung und Tipps. Frühere
  Entscheidung (Kronenhöhe verworfen) beruhte auf unbrauchbaren freien Karten und einem LGB-Server mit 30–80 KB/s.
  Am 05.10. lieferte derselbe Server 10 MB/s: Alle 1.498 Kacheln mit Wald (~22 GB) in ~46 min.
- **Recherche-Lage:** Ein Altersoptimum für Steinpilz ist **nicht belegt**. Nordspanien, Waldkiefer: Fruktifikation in
  allen Altersklassen; belegt ist nur ein Dichteoptimum (Grundfläche 30–40 m²/ha). Die Recherche-Notiz empfiehlt nur,
  sehr junge, niedrige Bestände abzuwerten. Der ältere, unbenutzte `strukturfaktor` in `habitat.py` (Optimum bei 19–22 m,
  Abwertung ab 25 m, Verweis auf „Gipfel 51–70 Jahre“) beruht auf einer unverifizierten Angabe und wird nicht genutzt.
- **Entscheidung (Nutzer):** Nur junge/niedrige Bestände und Kahlschläge abwerten, kein Alters-Bonus.
  - `pipeline/io_ndom.py` lädt jede Kachel, `pipeline/hoehe.py` rechnet je 10-m-Pixel die **Oberhöhe**: oberstes
    Prozent der 1-m-Zellmittel in einem 51 × 51 m-Fenster. Ergebnis `daten/barnim_oberhoehe.tif` (4,5 MB, Median 28 m).
  - `hoehenfaktor` in `habitat.py`: bis 3 m 0 (kein Habitat), linear bis 10 m auf 1, darüber 1. Beide Grenzen sind
    **Annahmen**. Pixel ohne Daten sind neutral (kommt in Barnim nicht vor: 0 von 7,08 Mio. Waldpixeln).
- **Messfehler gefunden und behoben:** Mit dem oberen Zehntel galten 11,9 % der Buchen- und 4,3 % der Eichenpixel
  als offen, aber nur 0,1 % der Kiefern (Winterbefliegung ohne Laub: dünnes Kronendach). Mit dem obersten Prozent sind es
  4,2 % / 0,8 % / 0,0 %. Zwei Rohdaten-Stichproben (größte entfernte 100-m-Blöcke): über 99,6 % der Punkte unter 1 m,
  dort steht kein Wald (Rodung oder Lichtung; OSM führt die Stellen noch als Wald).
- **Wirkung:** 605 ha (1,1 %) Steinpilz-Habitat entfallen, 86 ha werden teilweise abgewertet. Fast alles Buche (408 ha)
  und Eiche (185 ha). Alle 7 Steinpilz-Funde mit Standort behalten ihre Stufe (Oberhöhe 25–33 m). Pfifferling: 578 ha.
- **Grenzen:** Die Höhe trennt gute von schlechten Beständen nicht (Median 28 m). Fund f08 (3 alte Steinpilze, lückiger
  Altbestand mit viel Laub) liegt wie die Tipps 1 und 3 in hohem, lückigem Bestand. Dichte (Lückigkeit) wird nicht
  bewertet, dafür gibt es zu wenige Belege. Die nDOM-Daten sind neuer als die DLR-Baumartenkarte (2022).
- **Verworfen:** Oberes Zehntel (siehe Messfehler); Alters-Bonus (nicht belegt); Lückigkeit als Abschlag (Annahme, würde
  f08 und Tipps abwerten).

## 2026-10-08 — Standort-Hinweis als Banner, fester Melden-Knopf, Fassungsstempel

- **Kontext:** Der Nutzer meldete mehrfach: „GPS-Knopf: gar nichts“ und „Fund melden funktioniert nicht“ (Opera, Android).
  Im Testbrowser lief die Logik fehlerfrei. Ursache im Code: Die Tafel blendet bei gewählter Stelle (`data-auswahl`)
  alles außer der Vorschau aus, auch den Standort-Hinweis; „Fund melden“ ist bei eingeklappter Tafel oder gewählter
  Stelle ebenfalls ausgeblendet. Wer vorher eine Stelle antippte, sah beim GPS-Knopf also keine Reaktion und fand den
  Melden-Knopf nicht.
- **Entscheidung:** Der Hinweis ist ein eigenes Banner oben auf der Karte (mit Schließen-Knopf), unabhängig von der Tafel.
  Neuer fester Kartenknopf „Melden“ (Stecknadel mit Plus): öffnet das Melden, wenn der Standort ≤ 30 m genau ist; ohne
  Ortung startet er die Ortung, bei zu ungenauem Standort nennt er die Lage. Die Legende nennt die Fassung der Seite
  (Zeitpunkt des Builds, `__BUILD_ZEIT__` aus esbuild `define`), damit Meldungen einer Fassung zuzuordnen sind.
- **Offen:** Ob der Standort auf dem Handy des Nutzers (Opera, Android) damit funktioniert, ist nicht bestätigt.
  Der GPS-Knopf holt zuerst eine grobe Netz-Position und startet dann das genaue GPS; Fehler nennen Code, Meldung und
  Erlaubnis-Status.
