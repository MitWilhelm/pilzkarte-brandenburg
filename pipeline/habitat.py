"""Habitat-Bewertung für Steinpilz und Pfifferling aus Baumart und Standort (reine Funktionen).

Die Punktwerte sind Fachwissen-Annahmen (siehe docs/decisions.md), nicht mit Funden kalibriert.
Wert = Baumart-Punkte x Boden-Punkte, 0 bis 1; Anzeige-Stufe = 50 bis 100 ab MINDESTWERT.
"""

import re
from dataclasses import dataclass
from typing import Literal

__all__ = [
    "KEIN_HABITAT",
    "PILZARTEN",
    "Pilzart",
    "Standort",
    "Standortanteil",
    "anzeige_stufe",
    "baumart_punkte",
    "boden_punkte",
    "lies_standort",
]

Pilzart = Literal["steinpilz", "pfifferling"]
PILZARTEN: tuple[Pilzart, ...] = ("steinpilz", "pfifferling")

GUT = 1.0
MITTEL = 0.6
GERING = 0.3
UNGEEIGNET = 0.0
MINDESTWERT = 0.2
KEIN_HABITAT = 0
STUFE_UNTEN = 50
STUFE_SPANNE = 50
ANTEILE_GESAMT = 10  # LFB gibt Anteile in Zehnteln an (az1..az4)

# Baumart-Codes laut DLR: 0 Kiefer, 1 Fichte, 2 Douglasie, 3 Lärche, 4 Tanne, 5 Buche,
# 6 Eiche, 7 Birke, 8 Erle, 9 Sonstige, 666 Kronenverlust.
_BAUMART: dict[Pilzart, dict[int, float]] = {
    "steinpilz": {
        0: GUT,
        1: GUT,
        2: MITTEL,
        3: MITTEL,
        4: MITTEL,
        5: GUT,
        6: GUT,
        7: MITTEL,
        8: UNGEEIGNET,
        9: GERING,
        666: UNGEEIGNET,
    },
    "pfifferling": {
        0: GUT,
        1: MITTEL,
        2: MITTEL,
        3: MITTEL,
        4: MITTEL,
        5: GUT,
        6: GUT,
        7: GUT,
        8: UNGEEIGNET,
        9: GERING,
        666: UNGEEIGNET,
    },
}
_NAEHRKRAFT: dict[Pilzart, dict[str, float]] = {
    "steinpilz": {"A": MITTEL, "Z": GUT, "M": GUT, "K": MITTEL, "R": GERING},
    "pfifferling": {"A": GUT, "Z": GUT, "M": MITTEL, "K": GERING, "R": UNGEEIGNET},
}
# Feuchte 3 fehlt in der LFB-Legende; vermutlich "trocken" -> nur mittel bewertet.
_FEUCHTE: dict[int, float] = {1: GUT, 2: GUT, 3: MITTEL}

_MUSTER = re.compile(r"^(?P<nass>[NOÜ]?)(?P<naehrkraft>[AZMKR])(?P<zusatz>[+C]?)(?P<feuchte>\d)(?P<grund>[gw]?)$")


@dataclass(frozen=True)
class Standort:
    naehrkraft: str
    feuchte: int
    is_nass: bool


@dataclass(frozen=True)
class Standortanteil:
    code: str
    anteil: int


def lies_standort(code: str) -> Standort:
    """Zerlegt einen Stamm-Standortsgruppen-Code wie 'Z2', 'M2g', 'NK1', 'M+2', 'RC1'."""
    treffer = _MUSTER.match(code)
    if treffer is None:
        raise ValueError(f"Invariante verletzt: unbekannter Standort-Code {code!r}")
    return Standort(
        naehrkraft=treffer["naehrkraft"],
        feuchte=int(treffer["feuchte"]),
        is_nass=treffer["nass"] != "",
    )


def baumart_punkte(pilz: Pilzart, baumart_code: int) -> float:
    tabelle = _BAUMART[pilz]
    if baumart_code not in tabelle:
        raise ValueError(f"Invariante verletzt: unbekannter Baumart-Code {baumart_code}")
    return tabelle[baumart_code]


def _punkte_eines_standorts(pilz: Pilzart, standort: Standort) -> float:
    if standort.is_nass:
        return UNGEEIGNET
    if standort.feuchte not in _FEUCHTE:
        raise ValueError(f"Invariante verletzt: unbekannte Feuchtestufe {standort.feuchte}")
    return _NAEHRKRAFT[pilz][standort.naehrkraft] * _FEUCHTE[standort.feuchte]


def boden_punkte(pilz: Pilzart, anteile: list[Standortanteil]) -> float:
    """Nach Flächenanteil gewichtetes Mittel der Boden-Punkte aller Standorte einer Fläche."""
    summe_anteile = sum(eintrag.anteil for eintrag in anteile)
    if summe_anteile != ANTEILE_GESAMT:
        raise ValueError(f"Invariante verletzt: Anteile ergeben {summe_anteile}, erwartet {ANTEILE_GESAMT}")
    gewichtet = sum(_punkte_eines_standorts(pilz, lies_standort(e.code)) * e.anteil for e in anteile)
    return gewichtet / ANTEILE_GESAMT


def anzeige_stufe(wert: float) -> int:
    """0 bis 1 -> 50 bis 100; unter MINDESTWERT gilt die Stelle als kein Habitat (0)."""
    if not 0.0 <= wert <= 1.0:
        raise ValueError(f"Invariante verletzt: Habitat-Wert {wert} liegt nicht zwischen 0 und 1")
    if wert < MINDESTWERT:
        return KEIN_HABITAT
    return round(STUFE_UNTEN + STUFE_SPANNE * wert)
