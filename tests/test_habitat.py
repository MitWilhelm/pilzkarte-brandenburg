"""Tests für die Habitat-Regeln in pipeline/habitat.py."""

import pytest

from pipeline.habitat import (
    KEIN_HABITAT,
    Standort,
    Standortanteil,
    anzeige_stufe,
    baumart_punkte,
    boden_punkte,
    lies_standort,
)


@pytest.mark.parametrize(
    ("code", "erwartet"),
    [
        ("Z2", Standort(naehrkraft="Z", feuchte=2, is_nass=False)),
        ("M2g", Standort(naehrkraft="M", feuchte=2, is_nass=False)),
        ("M+2", Standort(naehrkraft="M", feuchte=2, is_nass=False)),
        ("RC1", Standort(naehrkraft="R", feuchte=1, is_nass=False)),
        ("K1w", Standort(naehrkraft="K", feuchte=1, is_nass=False)),
        ("NK1", Standort(naehrkraft="K", feuchte=1, is_nass=True)),
        ("OZ4", Standort(naehrkraft="Z", feuchte=4, is_nass=True)),
        ("ÜR1", Standort(naehrkraft="R", feuchte=1, is_nass=True)),
    ],
)
def test_standort_codes_der_lfb_werden_in_naehrkraft_feuchte_und_nass_zerlegt(code: str, erwartet: Standort) -> None:
    assert lies_standort(code) == erwartet


def test_unbekannter_standort_code_meldet_eine_verletzte_invariante() -> None:
    with pytest.raises(ValueError, match="Invariante verletzt: unbekannter Standort-Code 'X9'"):
        lies_standort("X9")


def test_kiefer_mit_code_null_ist_fuer_beide_pilze_ein_guter_baum() -> None:
    assert baumart_punkte("steinpilz", 0) == 1.0
    assert baumart_punkte("pfifferling", 0) == 1.0


def test_erle_und_kronenverlust_sind_kein_lebensraum() -> None:
    assert baumart_punkte("pfifferling", 8) == 0.0
    assert baumart_punkte("steinpilz", 666) == 0.0


def test_pfifferling_bevorzugt_arme_boeden_und_steinpilz_mittlere() -> None:
    ziemlich_arm = [Standortanteil(code="Z2", anteil=10)]
    kraeftig = [Standortanteil(code="K2", anteil=10)]
    assert boden_punkte("pfifferling", ziemlich_arm) > boden_punkte("pfifferling", kraeftig)
    assert boden_punkte("steinpilz", [Standortanteil(code="M2", anteil=10)]) == 1.0


def test_mischflaeche_wird_nach_anteilen_gemittelt() -> None:
    anteile = [Standortanteil(code="Z2", anteil=6), Standortanteil(code="NK2", anteil=4)]
    assert boden_punkte("pfifferling", anteile) == pytest.approx(0.6)


def test_anteile_die_nicht_zehn_zehntel_ergeben_melden_eine_verletzte_invariante() -> None:
    with pytest.raises(ValueError, match="Anteile ergeben 7"):
        boden_punkte("steinpilz", [Standortanteil(code="Z2", anteil=7)])


@pytest.mark.parametrize(
    ("wert", "stufe"), [(1.0, 100), (0.6, 80), (0.2, 60), (0.19, KEIN_HABITAT), (0.0, KEIN_HABITAT)]
)
def test_habitat_wert_wird_auf_anzeigestufen_von_50_bis_100_abgebildet(wert: float, stufe: int) -> None:
    assert anzeige_stufe(wert) == stufe
