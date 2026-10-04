"""Tests für die Einteilung der OSM-Wege in fahrbare Wege und Pfade und für das Wiederholen bei Overpass-Überlast."""

import time
import urllib.error
from email.message import Message

import pytest

from pipeline import io_waldwege
from pipeline.io_waldwege import art_von


@pytest.mark.parametrize(
    ("highway", "tracktype", "erwartet"),
    [
        ("track", "grade1", "weg"),
        ("track", "grade3", "weg"),
        ("track", None, "weg"),
        ("track", "grade4", "pfad"),
        ("track", "grade5", "pfad"),
        ("path", None, "pfad"),
        ("footway", None, "pfad"),
        ("cycleway", None, "pfad"),
        ("service", None, "strasse"),
        ("unclassified", None, "strasse"),
        ("tertiary", None, "strasse"),
        ("residential", None, "strasse"),
    ],
)
def test_wege_werden_in_strassen_forstwege_und_pfade_eingeteilt(
    highway: str, tracktype: str | None, erwartet: str
) -> None:
    assert art_von(highway, tracktype) == erwartet


def _http_fehler(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError("https://overpass", code, "Fehler", Message(), None)


# Ausnahme (Regel 4, Monkeypatching): Netzwerk und Wartezeit gemockt nach Regel 9; die 504 trat auf GitHub Actions auf.
def test_ueberlast_wird_wiederholt_bis_die_antwort_kommt(monkeypatch: pytest.MonkeyPatch) -> None:
    fehler = [_http_fehler(504), urllib.error.URLError("Network is unreachable")]
    antwort: dict[str, object] = {"elements": []}

    def hole(abfrage: str) -> dict[str, object]:
        if len(fehler) > 0:
            raise fehler.pop(0)
        return antwort

    monkeypatch.setattr(io_waldwege, "_hole", hole)
    monkeypatch.setattr(time, "sleep", lambda sekunden: None)
    assert io_waldwege._hole_mit_wiederholung("abfrage") is antwort


# Ausnahme (Regel 4, Monkeypatching): Netzwerk gemockt nach Regel 9.
def test_andere_http_fehler_brechen_sofort_ab(monkeypatch: pytest.MonkeyPatch) -> None:
    versuche: list[str] = []

    def hole(abfrage: str) -> dict[str, object]:
        versuche.append(abfrage)
        raise _http_fehler(400)

    monkeypatch.setattr(io_waldwege, "_hole", hole)
    with pytest.raises(urllib.error.HTTPError):
        io_waldwege._hole_mit_wiederholung("abfrage")
    assert len(versuche) == 1
