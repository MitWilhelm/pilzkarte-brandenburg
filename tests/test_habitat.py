"""Tests für die Habitat-Regeln in pipeline/habitat.py."""

import numpy as np
import pytest

from pipeline.habitat import (
    KEIN_HABITAT,
    Standort,
    Standortanteil,
    baumart_punkte,
    boden_punkte,
    gesamtwert,
    lies_standort,
    relative_stufen,
    wirt_codes,
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


def test_relative_stufen_ordnen_nach_mittlerem_rang_und_lassen_kleine_werte_weg() -> None:
    werte = np.array([0.1, 0.3, 0.5, 0.7, 0.9], dtype=np.float32)
    assert relative_stufen(werte).tolist() == [KEIN_HABITAT, 56, 69, 81, 94]


def test_gleiche_werte_bekommen_den_mittleren_rang_ihres_blocks() -> None:
    werte = np.array([0.5, 0.5, 0.8, 0.8], dtype=np.float32)
    assert relative_stufen(werte).tolist() == [63, 63, 88, 88]


def test_gebiet_ohne_habitat_ergibt_nur_nullen() -> None:
    assert relative_stufen(np.zeros(3, dtype=np.float32)).tolist() == [0, 0, 0]


def test_reiner_bestand_behaelt_sechzig_prozent_und_gemischter_den_vollen_wert() -> None:
    eins = np.ones(2, dtype=np.float32)
    misch = np.array([0.0, 1.0], dtype=np.float32)
    assert gesamtwert(eins, eins, misch).tolist() == pytest.approx([0.6, 1.0])


def test_werte_ausserhalb_von_null_bis_eins_melden_eine_verletzte_invariante() -> None:
    zu_gross = np.array([1.5], dtype=np.float32)
    with pytest.raises(ValueError, match="Invariante verletzt: Boden-Werte"):
        gesamtwert(np.ones(1, dtype=np.float32), zu_gross, np.ones(1, dtype=np.float32))


def test_wirtsbaeume_des_pfifferlings_schliessen_erle_und_kronenverlust_aus() -> None:
    assert wirt_codes("pfifferling") == frozenset({0, 1, 2, 3, 4, 5, 6, 7})
