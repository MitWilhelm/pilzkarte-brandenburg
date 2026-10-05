"""Baumarten-Codes der DLR-Karte und gemeinsame Rechteck-Form: reine Berechnungen ohne Datei- oder Netzzugriff."""

from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

__all__ = [
    "BAUMARTEN",
    "CODE_KEIN_WERT",
    "Ausschnitt",
    "zaehle_baumarten",
]

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
class Ausschnitt:
    links: float
    unten: float
    rechts: float
    oben: float


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
