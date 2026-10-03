"""Nachbarschafts-Merkmale auf dem 10-m-Baumartenraster (reine Funktionen, nur numpy).

Mischfaktor: Anteil anderer geeigneter Wirtsbäume im Umkreis eines Pixels. Gemischte
Bestände (z. B. Kiefer mit Birke oder Eiche) gelten als ergiebiger als Reinbestände.
"""

import numpy as np
import numpy.typing as npt

from pipeline.gebiete import CODE_KEIN_WERT

__all__ = ["RADIUS_PIXEL", "ZIEL_ANTEIL", "fenster_summe", "mischfaktor"]

RADIUS_PIXEL = 3  # 7 x 7 Pixel = 70 m x 70 m, also etwa 30 m Umkreis
ZIEL_ANTEIL = 0.25  # ab 25 % anderer Wirtsbäume gilt ein Bestand als voll gemischt


def fenster_summe(maske: npt.NDArray[np.bool_], radius: int) -> npt.NDArray[np.int32]:
    """Anzahl wahrer Pixel im Quadrat (2*radius+1)² um jedes Pixel; am Rand wird nur Vorhandenes gezählt."""
    if radius < 0:
        raise ValueError(f"Invariante verletzt: Radius {radius} ist negativ")
    # Summierte Fläche (Integralbild): jede Fenstersumme aus vier Eckwerten, unabhängig vom Radius schnell.
    gepolstert = np.pad(maske.astype(np.int32), ((radius + 1, radius), (radius + 1, radius)))
    integral = gepolstert.cumsum(axis=0).cumsum(axis=1)
    breite = 2 * radius + 1
    hoehe, weite = maske.shape
    unten_rechts = integral[breite : breite + hoehe, breite : breite + weite]
    oben_rechts = integral[0:hoehe, breite : breite + weite]
    unten_links = integral[breite : breite + hoehe, 0:weite]
    oben_links = integral[0:hoehe, 0:weite]
    return (unten_rechts - oben_rechts - unten_links + oben_links).astype(np.int32)


def mischfaktor(baumarten: npt.NDArray[np.uint16], wirt_codes: frozenset[int]) -> npt.NDArray[np.float32]:
    """0 bis 1 je Pixel: Anteil der Wirtsbäume einer *anderen* Art als das Pixel selbst im Umkreis.

    Bezugsgröße sind alle Pixel mit Baumart-Wert im Fenster (Wasser, Wege usw. zählen nicht).
    Ein Anteil von ZIEL_ANTEIL oder mehr ergibt 1; Pixel, die selbst kein Wirt sind, erhalten 0.
    """
    bezug = fenster_summe(baumarten != CODE_KEIN_WERT, RADIUS_PIXEL)
    wirte_gesamt = fenster_summe(np.isin(baumarten, list(wirt_codes)), RADIUS_PIXEL)
    andere_wirte = np.zeros(baumarten.shape, dtype=np.int32)
    for code in sorted(wirt_codes):
        eigene_art = fenster_summe(baumarten == code, RADIUS_PIXEL)
        andere_wirte = np.where(baumarten == code, wirte_gesamt - eigene_art, andere_wirte)
    anteil = np.divide(
        andere_wirte, bezug, out=np.zeros(baumarten.shape, dtype=np.float64), where=bezug > 0, casting="unsafe"
    )
    return np.minimum(anteil / ZIEL_ANTEIL, 1.0).astype(np.float32)
