"""Leitet aus LGB-Höhendaten (bDOM minus DGM) Kronenhöhe, Kronenschluss und Gelände je 10-m-Pixel der Testgebiete ab.

Aufruf: python -m pipeline.io_hoehe  (läuft auf GitHub Actions; der LGB-Server ist von Claudes Umgebung zu langsam).
Quelle: data.geobasis-bb.de (bDOM und DGM als GeoTIFF in 1-km-Kacheln, EPSG:25833), Lizenz dl-de/by-2-0.
Keine Rate-Limits dokumentiert; Kacheln werden nacheinander geladen, ohne Retry (Fehler brechen mit Ursache ab).
Der Server liefert nur ~30–80 KB/s (gemessen 04.10.2026): bDOM (~39 MB je km²) wird daher nur für die
Referenzkacheln geladen, mit denen eine freie Kronenhöhenkarte geprüft wird; das DGM (~1,5 MB) für alle Kacheln.
Ziel: daten/<gebiet>_struktur.tif auf dem Raster von daten/<gebiet>_baumarten.tif (EPSG:3035, 10 m),
Band 1 Kronenhöhe (m, oberes Quartil), Band 2 Kronenschluss (Anteil der Fläche mit Kronen über 3 m),
Band 3 Geländehöhe (m). Band 1 und 2 nur auf den Referenzkacheln, sonst ohne Wert.
"""

import math
import tempfile
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import numpy.typing as npt
import rasterio
from pyproj import CRS
from rasterio.warp import Resampling, reproject, transform_bounds

from pipeline.gebiete import TESTGEBIETE

__all__ = ["ist_lfb_lage", "kachel_namen", "main"]

DIENST = "https://data.geobasis-bb.de/geobasis/daten"
DATEN = Path("daten")
EPSG_LFB = 25833
KACHEL_METER = 1000
KRONE_AB_METER = 3.0  # darüber gilt ein Pixel als von Kronen bedeckt (Jungwuchs, Sträucher darunter)
KEIN_WERT = -9999.0
ZEITLIMIT_SEKUNDEN = 300
REFERENZ_KACHELN = {"33412-5867"}  # Joachimsthal, Südwestecke: Kiefer, Mischwald und Kahlschläge
KENNUNG = "pilzkarte-brandenburg (private Nutzung, github.com/MitWilhelm/pilzkarte-brandenburg)"


def kachel_namen(grenzen_25833: tuple[float, float, float, float]) -> list[str]:
    """Kachelkennungen '33EEE-NNNN' (Kilometer, Zone 33) aller 1-km-Kacheln, die das Rechteck berühren."""
    links, unten, rechts, oben = grenzen_25833
    namen: list[str] = []
    for ost in range(math.floor(links / KACHEL_METER), math.ceil(rechts / KACHEL_METER)):
        for nord in range(math.floor(unten / KACHEL_METER), math.ceil(oben / KACHEL_METER)):
            namen.append(f"33{ost}-{nord}")
    return namen


def ist_lfb_lage(crs_wkt: str) -> bool:
    """True, wenn die Lage EPSG:25833 ist; die LGB-Dateien hängen eine Höhenangabe an (EPSG:25833+7837)."""
    return CRS.from_wkt(crs_wkt).to_2d().to_epsg() == EPSG_LFB


def _pruefe_lage(pfad: Path, crs: rasterio.crs.CRS | None) -> None:
    if crs is None or not ist_lfb_lage(crs.to_wkt()):
        raise ValueError(f"Invariante verletzt: {pfad.name} hat CRS {crs}, erwartet Lage EPSG {EPSG_LFB}")


def _lade_tif(art: str, kachel: str, ordner: Path) -> Path:
    url = f"{DIENST}/{art}/tif/{art}_{kachel}.zip"
    zipdatei = ordner / f"{art}_{kachel}.zip"
    anfrage = urllib.request.Request(url, headers={"User-Agent": KENNUNG})
    with urllib.request.urlopen(anfrage, timeout=ZEITLIMIT_SEKUNDEN) as antwort:
        zipdatei.write_bytes(antwort.read())
    with zipfile.ZipFile(zipdatei) as archiv:
        tifs = [name for name in archiv.namelist() if name.lower().endswith(".tif")]
        if len(tifs) != 1:
            raise ValueError(f"Invariante verletzt: {url} enthält {len(tifs)} GeoTIFFs: {tifs}")
        archiv.extract(tifs[0], ordner)
    zipdatei.unlink()
    return ordner / tifs[0]


def _kronenhoehe_1m(bdom_pfad: Path, dgm_pfad: Path) -> tuple[npt.NDArray[np.float32], rasterio.Affine]:
    with rasterio.open(dgm_pfad) as dgm:
        _pruefe_lage(dgm_pfad, dgm.crs)
        gelaende = dgm.read(1).astype(np.float32)
        transform = dgm.transform
    oberflaeche = np.full(gelaende.shape, KEIN_WERT, dtype=np.float32)
    with rasterio.open(bdom_pfad) as bdom:
        _pruefe_lage(bdom_pfad, bdom.crs)
        # bDOM kann feiner aufgelöst sein als das DGM: Mittelwert auf das 1-m-Raster des DGM.
        # Nur die Lage EPSG:25833 angeben; beide Dateien haben dieselbe Höhenangabe.
        reproject(
            bdom.read(1),
            oberflaeche,
            src_transform=bdom.transform,
            src_crs=f"EPSG:{EPSG_LFB}",
            src_nodata=bdom.nodata,
            dst_transform=transform,
            dst_crs=f"EPSG:{EPSG_LFB}",
            dst_nodata=KEIN_WERT,
            resampling=Resampling.average,
        )
    hoehe = np.where(oberflaeche == KEIN_WERT, KEIN_WERT, np.maximum(oberflaeche - gelaende, 0.0))
    return hoehe.astype(np.float32), transform


def _in_ziel(
    quelle: npt.NDArray[np.float32], quelle_transform: rasterio.Affine, ziel: rasterio.DatasetReader
) -> tuple[npt.NDArray[np.float32], npt.NDArray[np.float32]]:
    oben = np.full(ziel.shape, KEIN_WERT, dtype=np.float32)
    anteil = np.full(ziel.shape, KEIN_WERT, dtype=np.float32)
    krone = np.where(quelle == KEIN_WERT, KEIN_WERT, (quelle > KRONE_AB_METER).astype(np.float32)).astype(np.float32)
    for daten, ergebnis, verfahren in ((quelle, oben, Resampling.q3), (krone, anteil, Resampling.average)):
        reproject(
            daten,
            ergebnis,
            src_transform=quelle_transform,
            src_crs=f"EPSG:{EPSG_LFB}",
            src_nodata=KEIN_WERT,
            dst_transform=ziel.transform,
            dst_crs=ziel.crs,
            dst_nodata=KEIN_WERT,
            resampling=verfahren,
        )
    return oben, anteil


def _gelaende_in_ziel(dgm_pfad: Path, ziel: rasterio.DatasetReader) -> npt.NDArray[np.float32]:
    ergebnis = np.full(ziel.shape, KEIN_WERT, dtype=np.float32)
    with rasterio.open(dgm_pfad) as dgm:
        _pruefe_lage(dgm_pfad, dgm.crs)
        reproject(
            dgm.read(1),
            ergebnis,
            src_transform=dgm.transform,
            src_crs=f"EPSG:{EPSG_LFB}",
            src_nodata=dgm.nodata,
            dst_transform=ziel.transform,
            dst_crs=ziel.crs,
            dst_nodata=KEIN_WERT,
            resampling=Resampling.average,
        )
    return ergebnis


def main() -> None:
    for gebiet in TESTGEBIETE:
        with rasterio.open(DATEN / f"{gebiet.name}_baumarten.tif") as ziel:
            grenzen = transform_bounds(ziel.crs, f"EPSG:{EPSG_LFB}", *ziel.bounds)
            baender = np.full((3, *ziel.shape), KEIN_WERT, dtype=np.float32)
            kacheln = kachel_namen(grenzen)
            for nummer, kachel in enumerate(kacheln, start=1):
                with tempfile.TemporaryDirectory() as ordner_text:
                    ordner = Path(ordner_text)
                    dgm = _lade_tif("dgm", kachel, ordner)
                    gelaende = _gelaende_in_ziel(dgm, ziel)
                    baender[2] = np.where(gelaende != KEIN_WERT, gelaende, baender[2])
                    if kachel in REFERENZ_KACHELN:
                        bdom = _lade_tif("bdom", kachel, ordner)
                        hoehe, transform = _kronenhoehe_1m(bdom, dgm)
                        oben, anteil = _in_ziel(hoehe, transform, ziel)
                        baender[0] = np.where(oben != KEIN_WERT, oben, baender[0])
                        baender[1] = np.where(anteil != KEIN_WERT, anteil, baender[1])
                print(f"{gebiet.name} Kachel {nummer}/{len(kacheln)} {kachel}")
            profil = ziel.profile.copy()
        profil.update(count=3, dtype="float32", nodata=KEIN_WERT, compress="deflate", predictor=3)
        with rasterio.open(DATEN / f"{gebiet.name}_struktur.tif", "w", **profil) as ausgabe:
            ausgabe.write(baender)
        print(f"{gebiet.name}: {(baender[2] != KEIN_WERT).mean():.1%} der Pixel mit Geländehöhe")


if __name__ == "__main__":
    main()
