"""Schneidet Baumarten und Standortflächen auf den Landkreis Barnim zu (daten/barnim_*).

Aufruf: python -m pipeline.io_barnim_zuschnitt <ordner-mit-rohdaten>  (Release daten-v1).
Anders als bei den Testgebieten liegt das Baumarten-Raster hier in EPSG:25833, passend zu Grenze und Standortflächen.
"""

import csv
import json
import math
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
from affine import Affine
from rasterio.features import geometry_mask
from rasterio.warp import Resampling, reproject, transform_bounds
from rasterio.windows import from_bounds
from shapely.geometry import shape
from shapely.geometry.base import BaseGeometry

from pipeline.gebiete import CODE_KEIN_WERT, zaehle_baumarten

__all__ = ["main"]

EPSG_DLR = 3035
EPSG_LFB = 25833
DATEI_BAUMARTEN = "treespecies_de_2022.tif"
DATEI_STANDORT = "stok_25833.gml"
LAYER_STANDORT = "SoilBody"
GRENZE = Path("daten/barnim_grenze_25833.geojson")
PUNKTE = Path("daten/barnim_stok_punkte.csv")
ZIEL_BAUMARTEN = Path("daten/barnim_baumarten.tif")
ZIEL_STANDORT = Path("daten/barnim_stok_25833.gpkg")
KREIS_AGS = "12060"  # Landkreis Barnim
PIXEL_METER = 10.0
# Rand um das umgerechnete Rechteck beim Lesen aus EPSG:3035, damit die Umprojektion an den Ecken Quellpixel hat.
LESERAND_METER = 100.0
PIXEL_IN_HEKTAR = 0.01
BYTE_IN_MB = 1_000_000


def _lies_grenze() -> BaseGeometry:
    merkmale = json.loads(GRENZE.read_text(encoding="utf-8"))["features"]
    if len(merkmale) != 1 or merkmale[0]["properties"]["ags"] != KREIS_AGS:
        raise ValueError(f"Invariante verletzt: {GRENZE} enthält nicht genau den Kreis {KREIS_AGS}")
    return shape(merkmale[0]["geometry"])


def _zielraster(grenze: BaseGeometry) -> tuple[Affine, tuple[int, int]]:
    # Auf volle 10 m gerundet, damit spätere 10-km-Kacheln ganze Pixel schneiden.
    links, unten, rechts, oben = grenze.bounds
    links, unten = math.floor(links / PIXEL_METER) * PIXEL_METER, math.floor(unten / PIXEL_METER) * PIXEL_METER
    rechts, oben = math.ceil(rechts / PIXEL_METER) * PIXEL_METER, math.ceil(oben / PIXEL_METER) * PIXEL_METER
    form = (round((oben - unten) / PIXEL_METER), round((rechts - links) / PIXEL_METER))
    return Affine(PIXEL_METER, 0.0, links, 0.0, -PIXEL_METER, oben), form


def schneide_baumarten(rohordner: Path, grenze: BaseGeometry) -> dict[str, int]:
    transform, form = _zielraster(grenze)
    links, oben = transform.c, transform.f
    rechteck_25833 = (links, oben - form[0] * PIXEL_METER, links + form[1] * PIXEL_METER, oben)
    ziel = np.full(form, CODE_KEIN_WERT, dtype=np.uint16)
    with rasterio.open(rohordner / DATEI_BAUMARTEN) as quelle:
        if quelle.crs.to_epsg() != EPSG_DLR:
            raise ValueError(f"Invariante verletzt: {DATEI_BAUMARTEN} hat EPSG {quelle.crs.to_epsg()}, erwartet 3035")
        links_q, unten_q, rechts_q, oben_q = transform_bounds(EPSG_LFB, EPSG_DLR, *rechteck_25833)
        fenster = (
            from_bounds(
                links_q - LESERAND_METER,
                unten_q - LESERAND_METER,
                rechts_q + LESERAND_METER,
                oben_q + LESERAND_METER,
                quelle.transform,
            )
            .round_offsets()
            .round_lengths()
        )
        werte = quelle.read(1, window=fenster)
        profil = quelle.profile.copy()
        # Nächster Nachbar: Die Werte sind Baumart-Codes, ein Mittelwert zweier Codes wäre sinnlos.
        reproject(
            source=werte,
            destination=ziel,
            src_transform=quelle.window_transform(fenster),
            src_crs=quelle.crs,
            src_nodata=CODE_KEIN_WERT,
            dst_transform=transform,
            dst_crs=f"EPSG:{EPSG_LFB}",
            dst_nodata=CODE_KEIN_WERT,
            resampling=Resampling.nearest,
        )
    ausserhalb = geometry_mask([grenze], out_shape=form, transform=transform)
    ziel[ausserhalb] = CODE_KEIN_WERT
    if np.all(ziel == CODE_KEIN_WERT):
        raise ValueError("Invariante verletzt: Barnim enthält keine Baumarten-Pixel")
    profil.update(width=form[1], height=form[0], transform=transform, crs=f"EPSG:{EPSG_LFB}")
    with rasterio.open(ZIEL_BAUMARTEN, "w", **profil) as datei:
        datei.write(ziel, 1)
    return zaehle_baumarten(ziel)


def _lies_kennungen() -> dict[str, str]:
    with PUNKTE.open(encoding="utf-8", newline="") as datei:
        zeilen = list(csv.DictReader(datei))
    kennungen = {zeile["lokale_id"]: zeile["id"] for zeile in zeilen}
    if len(kennungen) != len(zeilen):
        raise ValueError(f"Invariante verletzt: {PUNKTE} hat doppelte lokale_id ({len(zeilen) - len(kennungen)})")
    return kennungen


def schneide_flaechen(rohordner: Path, grenze: BaseGeometry) -> int:
    flaechen = gpd.read_file(rohordner / DATEI_STANDORT, layer=LAYER_STANDORT, bbox=grenze.bounds, engine="pyogrio")
    if flaechen.crs is None or flaechen.crs.to_epsg() != EPSG_LFB:
        raise ValueError(f"Invariante verletzt: Standortskarte hat CRS {flaechen.crs}, erwartet EPSG {EPSG_LFB}")
    # Dieselbe Regel wie pipeline/io_barnim_punkte.py: Eine Fläche zählt, wenn ihr Innenpunkt im Kreis liegt.
    is_im_kreis = flaechen.geometry.representative_point().within(grenze)
    im_kreis = flaechen.loc[is_im_kreis, ["localId", "geometry"]]
    kennungen = _lies_kennungen()
    gefunden = set(im_kreis["localId"].astype(str))
    if gefunden != set(kennungen):
        fehlend, zuviel = len(set(kennungen) - gefunden), len(gefunden - set(kennungen))
        raise ValueError(f"Invariante verletzt: Flächen passen nicht zu {PUNKTE} ({fehlend} fehlen, {zuviel} zu viel)")
    ergebnis = gpd.GeoDataFrame(
        {"id": [kennungen[str(kennung)] for kennung in im_kreis["localId"]]},
        geometry=im_kreis.geometry.to_numpy(),
        crs=flaechen.crs,
    )
    ergebnis.to_file(ZIEL_STANDORT, driver="GPKG")
    return len(ergebnis)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Aufruf: python -m pipeline.io_barnim_zuschnitt <ordner-mit-rohdaten>")
    rohordner = Path(sys.argv[1])
    grenze = _lies_grenze()
    anteile = schneide_baumarten(rohordner, grenze)
    gesamt = sum(anteile.values())
    for name, anzahl in sorted(anteile.items(), key=lambda paar: -paar[1]):
        print(f"  {name:<14} {anzahl * PIXEL_IN_HEKTAR:9.1f} ha  {100 * anzahl / gesamt:5.1f} %")
    print(f"Standortflächen: {schneide_flaechen(rohordner, grenze)}")
    for ziel in (ZIEL_BAUMARTEN, ZIEL_STANDORT):
        print(f"{ziel}: {ziel.stat().st_size / BYTE_IN_MB:.1f} MB")


if __name__ == "__main__":
    main()
