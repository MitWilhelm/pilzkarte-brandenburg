"""Berechnet die Habitat-Heatmaps für den Landkreis Barnim und schreibt daten/barnim_<pilz>_habitat.tif.

Aufruf: python -m pipeline.io_heatmap
Liest Baumarten und Standortflächen (EPSG:25833) und die LFB-Antworten; die Flächen werden auf das 10-m-Raster
gebrannt, mit dem Mischfaktor verrechnet und relativ zu ganz Barnim gestuft.
"""

import json
from pathlib import Path

import geopandas as gpd
import numpy as np
import numpy.typing as npt
import rasterio
from affine import Affine
from rasterio.features import rasterize

from pipeline.gebiete import CODE_KEIN_WERT
from pipeline.habitat import (
    ANTEILE_GESAMT,
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
EPSG_WGS84 = 4326
WEGRAND_RADIUS_PIXEL = 2  # 5 x 5 Pixel: bis etwa 20–25 m neben dem Weg
# Nur Forstwege und Pfade: Die Belege (dünnere Streu, mehr Licht) betreffen Waldwege; an Autostraßen kommen
# Stickstoff, Salz und Staub hinzu, dafür gibt es keinen Beleg für mehr Fruchtkörper.
WEGRAND_ARTEN = ("weg", "pfad")
BARNIM_ANTWORTEN = (
    DATEN / "barnim_stok_antworten_1.jsonl",
    DATEN / "barnim_stok_antworten_2.jsonl",
    DATEN / "barnim_stok_antworten_nachholen.jsonl",
)
BARNIM_WEGE = Path("web/public/daten/barnim")  # je 10-km-Kachel, nur Wege im Wald (pipeline/io_waldwege.py, EPSG:4326)
EPSG_LFB = 25833
OHNE_FLAECHE = -1


def _ohne_wiederholung(eintraege: list[Standortanteil]) -> list[Standortanteil]:
    # LFB-Datenfehler (15 Barnim-Flächen): derselbe Code dreifach mit falscher Summe, z. B. M2 10/10/10 oder K2 4/4/4.
    # Gemeint ist eine Fläche mit nur diesem Standort. Andere falsche Summen meldet boden_punkte als Invariante.
    codes = {eintrag.code for eintrag in eintraege}
    summe = sum(eintrag.anteil for eintrag in eintraege)
    if len(eintraege) > 1 and len(codes) == 1 and summe != ANTEILE_GESAMT:
        return [Standortanteil(code=eintraege[0].code, anteil=ANTEILE_GESAMT)]
    return eintraege


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
                eintraege = [
                    Standortanteil(code=merkmale[f"nfgr{nummer}"], anteil=merkmale[f"az{nummer}"])
                    for nummer in (1, 2, 3)
                    if merkmale[f"nfgr{nummer}"] != ""
                ]
                anteile[kennung] = _ohne_wiederholung(eintraege)
    ohne_erfolg = sorted(set(fehlgeschlagen) - set(anteile))
    if len(ohne_erfolg) > 0:
        beispiel = ohne_erfolg[0]
        raise ValueError(
            f"Invariante verletzt: {len(ohne_erfolg)} IDs ohne erfolgreiche Antwort, "
            f"z. B. {beispiel} mit Status {fehlgeschlagen[beispiel]}"
        )
    return anteile


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


def _barnim_boden(
    flaechen: gpd.GeoDataFrame, raster: tuple[tuple[int, int], Affine], anteile: dict[str, list[Standortanteil]]
) -> dict[Pilzart, npt.NDArray[np.float32]]:
    form, transform = raster
    if flaechen.crs is None or flaechen.crs.to_epsg() != EPSG_LFB:
        raise ValueError(f"Invariante verletzt: Barnim-Flächen haben CRS {flaechen.crs}, erwartet EPSG {EPSG_LFB}")
    fehlend = sorted(set(flaechen["id"]) - set(anteile))
    if len(fehlend) > 0:
        raise ValueError(f"Invariante verletzt: {len(fehlend)} Flächen ohne Bodenantwort, z. B. {fehlend[0]}")
    # Einmal die Flächennummer brennen, dann je Pilzart nur nachschlagen (21.763 Flächen auf ~30 Mio. Pixel).
    nummern = np.asarray(
        rasterize(
            zip(flaechen.geometry, range(len(flaechen)), strict=True),
            out_shape=form,
            transform=transform,
            fill=OHNE_FLAECHE,
            dtype="int32",
        )
    )
    ergebnis: dict[Pilzart, npt.NDArray[np.float32]] = {}
    for pilz in PILZARTEN:
        # 14 Flächen haben nur Sonderangaben (z. B. "Sol_bn") ohne bewertbare Bodengruppe: wie Pixel ohne Fläche.
        werte = [OHNE_BODEN if len(anteile[k]) == 0 else boden_punkte(pilz, anteile[k]) for k in flaechen["id"]]
        nachschlag = np.asarray([*werte, OHNE_BODEN], dtype=np.float32)  # Index -1 trifft das letzte Element
        ergebnis[pilz] = nachschlag[nummern]
    return ergebnis


def _barnim_wege_maske(raster: tuple[tuple[int, int], Affine]) -> npt.NDArray[np.bool_]:
    form, transform = raster
    dateien = sorted(BARNIM_WEGE.glob("barnim_*_wege.geojson"))
    if len(dateien) == 0:
        raise ValueError(f"Invariante verletzt: keine Wege-Kacheln in {BARNIM_WEGE}")
    linien = []
    for datei in dateien:
        wege = gpd.read_file(datei)
        if len(wege) == 0:
            continue
        if wege.crs is None or wege.crs.to_epsg() != EPSG_WGS84:
            raise ValueError(f"Invariante verletzt: {datei.name} hat CRS {wege.crs}, erwartet EPSG {EPSG_WGS84}")
        linien.extend(wege.loc[wege["art"].isin(WEGRAND_ARTEN)].to_crs(EPSG_LFB).geometry)
    gebrannt = rasterize(
        ((linie, 1) for linie in linien), out_shape=form, transform=transform, fill=0, all_touched=True, dtype="uint8"
    )
    return in_der_naehe(np.asarray(gebrannt) == 1, WEGRAND_RADIUS_PIXEL)


def _barnim() -> None:
    with rasterio.open(DATEN / "barnim_baumarten.tif") as quelle:
        if quelle.crs.to_epsg() != EPSG_LFB:
            raise ValueError(
                f"Invariante verletzt: barnim_baumarten.tif hat EPSG {quelle.crs.to_epsg()}, erwartet {EPSG_LFB}"
            )
        baumarten = quelle.read(1)
        profil = quelle.profile.copy()
        raster = ((quelle.height, quelle.width), quelle.transform)
    profil.update(dtype="uint8", nodata=0)
    boden = _barnim_boden(gpd.read_file(DATEN / "barnim_stok_25833.gpkg"), raster, lies_anteile(BARNIM_ANTWORTEN))
    is_nahe_weg = _barnim_wege_maske(raster)
    for pilz in PILZARTEN:
        stufen = _heatmap(baumarten, boden[pilz], (pilz, is_nahe_weg))
        with rasterio.open(DATEN / f"barnim_{pilz}_habitat.tif", "w", **profil) as ziel:
            ziel.write(stufen, 1)
        _melde_stufen("barnim", pilz, stufen)


def _melde_stufen(gebiet_name: str, pilz: Pilzart, stufen: npt.NDArray[np.uint8]) -> None:
    grenzen = np.digitize(stufen[stufen > 0], STUFEN_GRENZEN)
    hektar = [f"{(grenzen == i).sum() * PIXEL_IN_HEKTAR:6.0f}" for i in range(len(STUFEN_GRENZEN) + 1)]
    print(f"{gebiet_name:<13} {pilz:<12} ha je Stufe 50-59|60-69|70-79|80-89|90-100: {' |'.join(hektar)}")


def main() -> None:
    _barnim()


if __name__ == "__main__":
    main()
