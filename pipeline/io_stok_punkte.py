"""Berechnet je Standortfläche einen Abfragepunkt im Inneren und schreibt daten/stok_punkte.csv.

Läuft lokal (braucht geopandas). Die Punkte werden danach von pipeline/io_stok_abfrage.py
auf GitHub Actions beim Kartendienst des Landesbetriebs Forst abgefragt.
"""

import csv
from pathlib import Path

import geopandas as gpd

from pipeline.gebiete import TESTGEBIETE

__all__ = ["main"]

ZIELDATEI = Path("daten/stok_punkte.csv")
EPSG_LFB = 25833
NACHKOMMASTELLEN_METER = 1


def main() -> None:
    zeilen: list[dict[str, str]] = []
    for gebiet in TESTGEBIETE:
        flaechen = gpd.read_file(f"daten/{gebiet.name}_stok_25833.gpkg")
        if flaechen.crs is None or flaechen.crs.to_epsg() != EPSG_LFB:
            raise ValueError(f"Invariante verletzt: {gebiet.name} hat CRS {flaechen.crs}, erwartet EPSG {EPSG_LFB}")
        # representative_point liegt garantiert innerhalb der Fläche, der Schwerpunkt nicht immer.
        for nummer, geometrie in enumerate(flaechen.geometry):
            punkt = geometrie.representative_point()
            zeilen.append(
                {
                    "id": f"{gebiet.name}-{nummer}",
                    "x": f"{punkt.x:.{NACHKOMMASTELLEN_METER}f}",
                    "y": f"{punkt.y:.{NACHKOMMASTELLEN_METER}f}",
                }
            )
    with ZIELDATEI.open("w", newline="", encoding="utf-8") as datei:
        schreiber = csv.DictWriter(datei, fieldnames=["id", "x", "y"])
        schreiber.writeheader()
        schreiber.writerows(zeilen)
    print(f"{len(zeilen)} Punkte nach {ZIELDATEI} geschrieben")


if __name__ == "__main__":
    main()
