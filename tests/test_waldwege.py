"""Tests für die Einteilung der OSM-Wege in fahrbare Wege und Pfade (ohne Netzwerk)."""

import pytest

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
