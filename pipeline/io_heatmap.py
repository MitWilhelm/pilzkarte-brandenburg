"""Berechnet die Habitat-Heatmaps je Testgebiet und Pilzart und schreibt daten/<gebiet>_<pilz>_habitat.tif.

Liest die zugeschnittenen Baumarten (EPSG:3035) und Standortflächen (EPSG:25833) samt
LFB-Antworten; die Flächen werden auf das 10-m-Raster der Baumarten gebrannt.
"""

import json
from pathlib import Path

import geopandas as gpd
import numpy as np
import numpy.typing as npt
import rasterio
from rasterio.features import rasterize

from pipeline.gebiete import CODE_KEIN_WERT, TESTGEBIETE
from pipeline.habitat import PILZARTEN, Pilzart, Standortanteil, anzeige_stufe, baumart_punkte, boden_punkte

__all__ = ["main"]

DATEN = Path("daten")
OHNE_BODEN = -1.0
PIXEL_IN_HEKTAR = 0.01
STUFEN_GRENZEN = (60, 70, 80, 90)


def _lies_anteile() -> dict[str, list[Standortanteil]]:
    anteile: dict[str, list[Standortanteil]] = {}
    with (DATEN / "stok_antworten.jsonl").open(encoding="utf-8") as datei:
        for zeile in datei:
            eintrag = json.loads(zeile)
            if eintrag["status"] != 200:
                raise ValueError(f"Invariante verletzt: {eintrag['id']} hat Status {eintrag['status']}")
            merkmale = json.loads(eintrag["text"])["features"][0]["properties"]
            # nfgr4 hat kein Anteilsfeld (az4) und die Anteile az1..az3 ergeben ohne ihn immer 10/10;
            # er ist also kein vierter Flächenanteil, sondern eine Zusatzangabe und wird nicht bewertet.
            anteile[eintrag["id"]] = [
                Standortanteil(code=merkmale[f"nfgr{nummer}"], anteil=merkmale[f"az{nummer}"])
                for nummer in (1, 2, 3)
                if merkmale[f"nfgr{nummer}"] != ""
            ]
    return anteile


def _boden_raster(gebiet_name: str, pilz: Pilzart, anteile: dict[str, list[Standortanteil]]) -> npt.NDArray[np.float32]:
    with rasterio.open(DATEN / f"{gebiet_name}_baumarten.tif") as quelle:
        form, transform, crs = (quelle.height, quelle.width), quelle.transform, quelle.crs
    flaechen = gpd.read_file(DATEN / f"{gebiet_name}_stok_25833.gpkg").to_crs(crs)
    werte = [boden_punkte(pilz, anteile[f"{gebiet_name}-{nummer}"]) for nummer in range(len(flaechen))]
    gebrannt = rasterize(
        zip(flaechen.geometry, werte, strict=True),
        out_shape=form,
        transform=transform,
        fill=OHNE_BODEN,
        dtype="float32",
    )
    return np.asarray(gebrannt, dtype=np.float32)


def _heatmap(baumarten: npt.NDArray[np.uint16], boden: npt.NDArray[np.float32], pilz: Pilzart) -> npt.NDArray[np.uint8]:
    ergebnis = np.zeros(baumarten.shape, dtype=np.uint8)
    for code in np.unique(baumarten).tolist():
        if code == CODE_KEIN_WERT:
            continue
        maske = (baumarten == code) & (boden != OHNE_BODEN)
        for bodenwert in np.unique(boden[maske]).tolist():
            ergebnis[maske & (boden == bodenwert)] = anzeige_stufe(baumart_punkte(pilz, code) * bodenwert)
    return ergebnis


def main() -> None:
    anteile = _lies_anteile()
    for gebiet in TESTGEBIETE:
        with rasterio.open(DATEN / f"{gebiet.name}_baumarten.tif") as quelle:
            baumarten = quelle.read(1)
            profil = quelle.profile.copy()
        profil.update(dtype="uint8", nodata=0)
        for pilz in PILZARTEN:
            stufen = _heatmap(baumarten, _boden_raster(gebiet.name, pilz, anteile), pilz)
            with rasterio.open(DATEN / f"{gebiet.name}_{pilz}_habitat.tif", "w", **profil) as ziel:
                ziel.write(stufen, 1)
            grenzen = np.digitize(stufen[stufen > 0], STUFEN_GRENZEN)
            hektar = [f"{(grenzen == i).sum() * PIXEL_IN_HEKTAR:6.0f}" for i in range(len(STUFEN_GRENZEN) + 1)]
            print(f"{gebiet.name:<13} {pilz:<12} ha je Stufe 50-59|60-69|70-79|80-89|90-100: {' |'.join(hektar)}")


if __name__ == "__main__":
    main()
