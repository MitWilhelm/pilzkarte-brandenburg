# Pilzkarte Brandenburg

Private Pilz-Habitatkarte für Brandenburg: **wo** Steinpilz und Pfifferling
wachsen können (Heatmap aus Baumarten und Boden) und **wann** sich die Suche
lohnt (Wachstumsindex aus dem Wetter der letzten und kommenden Tage).

> Die Karte dient nur zur Orientierung. Sie ersetzt keine Pilzbestimmung.
> Funde vor dem Verzehr von einer Pilzberatungsstelle prüfen lassen.
> In Naturschutzgebieten kann das Sammeln verboten sein.

## Stand

Phase 1 (Daten). Testgebiete: Joachimsthal und Schwärzesee
(zwischen Eberswalde und Melchow).

## Datenquellen

Rohdaten liegen im Release [`daten-v1`](../../releases/tag/daten-v1),
nicht im Git.

| Datei | Inhalt | Quelle | Lizenz |
|---|---|---|---|
| `treespecies_de_2022.tif` | Dominante Baumart, 10 m, EPSG:3035 | [DLR Tree Species Germany](https://download.geoservice.dlr.de/TREE_SPECIES_DE/files/) | CC-BY-4.0 |
| `stok_25833.gml` | Forstliche Standortskarte (Nährkraft, Feuchte), EPSG:25833 | [Landesbetrieb Forst Brandenburg](https://www.brandenburg-forst.de/inspire/dls/stok/) | Datenlizenz Deutschland – Namensnennung 2.0 |
| `ifgk_wld_25833.gml` | Waldflächen der Forstgrundkarte, EPSG:25833 | [Landesbetrieb Forst Brandenburg](https://www.brandenburg-forst.de/inspire/dls/ifgk_wld/) | Datenlizenz Deutschland – Namensnennung 2.0 |

Im Repository (`daten/`):

| Datei | Inhalt | Quelle | Lizenz |
|---|---|---|---|
| `barnim_grenze_25833.geojson` | Grenze des Landkreises Barnim (AGS 12060), EPSG:25833 | [BKG VG250](https://sgx.geodatenzentrum.de/wfs_vg250), abgerufen am 04.10.2026 | Datenlizenz Deutschland – Namensnennung 2.0, „© GeoBasis-DE / BKG (2026)“ |

Zur Laufzeit (geplant):

| Daten | Quelle | Lizenz |
|---|---|---|
| Wetter, Bodentemperatur, Bodenfeuchte | [Open-Meteo](https://open-meteo.com) | CC-BY-4.0, nur nicht-kommerziell kostenlos |
| Hintergrundkarte | [OpenStreetMap](https://www.openstreetmap.org) | ODbL |

Quellenvermerke: „© DLR, CC-BY-4.0“ · „Landesbetrieb Forst Brandenburg,
dl-de/by-2-0“ · „Wetterdaten: Open-Meteo.com“ · „© OpenStreetMap-Mitwirkende“ · „© GeoBasis-DE / BKG (2026)“

## Regeln

Entwicklungsregeln: [`CLAUDE.md`](CLAUDE.md) ·
Entscheidungen: [`docs/decisions.md`](docs/decisions.md)
