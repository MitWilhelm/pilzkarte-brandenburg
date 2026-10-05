"""Habitat-Bewertung für Steinpilz und Pfifferling aus Baumart, Standort und Mischung (reine Funktionen).

Die Punktwerte sind Fachwissen-Annahmen (siehe docs/decisions.md), nicht mit Funden kalibriert.
Wert = Baum x Boden x Mischungsgewicht (0 bis 1); Anzeige-Stufe 50 bis 100 nach Rang im Gebiet.
"""

import re
from dataclasses import dataclass
from typing import Literal

import numpy as np
import numpy.typing as npt

__all__ = [
    "KEIN_HABITAT",
    "PILZARTEN",
    "Pilzart",
    "Standort",
    "Standortanteil",
    "baumart_punkte",
    "beschreibe_standort",
    "boden_punkte",
    "gesamtwert",
    "hangfaktor",
    "hoehenfaktor",
    "lies_standort",
    "mit_wegrand",
    "relative_stufen",
    "strukturfaktor",
    "wirt_codes",
]

Pilzart = Literal["steinpilz", "pfifferling"]
PILZARTEN: tuple[Pilzart, ...] = ("steinpilz", "pfifferling")

GUT = 1.0
MITTEL = 0.6
GERING = 0.3
UNGEEIGNET = 0.0
MINDESTWERT = 0.2
MISCH_BASIS = 0.6  # reiner Bestand behält 60 % seines Werts, voll gemischter 100 %
# Wegränder: dünnere Streuschicht, mehr Licht; dort fanden sich mehr Mykorrhiza-Pilze (van Strien et al. 2018).
# Kleiner Aufschlag, weil die Studie Straßenränder in den Niederlanden betrifft, nicht Waldwege in Brandenburg.
WEGRAND_AUFSCHLAG = 0.15
KEIN_HABITAT = 0
STUFE_UNTEN = 50
STUFE_SPANNE = 50
ANTEILE_GESAMT = 10  # LFB gibt Anteile in Zehnteln an (az1..az3)

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
    # Arm (A) wie ziemlich arm: Steinpilz-Ertrag stieg mit Sand, Säure und C/N (Martínez-Peña et al. 2012, FEM).
    "steinpilz": {"A": GUT, "Z": GUT, "M": GUT, "K": MITTEL, "R": GERING},
    "pfifferling": {"A": GUT, "Z": GUT, "M": MITTEL, "K": GERING, "R": UNGEEIGNET},
}
# Feuchte 3 fehlt in der LFB-Legende; vermutlich "trocken" -> nur mittel bewertet.
_FEUCHTE: dict[int, float] = {1: GUT, 2: GUT, 3: MITTEL}

# Endung g = schwach grundfrisch, w = wechselfrisch/-feucht (LFB-Legende); v kommt im Barnim vor (0,35 % der Anteile)
# und ist in den gefundenen Legenden nicht erklärt. Alle drei werden gelesen, aber nicht bewertet (Annahme für v).
_MUSTER = re.compile(r"^(?P<nass>[NOÜ]?)(?P<naehrkraft>[AZMKR])(?P<zusatz>[+C]?)(?P<feuchte>\d)(?P<grund>[gwv]?)$")


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


_NAEHRKRAFT_TEXT = {"A": "arm", "Z": "ziemlich arm", "M": "mittel", "K": "kräftig", "R": "reich"}
_FEUCHTE_TEXT = {1: "frisch", 2: "mäßig frisch", 3: "trocken (vermutet)"}
_NASS_TEXT = "nass"


def beschreibe_standort(anteile: list[Standortanteil]) -> str:
    """Lesbarer Text für die Punkt-Info, z. B. '60 % ziemlich arm, mäßig frisch · 40 % mittel, frisch'."""
    teile: list[str] = []
    for eintrag in anteile:
        standort = lies_standort(eintrag.code)
        feuchte = _NASS_TEXT if standort.is_nass else _FEUCHTE_TEXT.get(standort.feuchte, f"Feuchte {standort.feuchte}")
        prozent = eintrag.anteil * 100 // ANTEILE_GESAMT
        teile.append(f"{prozent} % {_NAEHRKRAFT_TEXT[standort.naehrkraft]}, {feuchte} ({eintrag.code})")
    return " · ".join(teile)


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


def wirt_codes(pilz: Pilzart) -> frozenset[int]:
    """Baumarten, die für die Pilzart mindestens als mittel geeigneter Mykorrhiza-Partner gelten."""
    return frozenset(code for code, punkte in _BAUMART[pilz].items() if punkte >= MITTEL)


def gesamtwert(
    baum: npt.NDArray[np.float32], boden: npt.NDArray[np.float32], misch: npt.NDArray[np.float32]
) -> npt.NDArray[np.float32]:
    """Baum x Boden x Mischungsgewicht; ein reiner Bestand behält MISCH_BASIS seines Werts."""
    for name, werte in (("Baum", baum), ("Boden", boden), ("Mischung", misch)):
        if werte.size > 0 and (werte.min() < 0.0 or werte.max() > 1.0):
            raise ValueError(f"Invariante verletzt: {name}-Werte von {werte.min()} bis {werte.max()}")
    return (baum * boden * (MISCH_BASIS + (1.0 - MISCH_BASIS) * misch)).astype(np.float32)


def relative_stufen(werte: npt.NDArray[np.float32]) -> npt.NDArray[np.uint8]:
    """Stufe 50 bis 100 nach mittlerem Rang im Gebiet; Pixel unter MINDESTWERT sind kein Habitat (0).

    Gleiche Werte erhalten den mittleren Rang ihres Blocks: Ein großer Block gleichartigen
    Reinbestands landet so in der Mitte statt geschlossen in der obersten Stufe.
    """
    ist_habitat = werte >= MINDESTWERT
    stufen = np.zeros(werte.shape, dtype=np.uint8)
    if not ist_habitat.any():
        return stufen
    sortiert = np.sort(werte[ist_habitat])
    unter = np.searchsorted(sortiert, werte[ist_habitat], side="left")
    bis_einschliesslich = np.searchsorted(sortiert, werte[ist_habitat], side="right")
    rang = (unter + bis_einschliesslich) / (2 * sortiert.size)
    # floor(x + 0,5) rundet kaufmännisch; np.round würde 62,5 auf 62 abrunden (Banker's Rounding).
    stufen[ist_habitat] = np.floor(STUFE_UNTEN + STUFE_SPANNE * rang + 0.5).astype(np.uint8)
    return stufen


def mit_wegrand(wert: npt.NDArray[np.float32], is_nahe_weg: npt.NDArray[np.bool_]) -> npt.NDArray[np.float32]:
    """Aufschlag WEGRAND_AUFSCHLAG für Pixel nahe einem Weg, gedeckelt bei 1; Pixel ohne Habitat bleiben 0."""
    if wert.shape != is_nahe_weg.shape:
        raise ValueError(f"Invariante verletzt: Formen {wert.shape} und {is_nahe_weg.shape} passen nicht")
    return np.minimum(wert * np.where(is_nahe_weg, 1.0 + WEGRAND_AUFSCHLAG, 1.0), 1.0).astype(np.float32)


# Bestandesstruktur aus LGB-Höhendaten (pipeline/io_hoehe.py). Kronenhöhe ersetzt das Alter: Kiefer erreicht
# auf mittleren Standorten in Brandenburg grob 8 m mit 20, 15 m mit 40, 20 m mit 60, 23 m mit 80 Jahren
# (Ertragstafel-Größenordnung, nicht standortgenau). Steinpilz-Ertrag nach Alter: 0–15 Jahre keine Funde, Gipfel
# 51–70 Jahre, danach geringer (Martínez-Peña et al. 2012, Mycorrhiza); Pfifferling eher in älteren Beständen.
_HOEHE_STUETZEN: dict[Pilzart, tuple[tuple[float, ...], tuple[float, ...]]] = {
    "steinpilz": ((0, 4, 6, 12, 16, 19, 22, 25, 30), (0.1, 0.1, 0.45, 0.6, 0.85, 1.0, 1.0, 0.7, 0.5)),
    "pfifferling": ((0, 4, 8, 15, 20, 40), (0.1, 0.1, 0.4, 0.7, 1.0, 1.0)),
}
# Kronenschluss (Anteil mit Kronen über 3 m) als Näherung der Bestandesdichte: Optimum bei mittlerer bis hoher
# Dichte, sehr dicht wieder schlechter (Grundflächen-Optimum in 6 Studien; Werte hier sind Annahmen).
_SCHLUSS_STUETZEN: dict[Pilzart, tuple[tuple[float, ...], tuple[float, ...]]] = {
    "steinpilz": ((0.0, 0.3, 0.6, 0.85, 1.0), (0.3, 0.6, 1.0, 1.0, 0.8)),
    "pfifferling": ((0.0, 0.3, 0.5, 0.8, 1.0), (0.3, 0.7, 1.0, 1.0, 0.75)),
}
# Oberhöhe aus dem nDOM (pipeline/hoehe.py): nur niedrige und junge Bestände werden abgewertet, kein Alters-Bonus.
# Belegt ist allein die Richtung (Recherche-Notiz "Bestandeshöhe als Alters-/Dichte-Proxy": sehr junge Bestände unter
# etwa 5–8 m Höhe abwerten, ab Stangenholz voll); ein Altersoptimum ist nicht belegt. Die beiden Grenzen sind Annahmen.
HOEHE_KEIN_BESTAND_METER = 3.0  # darunter Kahlfläche, Freifläche oder Kultur ohne tragfähiges Myzel: kein Habitat
HOEHE_VOLL_METER = 10.0  # ab hier voll (Kiefer etwa 20 Jahre, siehe Ertragstafel-Größenordnung oben)
HOEHE_OHNE_DATEN = 255  # Pixel ohne einen Punkt im Fenster (pipeline/hoehe.py: OHNE_WERT)

# Hanglage: Nordhänge günstiger, steile Südhänge ungünstiger (de-Miguel et al. 2014, Bonet et al. 2010).
HANG_WIRKUNG = 0.15  # höchstens ±15 %
HANG_VOLL_GRAD = 15.0  # ab dieser Neigung volle Wirkung
STRUKTUR_KEIN_WERT = -9999.0


def strukturfaktor(
    pilz: Pilzart, hoehe_m: npt.NDArray[np.float32], kronenschluss: npt.NDArray[np.float32]
) -> npt.NDArray[np.float32]:
    """0,1 bis 1 je Pixel aus Kronenhöhe und Kronenschluss; ohne Höhendaten (STRUKTUR_KEIN_WERT) neutral 1."""
    if hoehe_m.shape != kronenschluss.shape:
        raise ValueError(f"Invariante verletzt: Formen {hoehe_m.shape} und {kronenschluss.shape} passen nicht")
    hoehen_x, hoehen_y = _HOEHE_STUETZEN[pilz]
    schluss_x, schluss_y = _SCHLUSS_STUETZEN[pilz]
    faktor = np.interp(hoehe_m, hoehen_x, hoehen_y) * np.interp(kronenschluss, schluss_x, schluss_y)
    ohne_daten = (hoehe_m == STRUKTUR_KEIN_WERT) | (kronenschluss == STRUKTUR_KEIN_WERT)
    return np.where(ohne_daten, 1.0, faktor).astype(np.float32)


def hoehenfaktor(oberhoehe_m: npt.NDArray[np.uint8]) -> npt.NDArray[np.float32]:
    """0 bis 1 je Pixel: bis HOEHE_KEIN_BESTAND_METER 0, danach linear bis HOEHE_VOLL_METER; ohne Daten neutral 1."""
    anstieg = (oberhoehe_m.astype(np.float32) - HOEHE_KEIN_BESTAND_METER) / (
        HOEHE_VOLL_METER - HOEHE_KEIN_BESTAND_METER
    )
    faktor = np.clip(anstieg, 0.0, 1.0)
    return np.where(oberhoehe_m == HOEHE_OHNE_DATEN, 1.0, faktor).astype(np.float32)


def hangfaktor(gelaende_m: npt.NDArray[np.float32], pixel_meter: float) -> npt.NDArray[np.float32]:
    """1 ± HANG_WIRKUNG je nach Ausrichtung (Nordhang +, Südhang −) und Neigung; Zeile 0 liegt im Norden."""
    if pixel_meter <= 0:
        raise ValueError(f"Invariante verletzt: Pixelgröße {pixel_meter} m")
    ohne_daten = gelaende_m == STRUKTUR_KEIN_WERT
    gelaende = np.where(ohne_daten, np.nan, gelaende_m).astype(np.float64)
    nach_sueden, nach_osten = np.gradient(gelaende, pixel_meter)
    steigung = np.hypot(nach_sueden, nach_osten)
    neigung_grad = np.degrees(np.arctan(steigung))
    # Ein Hang „schaut“ nach Norden, wenn das Gelände nach Süden ansteigt (Gefälle Richtung Norden).
    nordlage = np.divide(nach_sueden, steigung, out=np.zeros_like(steigung), where=steigung > 0)
    faktor = 1.0 + HANG_WIRKUNG * nordlage * np.minimum(neigung_grad / HANG_VOLL_GRAD, 1.0)
    return np.where(np.isnan(faktor), 1.0, faktor).astype(np.float32)
