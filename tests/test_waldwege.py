"""Tests für die Einteilung der OSM-Wege in fahrbare Wege und Pfade (ohne Netzwerk)."""

import pytest

from pipeline.io_waldwege import art_von


@pytest.mark.parametrize(
    ("highway", "tracktype", "erwartet"),
    [
        ("track", "grade1", "weg"),
        ("track", "grade2", "weg"),
        ("track", "grade4", "pfad"),
        ("track", None, "pfad"),
        ("path", None, "pfad"),
        ("footway", None, "pfad"),
        ("service", None, "weg"),
        ("unclassified", None, "weg"),
    ],
)
def test_wege_werden_nach_befahrbarkeit_eingeteilt(highway: str, tracktype: str | None, erwartet: str) -> None:
    assert art_von(highway, tracktype) == erwartet
