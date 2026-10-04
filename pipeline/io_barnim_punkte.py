"""Berechnet je Standortfläche im Landkreis Barnim einen Abfragepunkt im Inneren (daten/barnim_stok_punkte.csv).

Aufruf: python -m pipeline.io_barnim_punkte <stok_25833.gml>  (Rohdatei aus dem Release daten-v1).
Die Kreisgrenze (BKG VG250, EPSG:25833) liegt als daten/barnim_grenze_25833.geojson im Repository.
Eine Fläche zählt zum Landkreis, wenn ihr Innenpunkt in der Kreisgrenze liegt.
"""

import csv
import json
import sys
from pathlib import Path

import geopandas as gpd
from shapely.geometry import shape

__all__ = ["main"]

EPSG_LFB = 25833
LAYER_STANDORT = "SoilBody"
GRENZE = Path("daten/barnim_grenze_25833.geojson")
ZIELDATEI = Path("daten/barnim_stok_punkte.csv")
NACHKOMMASTELLEN_METER = 1
KREIS_AGS = "12060"  # Landkreis Barnim


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Aufruf: python -m pipeline.io_barnim_punkte <stok_25833.gml>")
    inhalt = json.loads(GRENZE.read_text(encoding="utf-8"))
    merkmale = inhalt["features"]
    if len(merkmale) != 1 or merkmale[0]["properties"]["ags"] != KREIS_AGS:
        raise ValueError(f"Invariante verletzt: {GRENZE} enthält nicht genau den Kreis {KREIS_AGS}")
    grenze = shape(merkmale[0]["geometry"])
    flaechen = gpd.read_file(sys.argv[1], layer=LAYER_STANDORT, bbox=grenze.bounds, engine="pyogrio")
    if flaechen.crs is None or flaechen.crs.to_epsg() != EPSG_LFB:
        raise ValueError(f"Invariante verletzt: Standortskarte hat CRS {flaechen.crs}, erwartet EPSG {EPSG_LFB}")
    # representative_point liegt garantiert innerhalb der Fläche, der Schwerpunkt nicht immer.
    punkte = flaechen.geometry.representative_point()
    zeilen: list[dict[str, str]] = []
    for kennung, punkt in zip(flaechen["localId"], punkte, strict=True):
        if grenze.contains(punkt):
            zeilen.append(
                {
                    "id": f"barnim-{len(zeilen)}",
                    "x": f"{punkt.x:.{NACHKOMMASTELLEN_METER}f}",
                    "y": f"{punkt.y:.{NACHKOMMASTELLEN_METER}f}",
                    "lokale_id": str(kennung),
                }
            )
    with ZIELDATEI.open("w", newline="", encoding="utf-8") as datei:
        schreiber = csv.DictWriter(datei, fieldnames=["id", "x", "y", "lokale_id"])
        schreiber.writeheader()
        schreiber.writerows(zeilen)
    print(f"{len(zeilen)} Punkte nach {ZIELDATEI} geschrieben")


if __name__ == "__main__":
    main()
