"""Berechnet die Habitat-Heatmaps je Testgebiet und Pilzart und schreibt daten/<gebiet>_<pilz>_habitat.tif.

Liest Baumarten (EPSG:3035), Standortflächen (EPSG:25833) und LFB-Antworten; die Flächen werden
auf das 10-m-Raster gebrannt, mit dem Mischfaktor verrechnet und relativ zum Gebiet gestuft.
"""

import json
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
    mit_wegrand,
    relative_stufen,
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


def lies_anteile(dateien: tuple[Path, ...]) -> dict[str, list[Standortanteil]]:
    """Bodenanteile je Flächen-ID aus einer oder mehreren Antwortdateien der LFB-Abfrage.

    Fehlgeschlagene Abfragen (Status ≠ 200) werden in späteren Dateien wiederholt (Nachholer); je ID zählt die
    eine erfolgreiche Antwort. Eine ID ganz ohne Erfolg oder mit zwei Erfolgen ist ein Datenfehler.
    """
    anteile: dict[str, list[Standortanteil]] = {}
    fehlgeschlagen: dict[str, int] = {}
    for pfad in dateien:
        with pfad.open(encoding="utf-8") as datei:
            for zeile in datei:
                eintrag = json.loads(zeile)
                kennung = eintrag["id"]
                if eintrag["status"] != 200:
                    fehlgeschlagen[kennung] = eintrag["status"]
                    continue
                if kennung in anteile:
                    raise ValueError(f"Invariante verletzt: {kennung} hat mehr als eine erfolgreiche Antwort")
                merkmale = json.loads(eintrag["text"])["features"][0]["properties"]
                # nfgr4 hat kein Anteilsfeld (az4) und die Anteile az1..az3 ergeben ohne ihn immer 10/10;
                # er ist also kein vierter Flächenanteil, sondern eine Zusatzangabe und wird nicht bewertet.
                anteile[kennung] = [
                    Standortanteil(code=merkmale[f"nfgr{nummer}"], anteil=merkmale[f"az{nummer}"])
                    for nummer in (1, 2, 3)
                    if merkmale[f"nfgr{nummer}"] != ""
                ]
    ohne_erfolg = sorted(set(fehlgeschlagen) - set(anteile))
    if len(ohne_erfolg) > 0:
        beispiel = ohne_erfolg[0]
        raise ValueError(
            f"Invariante verletzt: {len(ohne_erfolg)} IDs ohne erfolgreiche Antwort, "
            f"z. B. {beispiel} mit Status {fehlgeschlagen[beispiel]}"
        )
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
    baumarten: npt.NDArray[np.uint16],
    boden: npt.NDArray[np.float32],
    pilz_und_wege: tuple[Pilzart, npt.NDArray[np.bool_]],
) -> npt.NDArray[np.uint8]:
    pilz, is_nahe_weg = pilz_und_wege
    # Pixel ohne Standortfläche (Rand des Ausschnitts, Nicht-Holzboden) gelten als kein Habitat.
    boden_oder_null = np.where(boden == OHNE_BODEN, 0.0, boden).astype(np.float32)
    misch = mischfaktor(baumarten, wirt_codes(pilz))
    wert = gesamtwert(_baum_raster(baumarten, pilz), boden_oder_null, misch)
    return relative_stufen(mit_wegrand(wert, is_nahe_weg))


def main() -> None:
    anteile = lies_anteile((DATEN / "stok_antworten.jsonl",))
    for gebiet in TESTGEBIETE:
        with rasterio.open(DATEN / f"{gebiet.name}_baumarten.tif") as quelle:
            baumarten = quelle.read(1)
            profil = quelle.profile.copy()
        profil.update(dtype="uint8", nodata=0)
        is_nahe_weg = _wege_maske(gebiet.name)
        for pilz in PILZARTEN:
            stufen = _heatmap(baumarten, _boden_raster(gebiet.name, pilz, anteile), (pilz, is_nahe_weg))
            with rasterio.open(DATEN / f"{gebiet.name}_{pilz}_habitat.tif", "w", **profil) as ziel:
                ziel.write(stufen, 1)
            grenzen = np.digitize(stufen[stufen > 0], STUFEN_GRENZEN)
            hektar = [f"{(grenzen == i).sum() * PIXEL_IN_HEKTAR:6.0f}" for i in range(len(STUFEN_GRENZEN) + 1)]
            print(f"{gebiet.name:<13} {pilz:<12} ha je Stufe 50-59|60-69|70-79|80-89|90-100: {' |'.join(hektar)}")


if __name__ == "__main__":
    main()
