# Offene Datenquellen zur Verbesserung des Habitat- und Fruktifikationsmodells (Steinpilz / Pfifferling, Brandenburg)

Stand der Recherche: 2026-10-04. Live-Tests mit `curl` aus der Projekt-Sandbox (über Proxy). Wo ein Wert aus einem eigenen API-Abruf stammt, ist das als "Live-Test" markiert und die Abfrage-URL ist angegeben.

## 1. Fundpunkt-Daten (GBIF, iNaturalist, Pilzkartierung, Observation.org) und ihre Nutzung in SDM-Studien

### Takeaway
GBIF hat aktuell nur **290 Steinpilz- und 128 Pfifferling-Fundpunkte in Brandenburg** (Live-Test). Die meisten stammen aus iNaturalist (2022–2026) und haben überwiegend eine Unsicherheit ≤ 100 m. Das reicht für eine grobe Validierung oder einen Presence-only-Plausibilitätscheck, aber nicht für ein robustes eigenes SDM nur für Brandenburg. Mit den deutschlandweiten Daten (5.123 bzw. 2.345 Punkte) und einer Korrektur des Sammel-Bias (Target-Group-Background) wird es tragfähiger.

### Cited Findings
**GBIF (Live-Test, 2026-10-04)**
- Taxon-Keys aus dem Species-Match: Boletus edulis Bull. = `5954958`, Cantharellus cibarius Fr. = `5249504` (EXACT match) — [GBIF species/match API](https://api.gbif.org/v1/species/match?name=Boletus%20edulis)
- Treffer für Boletus edulis: Deutschland (`country=DE`) **5.123**, Brandenburg (`gadmGid=DEU.4_1`) **290**, davon mit Koordinate und ohne Geo-Issue 290, ab dem Jahr 2000 **260** — [GBIF occurrence search](https://api.gbif.org/v1/occurrence/search?taxonKey=5954958&gadmGid=DEU.4_1&limit=0)
- Treffer für Cantharellus cibarius: Deutschland **2.345**, Brandenburg **128**, ab 2000 **125** — [GBIF occurrence search](https://api.gbif.org/v1/occurrence/search?taxonKey=5249504&gadmGid=DEU.4_1&limit=0)
- Herkunft der Steinpilz-Punkte in Brandenburg (Facette `datasetKey`): iNaturalist Research-grade 186, NABU|naturgucker 45, Observation.org 26, "General soil fungi from 150 German grassland and 150 German forest plots (Illumina MiSeq)" 19 (eDNA, Biodiversitäts-Exploratorien), Rest ≤ 5 — [GBIF facet query](https://api.gbif.org/v1/occurrence/search?taxonKey=5954958&gadmGid=DEU.4_1&limit=0&facet=datasetKey)
- Herkunft der Pfifferling-Punkte in Brandenburg: iNaturalist 73, naturgucker 46, Observation.org 6, Rest 1 — gleiche Abfrage mit taxonKey 5249504
- Jahresverteilung Steinpilz Brandenburg: 2024 = 63, 2025 = 62, 2023 = 45, 2022 = 28, 2026 = 22, 2010 = 12, alle übrigen Jahre ≤ 8. Die Daten sind also stark auf die Jahre seit 2022 konzentriert (iNaturalist-Boom).
- Monatsverteilung Steinpilz Brandenburg: Okt 103, Sep 87, Aug 39, Nov 20, Jul 12, Jun 1, Jan 1. Daraus lässt sich die Saisonalität direkt plausibilisieren.
- Nachweisart Steinpilz: 260 HUMAN_OBSERVATION, 27 MATERIAL_SAMPLE (eDNA), 3 PRESERVED_SPECIMEN
- Lizenzen (Steinpilz BB): 191 × CC BY-NC 4.0, 95 × CC BY 4.0, 4 × CC0. Für ein privates, nicht-kommerzielles Projekt passt das; die Namensnennung ist trotzdem Pflicht. Observation.org-Daten stehen unter CC BY-NC 4.0, naturgucker-Daten unter CC BY 4.0 — [GBIF dataset API](https://api.gbif.org/v1/dataset/6ac3f774-d9fb-4796-b3e9-92bf6c81c084)
- Koordinatenunsicherheit (alle 290 Steinpilz-Datensätze): 158 mit ≤ 100 m, 13 mit > 1.000 m, 59 ohne Angabe (Live-Test über `limit=300`)
- Der GBIF-Datensatz "iNaturalist Research-grade Observations" hat die DOI 10.15468/ab3s5x — [GBIF dataset](https://api.gbif.org/v1/dataset/50c9509d-22c7-4a22-a47d-8c48425ef4a7)

**iNaturalist (Live-Test)**
- Place-ID Brandenburg = 9190. Taxon-IDs: Boletus edulis 48701, Cantharellus cibarius 47347 — [iNat API places](https://api.inaturalist.org/v1/places/autocomplete?q=Brandenburg)
- Research grade in Brandenburg: Steinpilz **319**, Pfifferling **132**. Einschließlich "needs_id": 346 bzw. 155 — [iNat API](https://api.inaturalist.org/v1/observations?taxon_id=48701&place_id=9190&per_page=0&quality_grade=research)
- iNaturalist hat also mehr Research-grade-Steinpilze (319) als GBIF aus iNaturalist (186). Vermutlicher Grund: GBIF übernimmt nur Beobachtungen mit CC0-, CC BY- oder CC BY-NC-Lizenz (das ist eine Inferenz, siehe unten). Die API ist offen; empfohlen ist etwa 1 Anfrage/s (nicht live geprüft).

**Pilzkartierung Deutschland (DGfM / pilze-deutschland.de)**
- pilze-deutschland.de antwortet (HTTP 200). Die Artseiten zeigen Funde auf Ebene von Messtischblatt-Quadranten (MTB/TK25, z. B. "MTB 7146 – 04.10.2016") — [pilze-deutschland.de](https://www.pilze-deutschland.de). Die URL einer konkreten Artseite (`/organismen/boletus-edulis-bull-1782`) lieferte 404. Ein offener Massen-Download oder eine API war nicht auffindbar.

**SDM-Methodik (Bias-Korrektur)**
- Phillips et al. (2009), *Ecological Applications* 19(1), "Sample selection bias and presence-only distribution models: implications for background and pseudo-absence data", DOI [10.1890/07-2153.1](https://doi.org/10.1890/07-2153.1). Das Grundlagenpapier zum **Target-Group-Background**: Hintergrundpunkte werden aus den Funden verwandter Arten mit demselben Sammel-Bias gezogen.
- Eine Arbeit zu 50 Jahren GBIF-Makropilzdaten aus Norwegen und Schweden (MaxEnt) zeigt: Die Verbreitungsmuster stabilisieren sich erst ab etwa 30 Jahren Sammelaufwand. Sie thematisiert außerdem den räumlichen Bias in Open-Source-Biodiversitätsdaten — [J. Fungi 2022, PMC9504596](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9504596/)
- Ein Preprint zur Bias-Korrektur in SDMs schlägt einen "Relative Overlap Index" vor und betont, dass Filtermethoden Datensätze kosten — [arXiv 2103.07107](https://arxiv.org/pdf/2103.07107)
- Beispiel für ein Speisepilz-SDM: Lactarius deliciosus mit 242 GBIF-Presence-only-Punkten (kuenm/MaxEnt) — [KTU Avesis](https://avesis.ktu.edu.tr/yayin/72855f8c-8fb5-4048-9ddd-f2de4e6b4431/ecological-niche-modeling-of-lactarius-deliciosus-using-kuenm-r-package-insights-into-habitat-preferences)

### Inferences
- Der 19-Punkte-eDNA-Datensatz (Biodiversitäts-Exploratorien) dürfte vom Exploratorium **Schorfheide-Chorin** stammen, dem einzigen Exploratorium in Brandenburg, nahe Joachimsthal. Das wären systematisch beprobte Plots, also wertvoll für das Testgebiet. Achtung: eDNA weist Myzel im Boden nach, nicht Fruchtkörper. Herkunft vor einer Verwendung prüfen.
- Ein Target-Group-Background lässt sich in Brandenburg aus allen GBIF-Pilzfunden (Kingdom Fungi, gleiche Quellen iNat/naturgucker/observation.org) bauen. Das bildet den Bias zu Wegen, Städten und Berlin-Nähe nach.
- Die Häufung nach 2022 bedeutet: Für das Wachstumsindex-Modell taugen die GBIF-Daten höchstens zur groben Validierung von Saisonfenstern (Fund-Datum gegen Wetter). Für Ertragsmodelle taugen sie nicht, weil Nullbeobachtungen fehlen.
- Die Lücke zwischen iNat-API und GBIF ist eine Inferenz: Die GBIF-Lizenzpolitik ist bekannt, wurde für Brandenburg aber nicht einzeln geprüft.

### Gaps
- DGfM-Mykis bzw. die Rohdaten der Pilzkartierung 2000: kein offener Download gefunden. Lizenz und Zugang müssten bei der DGfM angefragt werden. Auflösung nur MTB-Quadrant (etwa 5,5 × 5,5 km) und damit für eine Habitatkarte auf Bestandsebene zu grob.
- Artbeobachtung/ArtenFinder Brandenburg: nicht geprüft.
- Keine peer-reviewten SDM-Studien gefunden, die speziell B. edulis oder C. cibarius in Mitteleuropa mit GBIF-Daten modellieren.

## 2. Bestandesstruktur: Kronenhöhe/nDOM, Kronendichte, Bestandesalter, BWI

### Takeaway
Für Brandenburg gibt es mit dem LGB-**nDOM** (normalisierte LiDAR-Punktwolke, 1-km-Kacheln, dl-de/by-2-0) und dem **bDOM** ausgezeichnete Strukturdaten. Daraus lassen sich Kronenhöhe und Kronenschluss (und als Proxy das Alter) ableiten. Der Aufwand ist allerdings hoch: rund 13 MB pro km² als LAZ. Globale Alternativen sind Lang et al. 2023 (10 m), Meta/WRI 2024 (1 m, CC BY 4.0) und Copernicus HRL TCD (10 m). Peer-reviewt ist die Grundfläche bzw. das Bestandesalter als starker Ertragsfaktor für B. edulis in Kiefernbeständen belegt.

### Cited Findings
**LGB Brandenburg (Live-Test)**
- Das Verzeichnis `https://data.geobasis-bb.de/geobasis/daten/` enthält die Unterordner `als/`, `bdom/`, `dgm/`, `dop/`, `ndom/` und `sentinel2/`. Die Lizenz verweist auf die **Datenlizenz Deutschland – Namensnennung 2.0 (dl-de/by-2-0)**, nicht auf dl-de/zero — [data.geobasis-bb.de](https://data.geobasis-bb.de/geobasis/daten/)
- `ndom/`: **30.520 Dateien** `NDOM_<E>-<N>_LAS12.laz`, also 1 × 1 km-Kacheln (UTM33, EPSG:25833) als normalisierte Punktwolke. Eine Beispielkachel `NDOM_33250-5888_LAS12.laz` ist **13,2 MB** groß (Last-Modified 2024-08-15). Metadaten liegen als `NDOM_meta-gds.gpkg` bei — [ndom-Verzeichnis](https://data.geobasis-bb.de/geobasis/daten/ndom/)
- `bdom/tif/`: Kacheln `bdom_<E>-<N>.zip` (bildbasiertes Oberflächenmodell als GeoTIFF). Die Aktualität ist im PDF `bb_bdom_aktualitaet.pdf` dokumentiert — [bdom](https://data.geobasis-bb.de/geobasis/daten/bdom/)
- `sentinel2/`: Jahresordner 2023 und 2024 mit Cloud-Optimized GeoTIFFs (Link auf cogeo.org) — [sentinel2](https://data.geobasis-bb.de/geobasis/daten/sentinel2/)

**Globale/europäische Kronenhöhe und Kronendichte**
- Lang, Jetz, Schindler, Wegner (2023), "A high-resolution canopy height model of the Earth", *Nature Ecology & Evolution*, DOI [10.1038/s41559-023-02206-6](https://doi.org/10.1038/s41559-023-02206-6). Globale Karte mit 10 m für das Jahr 2020 aus GEDI und Sentinel-2. Der Code steht unter MIT-Lizenz — [GitHub langnico](https://github.com/langnico/global-canopy-height-model); [ETH Research Collection](https://research-collection.ethz.ch/handle/20.500.11850/636572?show=full). (Die Lizenz der Kartendaten selbst habe ich nicht verifiziert; vermutlich CC BY 4.0.)
- Tolan et al. (2024), "Very high resolution canopy height maps from RGB imagery…", *Remote Sensing of Environment*, DOI [10.1016/j.rse.2023.113888](https://doi.org/10.1016/j.rse.2023.113888). Meta/WRI-Karte mit 1 m. Die Bilder stammen aus 2009–2020, zu 80 % aus 2018–2020. **CC BY 4.0**, verfügbar auf AWS (`dataforgood-fb-forests`) und in Google Earth Engine — [Land & Carbon Lab](https://landcarbonlab.org/data/global-tree-canopy-height); [AWS Registry](https://registry.opendata.aws/dataforgood-fb-forestsv2)
- Copernicus HRL Tree Cover Density 2018: 10 m, Kronendeckung 0–100 %, Wiederholung alle 3 Jahre (Referenzjahre 2012, 2015, 2018 mit 20 m für 2012/2015). Dazu Dominant Leaf Type (Laub/Nadel, MMU 0,5 ha) und Forest Type. GeoTIFF in **EPSG:3035** — [EEA Katalog TCD 2018](https://sdi.eea.europa.eu/catalogue/fise/api/records/486f77da-d605-423e-93a9-680760ab6791); [terrabyte Doku](https://docs.terrabyte.lrz.de/datasets/hrl_forest/description/); [CLMS Produktseite](https://land.copernicus.eu/en/products/high-resolution-layer-forests-and-tree-cover?tab=overview). land.copernicus.eu leitet weiter (HTTP 302). Der Download erfordert ein kostenloses EU-Login (nicht live geprüft). Die Lizenz der Copernicus-Daten ist frei, mit Namensnennung (nicht live verifiziert).

**Bestandesalter**
- Besnard et al. (2021), "Mapping global forest age from forest inventories, biomass and climate data", *ESSD* 13, 4881–4896, DOI [10.5194/essd-13-4881-2021](https://doi.org/10.5194/essd-13-4881-2021). 1 km, Stand etwa 2010, Machine Learning auf mehr als 40.000 Plots. Daten unter [doi:10.17871/ForestAgeBGI.2021](https://doi.org/10.17871/ForestAgeBGI.2021) (MPI-BGC Geodb erreichbar, HTTP 200) — [ESSD](https://essd.copernicus.org/articles/13/4881/2021/essd-13-4881-2021.html)
- 1 km ist für eine Pilzkarte auf Bestandsebene grob. Die LFB-Forsteinrichtungsdaten (Bestandesalter je Abteilung) wären besser, sind aber kein Open Data (nicht geprüft).

**Evidenz: Bestandesstruktur ↔ Pilzertrag**
- Martínez-Peña, de-Miguel, Pukkala et al. (2012), "Yield models for ectomycorrhizal mushrooms in Pinus sylvestris forests with special focus on Boletus edulis and Lactarius group deliciosus", *Forest Ecology and Management* 282, 63–69, DOI [10.1016/j.foreco.2012.06.034](https://doi.org/10.1016/j.foreco.2012.06.034). Der Ertrag folgt einer rechtsschiefen Optimumkurve mit Maximum bei einer **Grundfläche von 30–40 m²/ha**. Daneben wirken die Niederschläge — [Oppla Fallstudie](https://oppla.eu/casestudy/20556); [Forest Ecosystems 2019](https://link.springer.com/doi/10.1186/s40663-019-0211-1)
- Ein empirisches Modell für P. sylvestris in Spanien nennt Niederschlag, Temperatur und **Bestandesalter** als stärkste Einflussfaktoren auf die Fruchtkörperbildung (laut Snippet aus Dendrobiology vol. 91 bzw. dort zitierter Literatur) — [Dendrobiology 91](https://www.idpan.poznan.pl/images/stories/dendrobiology/vol91/denbio091002.pdf)
- Collado et al. (2019), "Mushroom productivity trends in relation to tree growth and climate across different European forest biomes", *Science of the Total Environment* 689, 602–615, DOI [10.1016/j.scitotenv.2019.06.471](https://doi.org/10.1016/j.scitotenv.2019.06.471). Die Kopplung zwischen Baumwachstum und Mykorrhizapilz-Ertrag gibt es nur im mediterranen, wasserlimitierten Raum, nicht in temperaten oder borealen Wäldern — [UdL Repositori](https://repositori.udl.cat/items/748181eb-3e9e-40f9-a8dd-99e4fc6f8028)

### Inferences
- Pragmatischer Weg für die Testgebiete: nDOM-LAZ der Testgebiet-Kacheln laden (je Gebiet etwa 20–100 Kacheln, also rund 0,3–1,3 GB), mit PDAL oder laspy rastern (95. Perzentil der Höhe auf 10 m) und daraus Kronenhöhe und Kronenschluss ableiten. Für ganz Brandenburg (rund 30.500 km², etwa 400 GB LAZ) ist Meta 1 m oder HRL TCD 10 m praktikabler.
- Die Kronenhöhe ist ein brauchbarer Proxy für Bestandesalter und Grundfläche. Die Kiefer-Optimum-Grundfläche aus Spanien lässt sich nicht 1:1 übertragen, wohl aber die Form "Optimum statt monoton".

### Gaps
- Eine nDOM-Rasterversion (GeoTIFF) war im LGB-Verzeichnis nicht auffindbar, nur LAZ. Ob `als/` ein fertiges Kronenhöhenmodell enthält, wurde nicht geprüft.
- BWI-Daten (Thünen, bwi.info): Die Seite antwortete im Test nicht (curl-Status 000 = Timeout/Verbindung). BWI-Rohdaten werden zudem nur aggregiert oder auf Anfrage abgegeben. Nicht verifiziert.
- Keine peer-reviewte Studie gefunden, die LiDAR-Kronenhöhe direkt als Prädiktor für B. edulis oder C. cibarius nutzt.

## 3. Boden und Nährstoffe: BÜK 300, Boden-pH, Stickstoffdeposition, Kalkung

### Takeaway
Die BÜK 300 Brandenburg (dl-de/by-2-0, 99 Legendeneinheiten) und SoilGrids-pH (250 m, Live-Test: pH 5,1 bei Joachimsthal in 0–5 cm) sind frei nutzbar. Stickstoffdeposition gibt es vom UBA (PINETI-3) mit 1 km je Landnutzungsklasse; der Rasterdatensatz muss aber angefragt werden. Die Evidenz ist für **Pfifferling** am stärksten: Er ist N-empfindlich und verschwindet bei pH < 4.

### Cited Findings
- BÜK 300 Brandenburg (2. Auflage 2012), Maßstab 1:300.000, 99 Legendeneinheiten mit Leitbodenformen und zugeordneten chemisch-physikalischen Parametern. Verfügbar als INSPIRE-WMS, Lizenz **dl-de/by-2-0** — [INSPIRE Geoportal BÜK](https://inspire-geoportal.ec.europa.eu/srv/api/records/2a4e7478-f7a3-4ad6-8c2e-9d6f8abca11a); [INSPIRE GÜK 300](https://inspire-geoportal.ec.europa.eu/srv/api/records/56a4f81b-eff2-45fb-b939-b97d2c122e00); [LBGR Kartenverzeichnis](https://lbgr.brandenburg.de/sixcms/media.php/9/Verzeichnis%20der%20Karten_04_2024.pdf). Bundesweit gibt es außerdem die BÜK200 der BGR, Blätter CC3142 Neubrandenburg und CC3942 Berlin — [GDI-DE](https://gdk.gdi-de.org/geonetwork/srv/api/records/4377EDAB-429A-41F3-B853-6513C9E49793)
- SoilGrids 2.0 (Poggio et al. 2021, *SOIL* 7, 217–240, DOI [10.5194/soil-7-217-2021](https://doi.org/10.5194/soil-7-217-2021)): 250 m, global, CC BY 4.0. **Live-Test**: Die REST-Abfrage für pH(H₂O) 0–5 cm bei 13,75 °E / 52,95 °N lieferte den Wert 51, also **pH 5,1** (`d_factor` 10) — [ISRIC REST](https://rest.isric.org/soilgrids/v2.0/properties/query?lon=13.75&lat=52.95&property=phh2o&depth=0-5cm&value=mean). Die REST-API ist als Beta mit Rate-Limit dokumentiert (Limit nicht live geprüft). Massendownload über WebDAV/VRT.
- LUCAS-Topsoil-Chemie: Ballabio et al. (2019), *Geoderma*, DOI [10.1016/j.geoderma.2019.113912](https://doi.org/10.1016/j.geoderma.2019.113912). pH, KAK, CaCO₃, C:N, N, P, K mit **500 m** in ETRS89-LAEA (EPSG:3035), EU-26, Proben von 2009/2012. Download bei ESDAC **nur nach Registrierung**, für Forschung und Politik — [ESDAC](https://esdac.jrc.ec.europa.eu/node/59842). LUCAS beprobt kaum Waldstandorte; das ist für die Pilzkarte eine Schwäche (Inferenz, siehe unten).
- UBA PINETI-3: Gesamtdeposition (nass, trocken, okkult) als Mittel 2013–2019, **1 × 1 km je Landnutzungsklasse** (11 Klassen, darunter Nadel- und Laubwald) im interaktiven Kartendienst. Der bundesweite ASCII-Datensatz (Jahre 2000, 2005, 2010, 2015–2019, auch S-Deposition und basische Kationen) **muss beim UBA angefragt werden** — [UBA Hintergrundbelastung N](https://www.umweltbundesamt.de/node/12586); [PINETI-3 Bericht](https://www.umweltbundesamt.de/publikationen/pineti-3-modellierung-atmosphaerischer). Der ArcGIS-Dienst `datahub.uba.de/.../Hintergrundbelastungsdaten_Stickstoff/MapServer` antwortete mit HTTP 200, gab ohne Token aber keine Layerliste zurück (Live-Test).
- van Strien, Boomsluiter, Noordeloos, Verweij, Kuyper (2018), "Woodland ectomycorrhizal fungi benefit from large-scale reduction in nitrogen deposition in the Netherlands", *Journal of Applied Ecology* 55(1), 290–298, DOI [10.1111/1365-2664.12944](https://doi.org/10.1111/1365-2664.12944). Nach dem Rückgang der N-Deposition drehten sich die Trends von Ektomykorrhizapilzen ins Positive, besonders bei nitrophoben Arten. Daten liegen auf Dryad: [doi:10.5061/dryad.bp096](https://datadryad.org/dataset/doi:10.5061/dryad.bp096)
- Lilleskov, Kuyper, Bidartondo et al. (2019), "Atmospheric nitrogen deposition impacts on the structure and function of forest mycorrhizal communities: A review", *Environmental Pollution*, DOI [10.1016/j.envpol.2018.11.074](https://doi.org/10.1016/j.envpol.2018.11.074)
- de Witte, Rosenstock, van der Linde et al. (2017), "Nitrogen deposition changes ectomycorrhizal communities in Swiss beech forests", *Science of the Total Environment*, DOI [10.1016/j.scitotenv.2017.06.142](https://doi.org/10.1016/j.scitotenv.2017.06.142)
- van der Linde et al. (2018), "Environment and host as large-scale controls of ectomycorrhizal fungi", *Nature* 558. Die europaweiten ICP-Forests-Plots zeigen N-Deposition und Boden-pH als Haupttreiber der Ektomykorrhiza-Gemeinschaften. Die Author Correction ist unter DOI [10.1038/s41586-018-0312-y](https://doi.org/10.1038/s41586-018-0312-y) belegt; die Original-DOI (vermutlich 10.1038/s41586-018-0189-9) habe ich nicht verifiziert.
- C. cibarius: In den Niederlanden ist ein Rückgang durch N-Deposition dokumentiert, und die Art verschwindet, wenn der Boden saurer als pH 4 wird (laut Zusammenfassung der IUCN-Red-List-Seite / Suchsnippet) — [IUCN redlist.info C. cibarius](https://redlist.info/iucn/species_view/200345/)

### Inferences
- Für Brandenburg (überwiegend Sandböden, Kiefer) ist die BÜK 300 zu grob. Die bereits im Projekt genutzte LFB-Standortskarte (Nährkraft-/Feuchtestufen) dürfte pH und Nährstoffe besser abbilden. SoilGrids oder LUCAS bringen dann vor allem einen kontinuierlichen pH-Gradienten.
- Die N-Deposition ist in Brandenburg räumlich vor allem an Tierhaltung und Ballungsraum gekoppelt. Für Pfifferling ist ein Malus bei hoher N-Deposition (Waldklasse) ökologisch gut begründet. Konkrete Schwellenwerte (kg N/ha/a) für C. cibarius fand ich nicht.

### Gaps
- Kalkungshistorie (Waldkalkung Brandenburg): Keine offene Geodatenquelle gefunden. Das müsste beim LFB angefragt werden.
- EMEP-Depositionsraster (0,1°) nicht geprüft.
- Die PINETI-Rasterdaten sind nicht direkt herunterladbar; Lizenz nach Anfrage unklar.

## 4. Wetter und Bodenfeuchte: DWD CDC, RADOLAN, UFZ-Dürremonitor, ERA5-Land, Open-Meteo

### Takeaway
Die **DWD-Open-Data (CC BY 4.0)** bieten alles Nötige ohne Registrierung: tägliche Raster für Bodenfeuchte (AMBAV), eine eigene Bodenfeuchte-Reihe **speziell für Kiefer** (netCDF, 0–10 cm und 0–30 cm, bis 2026), tägliche RADOLAN-Radar-Niederschläge (1 km), HYRAS und Bodentemperatur in 5 cm. Für den Wachstumsindex wären das bessere Eingangsgrößen als reine Punktwetterdaten. Die peer-reviewte Evidenz für Bodenfeuchte (fernerkundet bzw. modelliert) und für Niederschlagsfenster ist gut.

### Cited Findings
**DWD (Live-Test)**
- `opendata.dwd.de/climate_environment/CDC/grids_germany/daily/` enthält: `evapo_p/`, `evapo_r/`, `evaporation_fao/`, `frost_depth/`, `hyras_de/`, `radolan/`, `regnie/`, `soil_moist/`, `soil_moisture/`, `soil_temperature_5cm/`, `Project_TRY/` — [DWD CDC grids daily](https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily/)
- `soil_moist/`: Monatsarchive `grids_germany_daily_soil_moist_YYYYMM.tgz` von 1991-01 bis **2026-09** (bereitgestellt am 01.10.2026, rund 4,7–6,4 MB pro Monat). Dazu die Doku `AMBAV.pdf` und `The_1km_file_of_DWD.pdf` — [soil_moist](https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily/soil_moist/)
- `soil_moisture/`: Unterordner je Landnutzung: `beech/`, `composite/`, `grass/`, `maize/`, `oak/`, **`pine/`**, `spruce/`, `wheat/`. In `pine/` gibt es Jahresordner 1991–2026 mit `grids_germany_daily_soil_moisture_pine_2025_0-10_v1.nc` und `…_0-30_v1.nc` (netCDF) — [soil_moisture/pine](https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily/soil_moisture/pine/)
- `radolan/` hat die Unterordner `historical/` und `recent/` (`bin/` und `hdf5/`) — [radolan](https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily/radolan/)
- Lizenz: Die DWD-CDC-Open-Data stehen unter **CC BY 4.0**, ohne Registrierung — [DWD Terms of use PDF](https://opendata.dwd.de:443/climate_environment/CDC/Terms_of_use.pdf); [Nutzungsbedingungen](https://opendata.dwd.de/climate_environment/CDC/Nutzungsbedingungen_German.pdf); [wradlib Attribution](https://docs.wradlib.org/projects/radolan/en/latest/data/ATTRIBUTION.html)
- Die DWD-Raster liegen auf dem 1-km-Gitter in einer DWD-eigenen Projektion; RADOLAN nutzt eine polarstereographische Projektion. Beim Einlesen muss umprojiziert werden (Doku: `The_1km_file_of_DWD.pdf`, nicht im Detail gelesen).

**UFZ-Dürremonitor**
- Das Modell mHM liefert täglich Bodenfeuchte und den Bodenfeuchteindex SMI für Deutschland (Gesamtboden, Oberboden 0–25 cm, Pflanzenverfügbarkeit). Karten gibt es je Bundesland. Archivdatensätze: "daily historic mHM run 1947–2019, GDM_DE2" sowie GDM-v2-2021 mit Bodenwassergehalt 0–25 und 25–60 cm — [UFZ Drought Monitor](https://www.ufz.de/index.php?en=33328); [UFZ Datenarchiv 13645](https://www.ufz.de/record/dmp/archive/13645/en); [Methodik (Klimaatlas NRW)](https://www.klimaatlas.nrw.de/sites/default/files/2024-01/Methodik_Umwelt_Boden_UFZ_Duerremonitor.pdf). Die Seite ufz.de/index.php?de=37937 antwortete mit HTTP 200. Lizenz und Auflösung der Tagesdaten (oft mit etwa 4 km angegeben) konnte ich nicht verifizieren.

**Open-Meteo / ERA5-Land (Live-Test)**
- Die Archive-API (`archive-api.open-meteo.com/v1/archive`) antwortet mit HTTP 200. Mit `models=era5_land` wurde der Punkt auf das 0,1°-Gitter verschoben (53,0 / 13,8, Höhe 108 m), aber `precipitation_sum` für 01.–02.09.2025 kam als **null** zurück. Die ERA5-Land-Tagessumme war in diesem Test also nicht verfügbar; vor einer Nutzung klären. Die Limits laut Projekt-CLAUDE.md: < 10.000 Abrufe/Tag, nur nicht-kommerziell (nicht neu verifiziert).

**Evidenz: Niederschlag und Bodenfeuchte ↔ Fruktifikation**
- Brejon Lamartinière & Hoffman (2025, Preprint), "Predicting porcini: a decade of sporocarp monitoring reveals the meteorological triggers of *Boletus edulis* fruiting in central European beech forests", *bioRxiv*, DOI [10.64898/2025.12.12.693895](https://doi.org/10.64898/2025.12.12.693895). Täglich und nahezu vollständig erhobene Fruchtkörperdaten 2015–2024 aus einem Buchenwald bei **Bielefeld**. Das Fruktifikationsmaximum liegt bei einer **Mitteltemperatur von etwa 13 °C über die vorangehenden 20 Tage** und steigt **linear mit dem Niederschlag über ein 26-Tage-Fenster**. Noch nicht peer-reviewt; Volltext blockiert, nur Abstract/Snippet gelesen.
- Karavani, De Cáceres, Martínez de Aragón et al. (2018), "Effect of climatic and soil moisture conditions on mushroom productivity and related ecosystem services in Mediterranean pine stands facing climate change", *Agricultural and Forest Meteorology* 248, 432–440, DOI [10.1016/j.agrformet.2017.10.024](https://doi.org/10.1016/j.agrformet.2017.10.024). 28 Plots, 2008–2015. Kombiniert Klima mit **fernerkundeter Bodenfeuchte und NDVI** und modelliert explizit auch B. edulis — [UdL Repositori](https://portalrecerca.udl.cat/documentos/64ad08e2e28d57322266938f?lang=en)
- Boddy, Büntgen, Egli et al. (2014), "Climate variation effects on fungal fruiting", *Fungal Ecology*, DOI [10.1016/j.funeco.2013.10.006](https://doi.org/10.1016/j.funeco.2013.10.006) (Review)
- Alday, Martínez de Aragón, de-Miguel et al. (2017), "Mushroom biomass and diversity are driven by different spatio-temporal scales along Mediterranean elevation gradients", *Scientific Reports*, DOI [10.1038/srep45824](https://doi.org/10.1038/srep45824)
- Egli, Peter, Buser et al. (2006), "Mushroom picking does not impair future harvests – results of a long-term study in Switzerland", *Biological Conservation*, DOI [10.1016/j.biocon.2005.10.042](https://doi.org/10.1016/j.biocon.2005.10.042). Langzeitreihe La Chanéaz, wichtig als temperate Referenz: Sammeln mindert künftige Erträge nicht.
- Für Boletus aff. edulis ist eine stimulierende Wirkung mittlerer Bodenfeuchte beschrieben, ebenso ein früherer Fruktifikationsbeginn bei größerer Spannweite der Bodentemperatur (laut Suchsnippet; Primärquelle ist vermutlich die Dendrobiology-Arbeit, nicht verifiziert) — [Dendrobiology 91](https://www.idpan.poznan.pl/images/stories/dendrobiology/vol91/denbio091002.pdf)

### Inferences
- Die DWD-Bodenfeuchte "pine" 0–10 cm (täglich, 1 km) passt fast perfekt zur Brandenburger Kiefernlandschaft. Sie könnte den selbst berechneten Bodenfeuchte-Proxy aus Open-Meteo ersetzen oder kalibrieren. Die Bereitstellung erfolgt allerdings nur monatlich bzw. jährlich (`recent` möglicherweise mit Verzug), für eine tagesaktuelle Webseite also nur als historische Kalibrierung. Für den Live-Betrieb Open-Meteo beibehalten.
- RADOLAN (1 km, täglich) erfasst konvektive Sommerschauer besser als Reanalyse-Gitter von 9–11 km. Das ist relevant, weil das 26-Tage-Niederschlagsfenster lokal stark variiert.

### Gaps
- Keine peer-reviewte Studie gefunden, die **RADOLAN** oder generell Radar-Niederschlag für Pilzmodelle nutzt.
- Den DWD-Bodenfeuchte-Aktualisierungszyklus für `recent` (Verzug in Tagen) habe ich nicht geprüft.
- Lizenz des UFZ-Dürremonitors nicht verifiziert.

## 5. Fernerkundungs-Phänologie: Sentinel-2 NDVI/NDMI, Copernicus HR-VPP

### Takeaway
Copernicus HR-VPP liefert 10-m-Vegetationsindizes ab 2017 (täglich roh, alle 10 Tage geglättet, dazu jährliche Phänologieparameter) für die EEA39-Staaten. LGB Brandenburg stellt außerdem eigene Sentinel-2-COGs (2023, 2024) bereit. NDVI und Bodenfeuchte wurden in Karavani et al. 2018 erfolgreich für Pilzerträge eingesetzt.

### Cited Findings
- HR-VPP: 10 m aus Sentinel-2A/B, ab 01.01.2017, EEA39. Produkte: (1) VI: vier tägliche Roh-Indizes (verfügbar innerhalb von 12 h); (2) Seasonal Trajectories: 10-Tages-Intervall, Lücken gefüllt; (3) VPP-Parameter: jährlich, z. B. Saisonstart und -ende und Produktivität. Zugang über WEkEO (Python HDA API) — [WEkEO News](https://wekeo.copernicus.eu/news/clms-releases-hr-vpp-product-to-assess-ecosystems-and-biodiversity); [EEA Katalog VPP](https://metadatacatalogue.lifewatch.eu/srv/api/records/EO:EEA:DAT:CLMS_HRVPP_VPP-LAEA)
- LGB Brandenburg: `sentinel2/2023/` und `sentinel2/2024/` als Cloud-Optimized GeoTIFF, dl-de/by-2-0 (Live-Test, Verzeichnislisting) — [data.geobasis-bb.de/sentinel2](https://data.geobasis-bb.de/geobasis/daten/sentinel2/)
- Karavani et al. 2018 (siehe Abschnitt 4) nutzten NDVI und fernerkundete Bodenfeuchte als Prädiktoren für Pilzerträge, einschließlich B. edulis — [DOI 10.1016/j.agrformet.2017.10.024](https://doi.org/10.1016/j.agrformet.2017.10.024)

### Inferences
- Unter einem geschlossenen Kiefernkronendach misst NDMI überwiegend die Kronenfeuchte, nicht die Bodenfeuchte. Als tagesaktueller Feuchteindikator ist es daher fraglich und durch Wolken lückig. Als statischer Habitatlayer ist es nützlicher (z. B. HR-VPP-Produktivität als Vitalitäts- oder Nährstoffproxy, Laub-/Nadel-Trennung).

### Gaps
- HR-VPP-Lizenz und Login-Pflicht nicht live geprüft.
- Keine Studie gefunden, die Sentinel-2-NDMI direkt mit Steinpilz- oder Pfifferling-Fruktifikation in Mitteleuropa verknüpft.

## 6. Übersicht: Integration und blockierte Quellen

### Takeaway
Die Hauptkandidaten mit dem besten Verhältnis von Nutzen zu Aufwand sind: (1) die DWD-Bodenfeuchte Kiefer (netCDF, CC BY 4.0), (2) LGB nDOM oder Meta-CHM für die Bestandesstruktur, (3) GBIF/iNat-Punkte zur Validierung, (4) SoilGrids-pH und UBA-N-Deposition als Pfifferling-Modifikatoren.

### Cited Findings
| Quelle | Format | KBS | Auflösung | Lizenz | Update |
|---|---|---|---|---|---|
| GBIF Occurrence API | JSON/DwC-A | WGS84 (EPSG:4326) | Punkt (Unsicherheit meist ≤ 100 m) | je Datensatz CC0/BY/BY-NC | laufend — [API](https://api.gbif.org/v1/occurrence/search) |
| iNaturalist API | JSON | EPSG:4326 | Punkt | je Beobachtung | laufend — [API](https://api.inaturalist.org/v1/observations) |
| LGB nDOM | LAZ (LAS 1.2), 1-km-Kacheln | EPSG:25833 | Punktwolke | dl-de/by-2-0 | Befliegungszyklus (Datei 2024) — [ndom](https://data.geobasis-bb.de/geobasis/daten/ndom/) |
| Meta/WRI CHM | COG | EPSG:3857 (nicht verifiziert) | 1 m | CC BY 4.0 | statisch 2009–2020 — [AWS](https://registry.opendata.aws/dataforgood-fb-forestsv2) |
| Lang et al. CHM | GeoTIFF | EPSG:4326 (nicht verifiziert) | 10 m | Code MIT | statisch 2020 — [GitHub](https://github.com/langnico/global-canopy-height-model) |
| HRL TCD/DLT | GeoTIFF | EPSG:3035 | 10 m (2018) | Copernicus frei | 3-jährlich — [EEA](https://sdi.eea.europa.eu/catalogue/fise/api/records/486f77da-d605-423e-93a9-680760ab6791) |
| Forest Age (Besnard) | NetCDF/GeoTIFF | EPSG:4326 | 1 km | offen (lt. ESSD) | statisch ~2010 — [DOI](https://doi.org/10.17871/ForestAgeBGI.2021) |
| BÜK 300 BB | WMS / Vektor | EPSG:25833 (anzunehmen) | 1:300.000 | dl-de/by-2-0 | 2012 — [INSPIRE](https://inspire-geoportal.ec.europa.eu/srv/api/records/2a4e7478-f7a3-4ad6-8c2e-9d6f8abca11a) |
| SoilGrids 2.0 | REST/COG/VRT | Homolosine (IGH) bzw. EPSG:4326 über REST | 250 m | CC BY 4.0 | statisch — [REST](https://rest.isric.org/soilgrids/v2.0/properties/query) |
| LUCAS-Chemie | GeoTIFF | EPSG:3035 | 500 m | ESDAC, Registrierung | statisch 2009 — [ESDAC](https://esdac.jrc.ec.europa.eu/node/59842) |
| UBA PINETI-3 | Kartendienst; ASCII auf Anfrage | k. A. | 1 km je Landnutzung | k. A. | Mittel 2013–2019 — [UBA](https://www.umweltbundesamt.de/node/12586) |
| DWD Bodenfeuchte pine | NetCDF | DWD-1-km-Gitter | 1 km, täglich | CC BY 4.0 | jährlich/monatlich — [DWD](https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily/soil_moisture/pine/) |
| DWD AMBAV soil_moist | tgz, monatlich | DWD-Gitter | 1 km, täglich | CC BY 4.0 | monatlich (2026-09 verfügbar) — [DWD](https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily/soil_moist/) |
| DWD RADOLAN täglich | bin/HDF5 | polarstereographisch | 1 km | CC BY 4.0 | täglich/recent — [DWD](https://opendata.dwd.de/climate_environment/CDC/grids_germany/daily/radolan/) |
| UFZ-Dürremonitor | Karten/NetCDF (Archiv) | k. A. | ~4 km (nicht verifiziert) | k. A. | täglich — [UFZ](https://www.ufz.de/index.php?en=33328) |
| HR-VPP | GeoTIFF | EPSG:3035 | 10 m | Copernicus | täglich / 10 Tage / jährlich — [WEkEO](https://wekeo.copernicus.eu/news/clms-releases-hr-vpp-product-to-assess-ecosystems-and-biodiversity) |

**Blockiert, nicht erreichbar oder nicht verifiziert (Live-Tests)**
- www.biorxiv.org: vom Egress-Proxy **blockiert**, daher nur das Abstract des Porcini-Preprints über die Suche gelesen.
- repository.naturalis.nl (Volltext van Strien 2018): vom Egress-Proxy **blockiert**.
- bwi.info (Thünen BWI): keine Antwort (curl 000).
- pilze-deutschland.de: Die Artseiten-URL lieferte 404; kein offener Massendownload gefunden.
- UBA-datahub-MapServer: HTTP 200, aber ohne Token keine Layerliste.
- Open-Meteo `models=era5_land`: Die Tagesniederschlagssumme kam als null zurück.
- ESDAC (LUCAS): erreichbar, aber der Download ist registrierungspflichtig (nicht durchgeführt).
- land.copernicus.eu: HTTP 302 (Weiterleitung). Download mit EU-Login nicht geprüft.

### Inferences
- Für Regel 11 (Koordinatensysteme an der Grenze prüfen) kommen neue Systeme hinzu: das DWD-1-km-Gitter, RADOLAN polarstereographisch und SoilGrids IGH. Diese sollten beim Einlesen nach EPSG:25833 transformiert und validiert werden.
- Lizenzpflichten für README und Webseite (Regel 13): dl-de/by-2-0 (LGB, LBGR), CC BY 4.0 (DWD, SoilGrids, Meta), CC BY-NC 4.0 (Teile der GBIF-Daten, Observation.org).

### Gaps
- Die genauen Dateigrößen für ganz Brandenburg (Meta-CHM, HRL) habe ich nicht berechnet.
- Die Übertragbarkeit der spanischen und Schweizer Ertragsmodelle auf Brandenburger Kiefern-Sandstandorte ist nicht belegt. Es gibt keine Langzeit-Ertragsmonitoring-Studie aus Nordostdeutschland.
