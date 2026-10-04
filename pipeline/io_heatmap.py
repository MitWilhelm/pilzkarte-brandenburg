"""Berechnet die Habitat-Heatmaps je Testgebiet und Pilzart und schreibt daten/<gebiet>_<pilz>_habitat.tif.

Liest Baumarten (EPSG:3035), Standortflächen (EPSG:25833) und LFB-Antworten; die Flächen werden
auf das 10-m-Raster gebrannt, mit dem Mischfaktor verrechnet und relativ zum Gebiet gestuft.
"""

import json
from dataclasses import dataclass
from pathlib import Path

import geopandas as gpd
import numpy as np
import numpy.typing as npt
import rasterio
from rasterio.features import rasterize

from pipeline.gebiete import CODE_KEIN_WERT, TESTGEBIETE
from pipeline.habitat import (
    PILZARTEN,
    Pilzart,
    Standortanteil,
    baumart_punkte,
    boden_punkte,
    gesamtwert,
    hangfaktor,
    mit_wegrand,
    relative_stufen,
    strukturfaktor,
    wirt_codes,
)
from pipeline.nachbarschaft import in_der_naehe, mischfaktor

__all__ = ["lies_anteile", "main"]

DATEN = Path("daten")
OHNE_BODEN = -1.0
PIXEL_IN_HEKTAR = 0.01
STUFEN_GRENZEN = (60, 70, 80, 90)
WEGE = Path("web/public/daten")  # OSM-Wege aus pipeline/io_waldwege.py (EPSG:4326)
EPSG_WGS84 = 4326
WEGRAND_RADIUS_PIXEL = 2  # 5 x 5 Pixel: bis etwa 20–25 m neben dem Weg
# Nur Forstwege und Pfade: Die Belege (dünnere Streu, mehr Licht) betreffen Waldwege; an Autostraßen kommen
# Stickstoff, Salz und Staub hinzu, dafür gibt es keinen Beleg für mehr Fruchtkörper.
WEGRAND_ARTEN = ("weg", "pfad")
STRUKTUR_BAENDER = 3  # Kronenhöhe, Kronenschluss, Gelände (pipeline/io_hoehe.py)
PIXEL_METER = 10.0


def lies_anteile() -> dict[str, list[Standortanteil]]:
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


@dataclass(frozen=True)
class Umfeld:
    """Ortsmerkmale außer Baum und Boden: Wegnähe, Kronenhöhe, Kronenschluss und Gelände (je 10-m-Pixel)."""

    is_nahe_weg: npt.NDArray[np.bool_]
    kronenhoehe: npt.NDArray[np.float32]
    kronenschluss: npt.NDArray[np.float32]
    gelaende: npt.NDArray[np.float32]


def _lies_struktur(gebiet_name: str, form: tuple[int, int]) -> tuple[npt.NDArray[np.float32], ...]:
    pfad = DATEN / f"{gebiet_name}_struktur.tif"
    with rasterio.open(pfad) as quelle:
        if (quelle.height, quelle.width) != form or quelle.count != STRUKTUR_BAENDER:
            raise ValueError(f"Invariante verletzt: {pfad} hat {quelle.count} Bänder und Form {quelle.shape}")
        return tuple(quelle.read(band).astype(np.float32) for band in range(1, STRUKTUR_BAENDER + 1))


def _wege_maske(gebiet_name: str) -> npt.NDArray[np.bool_]:
    with rasterio.open(DATEN / f"{gebiet_name}_baumarten.tif") as quelle:
        form, transform, crs = (quelle.height, quelle.width), quelle.transform, quelle.crs
    wege = gpd.read_file(WEGE / f"{gebiet_name}_wege.geojson")
    if wege.crs is None or wege.crs.to_epsg() != EPSG_WGS84:
        raise ValueError(f"Invariante verletzt: Wege {gebiet_name} haben CRS {wege.crs}, erwartet EPSG {EPSG_WGS84}")
    if "art" not in wege.columns:
        raise ValueError(f"Invariante verletzt: Wege {gebiet_name} ohne Spalte 'art': {list(wege.columns)}")
    waldwege = wege.loc[wege["art"].isin(WEGRAND_ARTEN)]
    gebrannt = rasterize(
        ((geometrie, 1) for geometrie in waldwege.to_crs(crs).geometry),
        out_shape=form,
        transform=transform,
        fill=0,
        all_touched=True,
        dtype="uint8",
    )
    return in_der_naehe(np.asarray(gebrannt) == 1, WEGRAND_RADIUS_PIXEL)


def _baum_raster(baumarten: npt.NDArray[np.uint16], pilz: Pilzart) -> npt.NDArray[np.float32]:
    ergebnis = np.zeros(baumarten.shape, dtype=np.float32)
    for code in np.unique(baumarten).tolist():
        if code != CODE_KEIN_WERT:
            ergebnis[baumarten == code] = baumart_punkte(pilz, code)
    return ergebnis


def _heatmap(
    baumarten: npt.NDArray[np.uint16], boden: npt.NDArray[np.float32], art_und_umfeld: tuple[Pilzart, Umfeld]
) -> npt.NDArray[np.uint8]:
    pilz, umfeld = art_und_umfeld
    # Pixel ohne Standortfläche (Rand des Ausschnitts, Nicht-Holzboden) gelten als kein Habitat.
    boden_oder_null = np.where(boden == OHNE_BODEN, 0.0, boden).astype(np.float32)
    misch = mischfaktor(baumarten, wirt_codes(pilz))
    wert = gesamtwert(_baum_raster(baumarten, pilz), boden_oder_null, misch)
    struktur = strukturfaktor(pilz, umfeld.kronenhoehe, umfeld.kronenschluss)
    gelaende = hangfaktor(umfeld.gelaende, PIXEL_METER)
    mit_ort = np.minimum(wert * struktur * gelaende, 1.0).astype(np.float32)
    return relative_stufen(mit_wegrand(mit_ort, umfeld.is_nahe_weg))


def main() -> None:
    anteile = lies_anteile()
    for gebiet in TESTGEBIETE:
        with rasterio.open(DATEN / f"{gebiet.name}_baumarten.tif") as quelle:
            baumarten = quelle.read(1)
            profil = quelle.profile.copy()
        profil.update(dtype="uint8", nodata=0)
        kronenhoehe, kronenschluss, gelaende = _lies_struktur(gebiet.name, baumarten.shape)
        umfeld = Umfeld(_wege_maske(gebiet.name), kronenhoehe, kronenschluss, gelaende)
        for pilz in PILZARTEN:
            stufen = _heatmap(baumarten, _boden_raster(gebiet.name, pilz, anteile), (pilz, umfeld))
            with rasterio.open(DATEN / f"{gebiet.name}_{pilz}_habitat.tif", "w", **profil) as ziel:
                ziel.write(stufen, 1)
            grenzen = np.digitize(stufen[stufen > 0], STUFEN_GRENZEN)
            hektar = [f"{(grenzen == i).sum() * PIXEL_IN_HEKTAR:6.0f}" for i in range(len(STUFEN_GRENZEN) + 1)]
            print(f"{gebiet.name:<13} {pilz:<12} ha je Stufe 50-59|60-69|70-79|80-89|90-100: {' |'.join(hektar)}")


if __name__ == "__main__":
    main()
