"""Testgebiete und Baumarten-Codes: reine Berechnungen ohne Datei- oder Netzzugriff.

Ein Untersuchungsgebiet ist ein Quadrat um einen Mittelpunkt (WGS84), das in die
Koordinatensysteme der Quellen (EPSG:25833 für LFB, EPSG:3035 für DLR) umgerechnet wird.
"""

from dataclasses import dataclass

import numpy as np
import numpy.typing as npt
from pyproj import Transformer

__all__ = [
    "BAUMARTEN",
    "CODE_KEIN_WERT",
    "Ausschnitt",
    "TESTGEBIETE",
    "Untersuchungsgebiet",
    "ausschnitt_in",
    "zaehle_baumarten",
]

EPSG_WGS84 = 4326
KANTENLAENGE_METER = 6000.0

# Codes laut treespecies_de_2022_readme.txt (DLR). 0 ist Kiefer, nicht "leer".
BAUMARTEN: dict[int, str] = {
    0: "Kiefer",
    1: "Fichte",
    2: "Douglasie",
    3: "Lärche",
    4: "Tanne",
    5: "Buche",
    6: "Eiche",
    7: "Birke",
    8: "Erle",
    9: "Sonstige",
    666: "Kronenverlust",
}
CODE_KEIN_WERT = 999


@dataclass(frozen=True)
class Untersuchungsgebiet:
    name: str
    breite: float
    laenge: float


@dataclass(frozen=True)
class Ausschnitt:
    links: float
    unten: float
    rechts: float
    oben: float


# Mittelpunkte: Ortsmitte Joachimsthal; Schwärzesee laut Wikipedia ca. 1,5 km
# südöstlich des Flugplatzes Eberswalde-Finow (Lage geschätzt, im Bericht geprüft).
TESTGEBIETE: tuple[Untersuchungsgebiet, ...] = (
    Untersuchungsgebiet(name="joachimsthal", breite=52.979, laenge=13.745),
    Untersuchungsgebiet(name="schwaerzesee", breite=52.815, laenge=13.712),
)


def ausschnitt_in(gebiet: Untersuchungsgebiet, epsg: int) -> Ausschnitt:
    """Quadrat mit KANTENLAENGE_METER um den Mittelpunkt, im Ziel-Koordinatensystem.

    Das Quadrat wird in EPSG:25833 (metrisch) gebildet und seine vier Ecken
    werden umgerechnet; das umschließende Rechteck ist der Ausschnitt.
    """
    nach_utm = Transformer.from_crs(EPSG_WGS84, 25833, always_xy=True)
    mitte_x, mitte_y = nach_utm.transform(gebiet.laenge, gebiet.breite)
    halb = KANTENLAENGE_METER / 2
    ecken_x = [mitte_x - halb, mitte_x + halb, mitte_x + halb, mitte_x - halb]
    ecken_y = [mitte_y - halb, mitte_y - halb, mitte_y + halb, mitte_y + halb]
    nach_ziel = Transformer.from_crs(25833, epsg, always_xy=True)
    ziel_x, ziel_y = nach_ziel.transform(ecken_x, ecken_y)
    return Ausschnitt(links=min(ziel_x), unten=min(ziel_y), rechts=max(ziel_x), oben=max(ziel_y))


def zaehle_baumarten(raster: npt.NDArray[np.uint16]) -> dict[str, int]:
    """Anzahl der 10-m-Pixel je Baumart; Pixel ohne Wert werden nicht gezählt.

    Unbekannte Codes sind ein Datenfehler und werden nicht stillschweigend übergangen.
    """
    codes, anzahlen = np.unique(raster, return_counts=True)
    ergebnis: dict[str, int] = {}
    for code, anzahl in zip(codes.tolist(), anzahlen.tolist(), strict=True):
        if code == CODE_KEIN_WERT:
            continue
        if code not in BAUMARTEN:
            raise ValueError(f"Invariante verletzt: unbekannter Baumart-Code {code}")
        ergebnis[BAUMARTEN[code]] = anzahl
    return ergebnis
