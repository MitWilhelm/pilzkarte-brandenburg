"""Schneidet die Rohdaten (Release daten-v1) auf die Testgebiete zu und schreibt sie nach daten/.

Aufruf: python -m pipeline.io_zuschnitt <ordner-mit-rohdaten>
Einziges Modul mit Dateizugriff in diesem Schritt (Regel 5).
"""

import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from shapely.geometry import box

from pipeline.gebiete import CODE_KEIN_WERT, TESTGEBIETE, Untersuchungsgebiet, ausschnitt_in, zaehle_baumarten

__all__ = ["main"]

EPSG_DLR = 3035
EPSG_LFB = 25833
DATEI_BAUMARTEN = "treespecies_de_2022.tif"
DATEI_STANDORT = "stok_25833.gml"
DATEI_WALD = "ifgk_wld_25833.gml"
LAYER_STANDORT = "SoilBody"
LAYER_WALD = "ExistingLandUseObject"
PIXEL_IN_HEKTAR = 0.01  # 10 m x 10 m = 100 m² = 0,01 ha
ZIELORDNER = Path("daten")


def _pruefe_crs(gefunden: int | None, erwartet: int, quelle: str) -> None:
    if gefunden != erwartet:
        raise ValueError(f"Invariante verletzt: {quelle} hat EPSG {gefunden}, erwartet {erwartet}")


def schneide_baumarten(rohordner: Path, gebiet: Untersuchungsgebiet) -> dict[str, int]:
    ausschnitt = ausschnitt_in(gebiet, EPSG_DLR)
    with rasterio.open(rohordner / DATEI_BAUMARTEN) as quelle:
        _pruefe_crs(quelle.crs.to_epsg(), EPSG_DLR, DATEI_BAUMARTEN)
        fenster = from_bounds(ausschnitt.links, ausschnitt.unten, ausschnitt.rechts, ausschnitt.oben, quelle.transform)
        werte = quelle.read(1, window=fenster).astype(np.uint16)
        profil = quelle.profile.copy()
        profil.update(width=werte.shape[1], height=werte.shape[0], transform=quelle.window_transform(fenster))
    with rasterio.open(ZIELORDNER / f"{gebiet.name}_baumarten.tif", "w", **profil) as ziel:
        ziel.write(werte, 1)
    if np.all(werte == CODE_KEIN_WERT):
        raise ValueError(f"Invariante verletzt: {gebiet.name} enthält keine Baumarten-Pixel")
    return zaehle_baumarten(werte)


def schneide_flaechen(rohordner: Path, gebiet: Untersuchungsgebiet, datei_und_layer: tuple[str, str]) -> int:
    datei, layer = datei_und_layer
    ausschnitt = ausschnitt_in(gebiet, EPSG_LFB)
    rechteck = (ausschnitt.links, ausschnitt.unten, ausschnitt.rechts, ausschnitt.oben)
    flaechen = gpd.read_file(rohordner / datei, layer=layer, bbox=rechteck)
    _pruefe_crs(flaechen.crs.to_epsg() if flaechen.crs is not None else None, EPSG_LFB, datei)
    zugeschnitten = gpd.clip(flaechen[["geometry"]], box(*rechteck))
    ziel = ZIELORDNER / f"{gebiet.name}_{Path(datei).stem}.gpkg"
    zugeschnitten.to_file(ziel, driver="GPKG")
    return len(zugeschnitten)


def main(rohordner: Path) -> None:
    ZIELORDNER.mkdir(exist_ok=True)
    for gebiet in TESTGEBIETE:
        print(f"== {gebiet.name}")
        anteile = schneide_baumarten(rohordner, gebiet)
        gesamt = sum(anteile.values())
        for name, anzahl in sorted(anteile.items(), key=lambda paar: -paar[1]):
            print(f"  {name:<14} {anzahl * PIXEL_IN_HEKTAR:8.1f} ha  {100 * anzahl / gesamt:5.1f} %")
        print(f"  Standortflächen: {schneide_flaechen(rohordner, gebiet, (DATEI_STANDORT, LAYER_STANDORT))}")
        print(f"  Waldflächen:     {schneide_flaechen(rohordner, gebiet, (DATEI_WALD, LAYER_WALD))}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
