"""Oberhöhe aus nDOM-Punkten (LGB, Höhe über Grund): reine Berechnungen ohne Datei- oder Netzzugriff.

Eine Kachel ist 1 × 1 km (EPSG:25833). Die Punkte werden auf 1-m-Zellen gemittelt, daraus wird je 10-m-Pixel die
Oberhöhe bestimmt: das oberste Prozent der 1-m-Zellen in einem 51 × 51 m großen Fenster um das Pixel. Ein Zellmittel,
Viertelwert oder auch das obere Zehntel wäre irreführend: Die Befliegung ist im Winter, ohne Laub. Bei Laubwald sieht
das Laserbild dann viele Bodenzellen zwischen dünnen Kronen; mit dem oberen Zehntel galten 11,9 % der Buchen- und
4,3 % der Eichenpixel in den ersten fünf Kacheln als offen, mit dem obersten Prozent 4,2 % bzw. 0,8 % (Kiefer jeweils
unter 0,1 %). Das oberste Prozent genügt, damit schon wenige Kronenpunkte (ab 1 % Fläche) den Bestand zeigen.
"""

from dataclasses import dataclass

import numpy as np
import numpy.typing as npt
from numpy.lib.stride_tricks import sliding_window_view

__all__ = [
    "KACHEL_METER",
    "OHNE_WERT",
    "PIXEL_JE_KACHEL",
    "Punkte",
    "kachelname",
    "kacheln_mit_wald",
    "oberhoehe",
    "summiere_punkte",
    "zellmittel",
]

KACHEL_METER = 1000
PIXEL_METER = 10
PIXEL_JE_KACHEL = KACHEL_METER // PIXEL_METER
FENSTER_RADIUS_METER = 25
FENSTER_KANTE = 2 * FENSTER_RADIUS_METER + 1
OBERHOEHE_PERZENTIL = 99.0
# Höchste Bäume in Brandenburg: rund 45 m. Darüber sind es Masten, Kräne oder Fehlpunkte.
MAX_OBERHOEHE_METER = 60.0
OHNE_WERT = 255  # Pixel ohne einen einzigen Punkt im Fenster
KARTENBLATT_PRAEFIX = "33"  # UTM-Zone 33 vor dem Ostwert in km, wie in den LGB-Dateinamen
CODE_KEIN_WALD = 999  # DLR-Baumarten: kein Wert


@dataclass(frozen=True)
class Punkte:
    """Punkte einer Kachel: Koordinaten in EPSG:25833 und Höhe über Grund in Metern."""

    ost: npt.NDArray[np.float64]
    nord: npt.NDArray[np.float64]
    hoehe: npt.NDArray[np.float64]


def kachelname(ost_km: int, nord_km: int) -> str:
    """LGB-Kachelname, z. B. 33420-5851 für die Kachel ab 420.000 / 5.851.000 m."""
    if not 100 <= ost_km < 1000 or not 1000 <= nord_km < 10000:
        raise ValueError(f"Invariante verletzt: Kachel {ost_km}/{nord_km} außerhalb der UTM-Kilometer")
    return f"{KARTENBLATT_PRAEFIX}{ost_km:03d}-{nord_km}"


def kacheln_mit_wald(baumarten: npt.NDArray[np.uint16], links_oben: tuple[float, float]) -> list[tuple[int, int]]:
    """Alle 1-km-Kacheln (Ost-km, Nord-km), in denen die Baumartenkarte mindestens ein Waldpixel hat.

    `links_oben` ist die obere linke Ecke des Rasters (EPSG:25833), die Pixel sind 10 m groß, Zeile 0 liegt im Norden.
    """
    zeilen, spalten = np.nonzero(baumarten != CODE_KEIN_WALD)
    ost_km = np.floor((links_oben[0] + (spalten + 0.5) * PIXEL_METER) / KACHEL_METER).astype(np.int64)
    nord_km = np.floor((links_oben[1] - (zeilen + 0.5) * PIXEL_METER) / KACHEL_METER).astype(np.int64)
    kacheln = np.unique(np.stack([ost_km, nord_km], axis=1), axis=0)
    return [(int(ost), int(nord)) for ost, nord in kacheln.tolist()]


def summiere_punkte(
    punkte: Punkte, ursprung: tuple[float, float]
) -> tuple[npt.NDArray[np.float64], npt.NDArray[np.int64]]:
    """Summe der Höhen und Anzahl Punkte je 1-m-Zelle (Zeile 0 = Süden, flach: Zeile * 1000 + Spalte).

    Kann stückweise für Teile einer Kachel aufgerufen und aufaddiert werden. Punkte am Rand der Kachel
    (bis 0,1 m darüber hinaus) werden der Randzelle zugeschlagen.
    """
    spalte = np.clip(np.floor(punkte.ost - ursprung[0]).astype(np.int64), 0, KACHEL_METER - 1)
    zeile = np.clip(np.floor(punkte.nord - ursprung[1]).astype(np.int64), 0, KACHEL_METER - 1)
    index = zeile * KACHEL_METER + spalte
    zellen = KACHEL_METER * KACHEL_METER
    return np.bincount(index, weights=punkte.hoehe, minlength=zellen), np.bincount(index, minlength=zellen).astype(
        np.int64
    )


def zellmittel(summe: npt.NDArray[np.float64], anzahl: npt.NDArray[np.int64]) -> npt.NDArray[np.float32]:
    """Mittlere Höhe je 1-m-Zelle als Gitter 1000 × 1000 (Zeile 0 = Süden); Zellen ohne Punkt sind NaN."""
    if summe.shape != anzahl.shape or summe.size != KACHEL_METER * KACHEL_METER:
        raise ValueError(
            f"Invariante verletzt: Summen {summe.shape} und Anzahl {anzahl.shape} passen nicht zu einer Kachel"
        )
    mittel = np.full(summe.shape, np.nan, dtype=np.float32)
    hat_punkte = anzahl > 0
    mittel[hat_punkte] = (summe[hat_punkte] / anzahl[hat_punkte]).astype(np.float32)
    return mittel.reshape(KACHEL_METER, KACHEL_METER)


def oberhoehe(mittel: npt.NDArray[np.float32]) -> npt.NDArray[np.uint8]:
    """Oberhöhe in ganzen Metern je 10-m-Pixel, Gitter 100 × 100 mit Zeile 0 im Norden (wie das Baumartenraster).

    Das Fenster (51 × 51 m) reicht über den Kachelrand hinaus; dort fehlen die Nachbarkacheln und zählen nicht mit.
    Pixel ohne einen Punkt im Fenster erhalten OHNE_WERT.
    """
    if mittel.shape != (KACHEL_METER, KACHEL_METER):
        raise ValueError(
            f"Invariante verletzt: Zellmittel hat Form {mittel.shape}, erwartet {(KACHEL_METER, KACHEL_METER)}"
        )
    gepolstert = np.pad(mittel, FENSTER_RADIUS_METER, constant_values=np.nan)
    start = PIXEL_METER // 2  # Fenster des ersten Pixels beginnt, wegen der Polsterung, bei der Pixelmitte
    fenster = sliding_window_view(gepolstert, (FENSTER_KANTE, FENSTER_KANTE))[start::PIXEL_METER, start::PIXEL_METER]
    if fenster.shape[:2] != (PIXEL_JE_KACHEL, PIXEL_JE_KACHEL):
        raise ValueError(f"Invariante verletzt: {fenster.shape[:2]} Fenster, erwartet {PIXEL_JE_KACHEL} je Seite")
    flach = fenster.reshape(PIXEL_JE_KACHEL * PIXEL_JE_KACHEL, FENSTER_KANTE * FENSTER_KANTE)
    hat_werte = ~np.isnan(flach).all(axis=1)
    ergebnis = np.full(PIXEL_JE_KACHEL * PIXEL_JE_KACHEL, OHNE_WERT, dtype=np.uint8)
    perzentil = np.nanpercentile(flach[hat_werte], OBERHOEHE_PERZENTIL, axis=1)
    ergebnis[hat_werte] = np.round(np.clip(perzentil, 0.0, MAX_OBERHOEHE_METER)).astype(np.uint8)
    return np.flipud(ergebnis.reshape(PIXEL_JE_KACHEL, PIXEL_JE_KACHEL))
