"""Weicher Übergang von farbig (innen) zu grau (außen) am Barnim-Rand: reine Berechnung ohne Datei- oder Netzzugriff."""

import numpy as np
import numpy.typing as npt

__all__ = ["verlauf_ausserhalb"]

KERN_BREITE_SIGMA = 3.0  # der Weichzeichner-Kern reicht 3 Sigma weit
HALBE_DECKUNG = 0.5  # Anteil "innen" genau am Rand; ab hier nach außen beginnt das Grau


def _gauss_kern(sigma_pixel: float) -> npt.NDArray[np.float64]:
    radius = int(np.ceil(KERN_BREITE_SIGMA * sigma_pixel))
    abstand = np.arange(-radius, radius + 1, dtype=np.float64)
    kern: npt.NDArray[np.float64] = np.exp(-(abstand**2) / (2.0 * sigma_pixel**2))
    return np.asarray(kern / kern.sum(), dtype=np.float64)


def _zeichne_weich(werte: npt.NDArray[np.float64], sigma_pixel: float) -> npt.NDArray[np.float64]:
    kern = _gauss_kern(sigma_pixel)
    radius = kern.size // 2
    # Rand mit dem Randwert fortsetzen, damit der Rand des Bildes nicht abdunkelt.
    gepolstert = np.pad(werte, radius, mode="edge")
    zeilen = np.apply_along_axis(lambda zeile: np.convolve(zeile, kern, mode="valid"), 1, gepolstert)
    ergebnis = np.apply_along_axis(lambda spalte: np.convolve(spalte, kern, mode="valid"), 0, zeilen)
    return np.asarray(ergebnis, dtype=np.float64)


def verlauf_ausserhalb(
    innen: npt.NDArray[np.bool_], sigma_pixel: float, deckkraft_aussen: int
) -> npt.NDArray[np.uint8]:
    """Deckkraft 0 bis `deckkraft_aussen` je Pixel: innen und am Rand 0, nach außen stetig bis zum vollen Wert.

    Der Weichzeichner macht aus der Innen-Maske einen Verlauf mit 0,5 genau am Rand; alles ab dort nach außen wird
    linear auf Grau gesetzt, innerhalb bleibt die Karte unverändert farbig.
    """
    if sigma_pixel <= 0:
        raise ValueError(f"Invariante verletzt: Sigma {sigma_pixel} Pixel")
    if not 0 < deckkraft_aussen <= 255:
        raise ValueError(f"Invariante verletzt: Deckkraft {deckkraft_aussen} außerhalb 1 bis 255")
    weich = _zeichne_weich(innen.astype(np.float64), sigma_pixel)
    ausserhalb = np.clip((HALBE_DECKUNG - weich) / HALBE_DECKUNG, 0.0, 1.0)
    return np.round(ausserhalb * deckkraft_aussen).astype(np.uint8)
