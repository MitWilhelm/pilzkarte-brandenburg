"""Exportiert je Testgebiet die Daten für die Webseite nach web/public/daten/.

<gebiet>.png: Daten-Bild in Web-Mercator (EPSG:3857), R = Baumart-Index, G = Steinpilz-Stufe,
B = Pfifferling-Stufe, A = 255. Dazu <gebiet>.json (Ecken in WGS84) und <gebiet>_boden.geojson.
"""

import json
from pathlib import Path

import geopandas as gpd
import numpy as np
import numpy.typing as npt
import rasterio
from pyproj import Transformer
from rasterio.warp import Resampling, calculate_default_transform, reproject

from pipeline.gebiete import CODE_KEIN_WERT, TESTGEBIETE, Untersuchungsgebiet
from pipeline.habitat import beschreibe_standort
from pipeline.io_heatmap import lies_anteile

__all__ = ["main"]

DATEN = Path("daten")
ZIEL = Path("web/public/daten")
EPSG_WEB = 3857
EPSG_WGS84 = 4326
CODE_KRONENVERLUST = 666
INDEX_KRONENVERLUST = 10  # passt in einen Farbkanal; 0..9 sind die übrigen DLR-Codes
INDEX_KEIN_WERT = 255
UNDURCHSICHTIG = 255
VEREINFACHUNG_METER = 3.0  # Bodenflächen: 3 m Toleranz reicht für die Karte und spart Platz
NACHKOMMASTELLEN_GRAD = 6
ANZEIGENAMEN = {"joachimsthal": "Joachimsthal", "schwaerzesee": "Schwärzesee"}


def _nach_mercator(
    quelle_pfad: Path, ziel_form: tuple[int, int], ziel_transform: rasterio.Affine
) -> npt.NDArray[np.uint16]:
    with rasterio.open(quelle_pfad) as quelle:
        ziel = np.full(ziel_form, CODE_KEIN_WERT, dtype=np.uint16)
        # Nearest, weil Baumart-Codes und Stufen Klassen sind und nicht gemittelt werden dürfen.
        reproject(
            source=rasterio.band(quelle, 1),
            destination=ziel,
            dst_transform=ziel_transform,
            dst_crs=f"EPSG:{EPSG_WEB}",
            resampling=Resampling.nearest,
            dst_nodata=CODE_KEIN_WERT,
        )
    return ziel


def _baumart_index(codes: npt.NDArray[np.uint16]) -> npt.NDArray[np.uint8]:
    ergebnis = np.full(codes.shape, INDEX_KEIN_WERT, dtype=np.uint8)
    regulaer = codes < INDEX_KRONENVERLUST
    ergebnis[regulaer] = codes[regulaer].astype(np.uint8)
    ergebnis[codes == CODE_KRONENVERLUST] = INDEX_KRONENVERLUST
    return ergebnis


def _stufe(werte: npt.NDArray[np.uint16]) -> npt.NDArray[np.uint8]:
    return np.where(werte == CODE_KEIN_WERT, 0, werte).astype(np.uint8)


def _exportiere_raster(gebiet: Untersuchungsgebiet) -> dict[str, object]:
    with rasterio.open(DATEN / f"{gebiet.name}_baumarten.tif") as quelle:
        transform, breite, hoehe = calculate_default_transform(
            quelle.crs, f"EPSG:{EPSG_WEB}", quelle.width, quelle.height, *quelle.bounds
        )
    form = (hoehe, breite)
    baum = _baumart_index(_nach_mercator(DATEN / f"{gebiet.name}_baumarten.tif", form, transform))
    stein = _stufe(_nach_mercator(DATEN / f"{gebiet.name}_steinpilz_habitat.tif", form, transform))
    pfiff = _stufe(_nach_mercator(DATEN / f"{gebiet.name}_pfifferling_habitat.tif", form, transform))
    deckend = np.full(form, UNDURCHSICHTIG, dtype=np.uint8)
    profil = {"driver": "PNG", "width": breite, "height": hoehe, "count": 4, "dtype": "uint8"}
    with rasterio.open(ZIEL / f"{gebiet.name}.png", "w", **profil) as ziel:
        ziel.write(np.stack([baum, stein, pfiff, deckend]))
    links, oben = transform * (0, 0)
    rechts, unten = transform * (breite, hoehe)
    nach_wgs84 = Transformer.from_crs(EPSG_WEB, EPSG_WGS84, always_xy=True)
    ecken = [nach_wgs84.transform(x, y) for x, y in ((links, oben), (rechts, oben), (rechts, unten), (links, unten))]
    return {
        "name": gebiet.name,
        "anzeigename": ANZEIGENAMEN[gebiet.name],
        "mitte": [gebiet.laenge, gebiet.breite],
        "breitePixel": breite,
        "hoehePixel": hoehe,
        "ecken": [[round(lng, NACHKOMMASTELLEN_GRAD), round(lat, NACHKOMMASTELLEN_GRAD)] for lng, lat in ecken],
    }


def _exportiere_boden(gebiet: Untersuchungsgebiet, beschreibungen: dict[str, str]) -> int:
    flaechen = gpd.read_file(DATEN / f"{gebiet.name}_stok_25833.gpkg")
    flaechen["boden"] = [beschreibungen[f"{gebiet.name}-{nummer}"] for nummer in range(len(flaechen))]
    flaechen["geometry"] = flaechen.geometry.simplify(VEREINFACHUNG_METER)
    flaechen.to_crs(EPSG_WGS84).to_file(
        ZIEL / f"{gebiet.name}_boden.geojson", driver="GeoJSON", COORDINATE_PRECISION=NACHKOMMASTELLEN_GRAD
    )
    return len(flaechen)


def main() -> None:
    ZIEL.mkdir(parents=True, exist_ok=True)
    beschreibungen = {schluessel: beschreibe_standort(werte) for schluessel, werte in lies_anteile().items()}
    uebersicht = []
    for gebiet in TESTGEBIETE:
        meta = _exportiere_raster(gebiet)
        anzahl = _exportiere_boden(gebiet, beschreibungen)
        uebersicht.append(meta)
        print(f"{gebiet.name}: {meta['breitePixel']}x{meta['hoehePixel']} Pixel, {anzahl} Bodenflächen")
    (ZIEL / "gebiete.json").write_text(json.dumps(uebersicht, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
