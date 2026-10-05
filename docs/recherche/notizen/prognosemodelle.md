# Prognosemodelle für Steinpilz (Boletus edulis) und Pfifferling (Cantharellus cibarius): Vorkommen, Fruchtungszeitpunkt, Ertrag

Research notes, compiled 2026-10-04. Access situation: the sandbox egress proxy blocked springer.com, biorxiv.org, medfor.eu, cris.ctfc.cat, mdpi.com, radio.cz and others. Most entries below therefore rest on **abstracts** (via Europe PMC REST API / Crossref API). One full text was read completely: Sánchez-González et al. 2019 (Forest Ecosystems, OA PDF from zaguan.unizar.es). Each source is labelled **[FULL TEXT]**, **[ABSTRACT ONLY]** or **[SNIPPET/SECONDARY]**.

Correction to the brief: the paper listed as "Collado et al. 2018/2019, Forest Ecosystems, P. pinaster/sylvestris NW Spain, basal area optimum" is actually **Sánchez-González et al. 2019** (Collado is not an author). Collado et al. 2018 is a separate paper in Forest Ecology and Management (tree rings vs. fungal yield), and Collado et al. 2019 is in Science of the Total Environment.

---

## 1. Spanish/Catalan yield models (Bonet, Martínez-Peña, de-Miguel, Karavani, Sánchez-González, Collado, Alday)

### Takeaway
Spain has the densest set of peer-reviewed empirical **annual** yield models (kg ha⁻¹ yr⁻¹, plot level, weekly autumn sampling of 100 m² plots). Standard approach: mixed-effects models, often two-part "hurdle" models (logistic occurrence plus Gamma/log-linear yield) with a random year effect. Predictors: **monthly precipitation (Aug–Oct), November temperature, stand basal area (unimodal optimum), elevation/slope/aspect**. Only one model is B. edulis-specific (Martínez-Peña et al. 2012). None of these models is daily, and none covers chanterelle.

### Cited Findings

**Bonet et al. 2010, Canadian Journal of Forest Research 40: 347–356, DOI 10.1139/X09-198** [ABSTRACT ONLY, paywalled]
- Region: South-Central Pyrenees, Catalonia, pine forests (P. sylvestris and others). Data from 45 plots. Response: mushroom production and species richness. Method: mixed modelling of between-plot and between-year variation. — [Crossref](https://api.crossref.org/works/10.1139/X09-198)
- The most important stand variable was stand basal area. Maximum productivity occurred at **15–20 m² ha⁻¹**, which coincides with the peak of annual basal-area increment. Other predictors: slope, elevation, aspect, **autumn rainfall**. — [Crossref](https://api.crossref.org/works/10.1139/X09-198)
- The abstract gives no performance metrics. They are not recorded here.
- Precursors: Bonet et al. 2004 (FEM, DOI 10.1016/j.foreco.2004.07.063): 36 plots of 100 m² over 3 years in P. sylvestris, Central Pyrenees. Age class influenced 21 taxa and aspect influenced 7 taxa. — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.foreco.2004.07.063). Palahí et al. 2009 (Forest Science, DOI 10.1093/forestscience/55.6.503) built the yield models into a stand simulator and optimizer. Thinnings have a negative short-term but often a positive long-term effect on yields. — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1093%2Fforestscience%2F55.6.503)

**Martínez-Peña et al. 2012, Forest Ecology and Management 282: 63–69, DOI 10.1016/j.foreco.2012.06.034** — "Yield models for ectomycorrhizal mushrooms in Pinus sylvestris forests with special focus on Boletus edulis and Lactarius group deliciosus" [ABSTRACT ONLY, paywalled]
- Data: 18 permanent plots in pure even-aged P. sylvestris, monitored for **15 consecutive years**. Region: north-central Spain (Soria/Pinar Grande, per the Oppla case study). — [Europe PMC abstract](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.foreco.2012.06.034); [Oppla case study](https://oppla.eu/casestudy/20556)
- "Rainfall and temperature were significant predictors in all the fitted models". The B. edulis equation is described as "the first model for this species" and "shows that stand basal area is a strong factor influencing the yield". Total ECM yield also depended on dominant height and stand age. — [Europe PMC abstract](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.foreco.2012.06.034)
- The B. edulis basal-area optimum is about **40 m² ha⁻¹**. This is cited in Sánchez-González et al. 2019 and by Oppla. Oppla also gives a mean B. edulis yield of about **26 kg ha⁻¹ yr⁻¹, up to 200 kg ha⁻¹ yr⁻¹ in exceptional years** (Pinar Grande). — [Sánchez-González et al. 2019](https://zaguan.unizar.es/record/96240/files/texto_completo.pdf); [Oppla](https://oppla.eu/casestudy/20556)
- Gap: the exact weather windows and performance metrics of the B. edulis equation were not accessible.

**de-Miguel et al. 2014, Forest Ecology and Management 330: 218–227, DOI 10.1016/j.foreco.2014.07.014** [ABSTRACT ONLY; author PDF on cris.ctfc.cat blocked]
- Region: Catalonia, pine forests (P. sylvestris, P. halepensis, P. pinaster, P. nigra). The yield models account for site and stand structure effects on **occurrence and yield** (a two-part approach; Sánchez-González 2019 cites de-Miguel 2014 as the origin of the hurdle approach). The models were coupled with individual-tree growth models for 30-year continuous-cover forestry scenarios. — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.foreco.2014.07.014)
- Current mean productivity of valuable mushrooms is **14 kg ha⁻¹ yr⁻¹** (4,600 t/yr regionally). Without management, production falls by about 11% over 30 years. Harvesting 100% of growth raises it by about 6%. — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.foreco.2014.07.014)
- Optimum basal area of 30–40 m² ha⁻¹ for edible/marketed mushrooms in P. pinaster (as cited in Sánchez-González 2019). — [Sánchez-González 2019](https://zaguan.unizar.es/record/96240/files/texto_completo.pdf)
- The abstract mentions no weather predictors. It is a site/stand model and is not climate-sensitive.

**Karavani et al. 2018, Agricultural and Forest Meteorology 248: 432–440, DOI 10.1016/j.agrformet.2017.10.024** [ABSTRACT ONLY; medfor.eu author PDF blocked]
- Data: 28 permanent plots in **Pinus pinaster**, NE Iberian Peninsula, 2008–2015, weekly autumn sampling. Weather was interpolated from stations. **Soil moisture was measured continuously at plot level.** A process-based soil water balance model projected soil moisture under 2 scenarios × 2 regional climate models. — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.agrformet.2017.10.024)
- Model: mixed-effects models with either precipitation or soil moisture as predictor, combined with other weather variables, fitted to occurrence and yield (two-part). — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.agrformet.2017.10.024)
- Key results: yield depends mainly on weather and **soil moisture in the same month**, except precipitation, which acts with a **one-month lag**. High temperatures limit yield **early** in the season but enhance it **late** in the season. Projected median marketed yield for 2016–2100 is 23–93% higher, because the season lengthens. — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.agrformet.2017.10.024)
- Group-level only (total/edible/marketed). No B. edulis-specific model is mentioned. No metrics in the abstract.

**Sánchez-González et al. 2019, Forest Ecosystems 6: 52, DOI 10.1186/s40663-019-0211-1** — "Yield models for predicting aboveground ectomycorrhizal fungal productivity in Pinus sylvestris and Pinus pinaster stands of northern Spain" [FULL TEXT, open access]
- Data: 90 plots of 100 m² (39 P. sylvestris, 51 P. pinaster) in Catalonia, Castilla y León (Soria, Palencia, Valladolid) and NW Spain. Weekly autumn monitoring for ≥9 consecutive years (1995/1997–2015). — [Full text](https://zaguan.unizar.es/record/96240/files/texto_completo.pdf)
- Response: annual fresh yield (kg ha⁻¹ yr⁻¹) of all ECM / edible / marketed mushrooms. Not species-level. Zeros: 4.25% (all ECM), 9% (edible), 31% (marketed). — [Full text](https://zaguan.unizar.es/record/96240/files/texto_completo.pdf)
- Model: **hurdle GLMM**. Part 1: logistic regression for occurrence. Part 2: Gamma regression for yield conditional on occurrence. Random year effects in both parts (plot random effects were dropped because their variance was not significant). Plot clusters (5 groups from Ward clustering on yield, climate and site) enter as fixed dummies. Fitted in SAS NLMIXED, with a 2,000-sample bootstrap. — [Full text](https://zaguan.unizar.es/record/96240/files/texto_completo.pdf)
- Weather windows tested: monthly precipitation for Aug, Sep, Oct, Nov; sums for Aug–Sep and Aug–Oct; annual totals; monthly mean temperature for Aug–Nov. — [Full text](https://zaguan.unizar.es/record/96240/files/texto_completo.pdf)
- Selected predictors:
  - All ECM yield: ln(G/10) (+0.97), √(G/10) (−1.21), ln P_Aug (+0.18), ln P_Sep (+0.22), **ln P_Oct (+0.43, the largest effect)**, ln P_Nov (**−0.25**, too much November rain reduces yield), ln T_Nov (+0.36).
  - Marketed yield: only **ln P_Sep (+0.45)** plus basal area.
  - Occurrence: only T_Nov (all ECM). No precipitation variable was significant for occurrence, because the year random effect and cluster dummies absorbed the between-year variation. — [Full text](https://zaguan.unizar.es/record/96240/files/texto_completo.pdf)
- Basal-area optimum: about **40 m² ha⁻¹** (all ECM, edible) and **30 m² ha⁻¹** (marketed), on a right-skewed unimodal curve with a weak decline. High yields occur over roughly 20–30 m² ha⁻¹ and above. Thinning was not significant. — [Full text](https://zaguan.unizar.es/record/96240/files/texto_completo.pdf)
- Performance:
  - Occurrence AUC (bootstrapped, in-sample): **0.89–0.96** (all ECM), **0.83–0.89** (edible), "acceptable" for marketed. The authors note that AUC may be overestimated because the same data were used for fitting.
  - Yield model: RMSE **111.97** kg ha⁻¹ (all ECM, mean yield 117.8), **83.0** (edible), **64.7** (marketed). Relative RMSE 0.94 / 1.21 / 1.79 (i.e. 94–179% of the mean). Bias ≈ 0.
  - No independent validation. — [Full text](https://zaguan.unizar.es/record/96240/files/texto_completo.pdf)
- Mean all-ECM yield 117.83 ± 4.53 kg ha⁻¹ yr⁻¹, maximum about 500 kg ha⁻¹. 2006 and 2014 were exceptional years. — [Full text](https://zaguan.unizar.es/record/96240/files/texto_completo.pdf)

**Collado et al. 2018, Forest Ecology and Management, DOI 10.1016/j.foreco.2018.04.025** [ABSTRACT ONLY]
- P. pinaster, NE Spain, 27 plots in a thinning experiment, 2008–2014. Mixed-effects occurrence/yield models used dendrochronological predictors (earlywood/latewood, intra-annual density fluctuations, IADF). The frequency of latewood IADFs was the best predictor (the abstract is truncated at this point). — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.foreco.2018.04.025)

**Collado et al. 2019, Science of the Total Environment, DOI 10.1016/j.scitotenv.2019.06.471** [ABSTRACT ONLY]
- Long-term weekly/biweekly yield data from Spain, Switzerland and Finland, related to tree rings and summer/autumn climate. Significant synchrony with climate and tree growth was found **mostly in dry Mediterranean sites**, and few or none in temperate and boreal sites. — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.scitotenv.2019.06.471)

**Alday et al. 2017a, Scientific Reports 7: 45824, DOI 10.1038/srep45824** [ABSTRACT; OA via PMC5382911]
- P. sylvestris along an elevation gradient (Catalonia), 8 years. Biomass is driven mainly by **inter-annual** variation and richness mainly by spatial variation. Elevation was not significant. The main driver is **late-summer to early-autumn precipitation**. — [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5382911/)
- Alday et al. 2017b, "Record breaking mushroom yields in Spain", Fungal Ecology 26: 144–146, DOI 10.1016/j.funeco.2017.01.004. Identifies 2014 as a record year. Known only from the reference list in Sánchez-González 2019, not read.

### Inferences
- The Spanish models are designed for **forest planning** (annual yield × management), not for day-to-day forecasting. Their transferable parts are (a) the hurdle structure (occurrence × conditional amount), (b) precipitation windows of roughly 4–8 weeks before or during the season, (c) a **basal-area optimum** as a static habitat factor.
- The basal-area optimum is inconsistent across studies: 15–20 m² ha⁻¹ (Bonet 2010, Pyrenees, all mushrooms), 25 m² ha⁻¹ (Tahvanainen 2016, B. edulis, spruce, Finland), 30–40 m² ha⁻¹ (de-Miguel 2014, Sánchez-González 2019), about 40 m² ha⁻¹ (Martínez-Peña 2012, B. edulis). It should be treated as a soft, unimodal factor.
- Karavani's soil-moisture result (same-month soil moisture beats lagged rain) supports using **Open-Meteo soil moisture 3–9 cm** directly as a predictor. The co-author De Cáceres develops the MEDFATE water-balance model, so this was probably the process model used. That is my inference and is unverified.
- Relative RMSE of about 100% even for annual plot yields shows how noisy fruiting is. A daily index can realistically only give relative "good/poor" classes.

### Gaps
- No access to the full texts of Martínez-Peña 2012 (B. edulis equation, its weather windows and metrics), de-Miguel 2014, Karavani 2018 or Bonet 2010.
- No Spanish model for Cantharellus cibarius was found.

---

## 2. Finland / Nordic (Salo, Ohenoja, Tahvanainen; Kauserud phenology)

### Takeaway
Finnish models are annual and plot-level (Tahvanainen et al. 2016) or national market-supply regressions (Tahvanainen et al. 2019). Norwegian work (Kauserud 2008) concerns phenology from herbarium records. In the Finnish spruce model, B. edulis responded to a **warm July (pre-season) and a wet August**.

### Cited Findings
- **Tahvanainen, Miina, Kurttila, Salo 2016, Forest Ecology and Management, DOI 10.1016/j.foreco.2015.11.040** [ABSTRACT ONLY]
  - Planted Picea abies, eastern Finland, 56 plots, 2010–2014. Non-linear mixed-effects model (plot and year random effects). Separate models for **B. edulis**, Lactarius spp. and all marketed mushrooms.
  - B. edulis peaks just before first thinning: **age 25–30 yr, basal area about 25 m² ha⁻¹**.
  - Yields are promoted by a **warm pre-season (July)** and **wet conditions during the fruiting season (August)**. No metrics in the abstract. — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.foreco.2015.11.040)
- **Tahvanainen, Miina, Kurttila 2019, Forests 10(5): 385, DOI 10.3390/f10050385** [ABSTRACT ONLY; OA but MDPI blocked]
  - Linear regression of nationally marketed quantities of ceps (Steinpilz), milk caps and **chanterelle**, 1978–2016, against climatic and economic variables. Climate acts through biological yield. Price has a negative effect on ceps and milk caps. — [Crossref](https://api.crossref.org/works/10.3390/f10050385)
- **Ohenoja** studied the effect of weather on larger fungi at different forest sites in Northern Finland, 1976–1988 (Karstenia/Acta Univ. Ouluensis). [SNIPPET/SECONDARY] — [search result referencing karstenia.fi](https://karstenia.fi/?p=1984). Not read.
- **Kauserud et al. 2008, PNAS 105: 3811, DOI 10.1073/pnas.0709037105** [ABSTRACT; author PDF exists at uio.no]
  - About 34,500 dated herbarium records, Norway, 1940–2006. Mean fruiting delay since 1980: **12.9 days**. Early fruiters were delayed more, so the season is compressed.
  - Fruiting is earlier in northern and continental areas. Warmer **autumn and winter** temperatures delay fruiting in the same and the following year. — [Crossref](https://api.crossref.org/works/10.1073/pnas.0709037105)
- **Andrew et al. 2018, Ecology, DOI 10.1002/ecy.2237** [ABSTRACT ONLY]
  - Europe-wide path analysis of fruiting dates. Mean fruiting varies by about 25 d with latitude and up to 30 d with altitude.
  - **Temperature** drives the timing of autumn-fruiting ECM fungi. Species-specific predictors were "not stable". — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1002%2Fecy.2237)

### Inferences
- For Brandenburg, the Nordic results imply that fruiting **timing** is mainly temperature-controlled (autumn cooling), while **amount** is precipitation-controlled. A daily index should therefore combine a temperature window with a moisture window.
- The July-warmth / August-wetness pattern for B. edulis in Finland resembles the "warm summer, then rain" heuristic, but its basis is only 5 years of data.

### Gaps
- No Finnish chanterelle plot model found. Salo's yield tables (e.g. Salo 1979/1984, yields by forest site type) were not retrieved.
- No Swedish weather–yield model found.

---

## 3. Central Europe: Switzerland, Germany, Czech Republic, Poland, Italy, Lithuania

### Takeaway
The most transferable study for a daily German model is a **2025 bioRxiv preprint (not peer reviewed)** from Bielefeld. Daily, near-exhaustive B. edulis counts over 10 years in beech forest show peak fruiting at a **mean temperature of about 13 °C over the preceding 20 days**, with fruiting increasing **linearly with precipitation summed over 26 days**. Swiss La Chanéaz data link productivity to June–October rain and timing to July–August temperature. Czech and Polish studies are coarse market/foraging regressions.

### Cited Findings
- **Brejon Lamartinière & Hoffman 2025, bioRxiv preprint, DOI 10.64898/2025.12.12.693895**, "Predicting porcini: a decade of sporocarp monitoring reveals the meteorological triggers of Boletus edulis fruiting in central European beech forests" [ABSTRACT ONLY; **PREPRINT, not peer reviewed**; biorxiv blocked]
  - Data: daily, near-exhaustive sporocarp observations of one intensively monitored B. edulis population, **beech forest near Bielefeld, Germany, 2015–2024**.
  - Method: GLMMs estimating **lagged effects** of temperature and precipitation.
  - Results: peak fruiting at a **mean temperature of about 13 °C averaged over the preceding 20 days**; fruiting increases **linearly with precipitation accumulated over a 26-day window**. Fruiting is expected to decline under warmer and drier autumns. Performance metrics are not in the abstract. — [Europe PMC record](https://europepmc.org/search?query=DOI%3A%2210.64898%2F2025.12.12.693895%22)
- **Straatsma, Ayer, Egli 2001, Mycological Research, DOI 10.1017/S0953756201004154** [ABSTRACT ONLY]
  - Fungal reserve La Chanéaz (western Switzerland), 1,500 m² plot, weekly counts 1975–99.
  - Productivity correlated with **precipitation June–October**. Fruiting **time** correlated with **July–August temperatures**. Mycorrhizal and saprotrophic groups behaved similarly. — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1017%2Fs0953756201004154)
- **Michaud et al. 2024, Ecology Letters, DOI 10.1111/ele.14460** [ABSTRACT ONLY]: in a 29-year Swiss sporocarp census, beech **mast years** were associated with **55% lower sporocarp production**. This is an additional non-weather predictor for beech stands. — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1111%2Fele.14460)
- **Procházka et al. 2023, Forests 14(2): 382, DOI 10.3390/f14020382** [ABSTRACT ONLY]: Czech Republic, national foraged-mushroom amounts as a time series (Dickey–Fuller test + OLS). One unit of precipitation change gave +27 t foraged. Temperature was not significant. Coarse national level. — [Crossref](https://api.crossref.org/works/10.3390/f14020382)
- **Poland**: an analysis of chanterelle (Cantharellus cibarius) purchase volumes, 2004–2008, found a relationship with **total monthly precipitation**. Chanterelle made up 63% of purchased wild fungi. Polish-language journal (Leśne Prace Badawcze / IBL), [SNIPPET/SECONDARY]. — [IBL](https://ibles.pl/?p=6136); [SGGW journal page](https://lpb-ibl.sggw.edu.pl/article/view/11930)
- **Italy (Salerni)**: no Salerni weather-fruiting model was found through Europe PMC. Salerni's indexed papers concern truffles and thinning (e.g. Maccherini et al. 2021, FEM, DOI 10.1016/j.foreco.2021.119257: no short-term thinning effect on mushroom communities in P. nigra plantations). — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.foreco.2021.119257)
- **Lithuania**: nothing found.
- **Related ECM evidence (truffle, not target species)**: Steidinger et al. 2022, Global Change Biology, DOI 10.1111/gcb.16424 (OA). Citizen-science T. aestivum productivity at 20 sites in SW Germany and Switzerland, linear mixed models + machine learning. Median **−22% productivity per +1 °C summer temperature anomaly**; anomalies of +3 °C could stop fruiting. — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1111%2Fgcb.16424)

### Inferences
- The Bielefeld windows (20-day temperature, 26-day precipitation) fall in the same 3–5-week range as Spanish monthly effects with a 1-month rain lag (Karavani) and Aug–Oct rain sums (Sánchez-González). This suggests a **robust 3–4-week antecedent moisture window** for B. edulis across climates.
- The 13 °C optimum comes from beech on loamy soils in NW Germany. Sandy Scots pine soils in Brandenburg dry faster, so the precipitation window may need to be replaced or weighted by soil moisture (Karavani).

### Gaps
- Full text of the Bielefeld preprint (effect sizes, model fit, zero-inflation handling) not accessible. It also needs re-checking for peer-reviewed publication status.
- No German or Polish model for C. cibarius found. No Brandenburg-specific yield data found.

---

## 4. Species distribution models (SDMs/MaxEnt) for B. edulis or chanterelle

### Takeaway
No peer-reviewed MaxEnt/SDM study specifically for B. edulis or C. cibarius in Europe was found within the search budget. Spatial habitat in the existing literature comes from plot yield models (basal area, age, elevation, aspect) rather than from occurrence-based SDMs.

### Cited Findings
- Targeted searches (Europe PMC, web) for "species distribution model / MaxEnt / habitat suitability" combined with Boletus/Cantharellus returned no relevant European SDM. — [Europe PMC search](https://europepmc.org/search?query=%28%22species%20distribution%20model%22%20OR%20maxent%29%20AND%20%28Boletus%20OR%20Cantharellus%29)
- A genomic study (Brejon Lamartinière et al. 2024, Molecular Ecology, DOI 10.1111/mec.17470) used **predicted Last-Glacial-Maximum habitat suitability** for B. edulis lineages. This implies an SDM exists in that paper or its supplement, but it is not a present-day habitat map. — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1111%2Fmec.17470)
- GBIF/laji.fi hold B. edulis occurrence records usable for SDMs. — [laji.fi](https://laji.fi/en/taxon/MX.72563/occurrence)
- Large-scale occurrence data have been used for phenology rather than distribution: Krah, Büntgen, Bässler 2023 (Ecology Letters, DOI 10.1111/ele.14275) used 6.1 million fruit-body records and found that timing and duration of fruiting relate to mean temperature and its variability. — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1111%2Fele.14275)

### Inferences
- For the Brandenburg habitat heatmap, a rule-based host-tree × stand-structure score (pine/oak/beech/spruce for B. edulis; pine/beech/oak/spruce on acidic, nutrient-poor soils for chanterelle) is better supported by the literature than a fitted SDM. GBIF data could later serve for validation, though collection bias is likely.

### Gaps
- SDM literature may exist in non-indexed or Asian/Turkish journals. This was not exhaustively searched.

---

## 5. Which predictors and windows consistently matter

### Takeaway
Across studies, the **amount** of fruiting is governed by **precipitation or soil moisture in a window of roughly 3–8 weeks ending at or shortly before fruiting**. **Timing and suitability** are governed by **temperature**: moderate cool temperatures, around 13 °C over 20 days in Germany; heat suppresses fruiting early in the season, while warmth extends it late in the season. Stand **basal area (unimodal)** and **stand age** are the most consistent stand variables.

### Cited Findings
| Study | Region / forest | Moisture window | Temperature effect | Stand variable |
|---|---|---|---|---|
| Sánchez-González 2019 | N Spain, P. sylvestris/pinaster | P Aug, Sep, **Oct (+)**, Nov (−); marketed: P Sep | T Nov (+) | BA optimum 30–40 m² ha⁻¹ |
| Karavani 2018 | NE Spain, P. pinaster | Soil moisture same month; rain lag 1 month | Heat (−) early, (+) late | — |
| Alday 2017 | Catalonia, P. sylvestris | Late summer / early autumn rain | — | elevation n.s. |
| Bonet 2010 | Pyrenees, pines | Autumn rainfall | — | BA optimum 15–20; slope, elevation, aspect |
| Martínez-Peña 2012 | N-central Spain, P. sylvestris, **B. edulis** | rainfall (details n/a) | temperature (details n/a) | BA ~40 m² ha⁻¹ |
| Tahvanainen 2016 | E Finland, P. abies, **B. edulis** | wet August | warm July (+) | age 25–30 yr, BA ~25 |
| Straatsma 2001 | Switzerland | P Jun–Oct | T Jul–Aug → timing | — |
| Brejon L. & Hoffman 2025 (preprint) | NW Germany, beech, **B. edulis daily** | P sum over 26 d (linear +) | 20-d mean ~13 °C optimum | — |
| Kauserud 2008 | Norway (phenology) | — | warm autumn/winter → later fruiting | — |

Sources: [Sánchez-González 2019](https://zaguan.unizar.es/record/96240/files/texto_completo.pdf); [Karavani 2018](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.agrformet.2017.10.024); [Alday 2017](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5382911/); [Bonet 2010](https://api.crossref.org/works/10.1139/X09-198); [Martínez-Peña 2012](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.foreco.2012.06.034); [Tahvanainen 2016](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.foreco.2015.11.040); [Straatsma 2001](https://europepmc.org/search?query=DOI%3A10.1017%2Fs0953756201004154); [Brejon Lamartinière & Hoffman 2025](https://europepmc.org/search?query=DOI%3A%2210.64898%2F2025.12.12.693895%22); [Kauserud 2008](https://api.crossref.org/works/10.1073/pnas.0709037105)

- Excessive late rain (November) reduced yields in Spain. — [Sánchez-González 2019](https://zaguan.unizar.es/record/96240/files/texto_completo.pdf)
- Climate–yield synchrony is strong in water-limited (Mediterranean) sites and weak in temperate and boreal sites. — [Collado et al. 2019](https://europepmc.org/search?query=DOI%3A10.1016%2Fj.scitotenv.2019.06.471)

### Inferences
- Brandenburg combines low rainfall (about 550 mm/yr) with sandy soils of low water-holding capacity. It is plausibly closer to the "water-limited" end of the gradient, where moisture signals are strongest. That favours using **soil moisture 3–9 cm** together with a 3–4-week rain sum as the primary drivers.
- Suggested daily index components derived from the literature (to be calibrated, not taken from any single paper):
  1. Antecedent precipitation over about 20–30 days, or mean soil moisture over the past 2–4 weeks.
  2. Mean air or soil temperature over about 20 days with a unimodal response peaking near 12–15 °C.
  3. A heat penalty early in the season.
  4. A static habitat factor (host tree, basal area, age).
- Chanterelle: no quantitative weather model exists in the reviewed literature. Its windows would have to be borrowed from the B. edulis and ECM group models.

### Gaps
- No study provides soil-temperature (6 cm) thresholds for either species.
- No validated chanterelle-specific weather windows were found.

---

## 6. Daily-scale, machine-learning and operational forecasting tools

### Takeaway
Peer-reviewed daily-scale models are almost absent. The Bielefeld B. edulis preprint (daily counts, lagged GLMM) is the closest. Operational tools exist (Czech CHMI daily map, Catalan CTFC seasonal forecasts, commercial apps), but none publishes peer-reviewed validation.

### Cited Findings
- **Czech Hydrometeorological Institute (ČHMÚ)** publishes a daily-updated map of mushroom-growth likelihood. It is based on **soil saturation from precipitation over the previous 30 days combined with mean temperature over the last 7 days**. [SNIPPET/SECONDARY, radio.cz/expats.cz, article not readable; no validation documented] — [Radio Prague International](https://english.radio.cz/node/8824253); [Expats.cz](https://www.expats.cz/czech-news/article/discover-prime-mushroom-picking-spots-across-czechia-with-a-new-map)
- **CTFC Catalonia** issues seasonal mushroom-yield forecasts from "mathematical models" using rain, high temperatures and wind. [Grey literature/press] — [Catalan News](https://catalannews.com/life-style/item/experts-predict-that-the-mushroom-season-this-autumn-will-be-below-the-average-of-the-last-17-years); [Catalan News 2](https://www.catalannews.com/life-style/item/good-forecast-for-mushroom-picking-this-autumn)
- **"Boletus" mushroom forecast map** (commercial app, eu.boletusmap.app) claims satellite data down to 30 m, real-time weather and soil data, refreshed daily with a 5-day outlook. [Grey/commercial, no methods or validation published] — [apkcombo listing](https://apkcombo.com/boletus-mushroom-forecast-map/eu.boletusmap.app.twa/)
- **Machine learning on ECM fruiting**: Steidinger et al. 2022 combined LMMs with machine learning on citizen-science truffle data (3-week resolution). This is the closest peer-reviewed ML example, but for a different species. — [Europe PMC](https://europepmc.org/search?query=DOI%3A10.1111%2Fgcb.16424)
- **Spore trapping**: "Mushroom Emergence Detected by Combining Spore Trapping with Molecular Techniques" (Applied and Environmental Microbiology 2017, DOI 10.1128/aem.00600-17) suggests an alternative way to monitor emergence. Not read. — [Europe PMC search result](https://europepmc.org/search?query=DOI%3A10.1128%2Faem.00600-17)

### Inferences
- The Czech ČHMÚ logic (30-day moisture plus 7-day temperature) is structurally very close to what Open-Meteo data allow in this project. With the Bielefeld windows (26 d rain, 20 d temperature) it forms a defensible baseline design, labelled as heuristic rather than validated.
- Without local fruiting observations, no metric (AUC/RMSE) can be claimed for a Brandenburg index. The owner's own find log would be the realistic validation source.

### Gaps
- ČHMÚ map URL, exact formula and thresholds could not be verified (site blocked).
- No peer-reviewed citizen-science forecasting model for B. edulis or C. cibarius found.
- Chanterelle daily phenology: no source found.
