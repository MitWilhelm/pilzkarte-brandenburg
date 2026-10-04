"""Tests für die Habitat-Regeln in pipeline/habitat.py."""

import numpy as np
import pytest

from pipeline.habitat import (
    KEIN_HABITAT,
    STRUKTUR_KEIN_WERT,
    Standort,
    Standortanteil,
    baumart_punkte,
    beschreibe_standort,
    boden_punkte,
    gesamtwert,
    hangfaktor,
    lies_standort,
    mit_wegrand,
    relative_stufen,
    strukturfaktor,
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


def test_standortbeschreibung_nennt_anteile_naehrkraft_und_feuchte_in_worten() -> None:
    anteile = [Standortanteil(code="Z2", anteil=6), Standortanteil(code="NK1", anteil=4)]
    assert beschreibe_standort(anteile) == "60 % ziemlich arm, mäßig frisch (Z2) · 40 % kräftig, nass (NK1)"


def test_steinpilz_bewertet_arme_und_ziemlich_arme_sandboeden_gleich_gut() -> None:
    assert boden_punkte("steinpilz", [Standortanteil(code="A2", anteil=10)]) == 1.0
    assert boden_punkte("steinpilz", [Standortanteil(code="Z2", anteil=10)]) == 1.0
    assert boden_punkte("steinpilz", [Standortanteil(code="K2", anteil=10)]) < 1.0


def test_wegrand_hebt_den_wert_an_deckelt_bei_eins_und_laesst_null_bei_null() -> None:
    wert = np.array([[0.5, 0.95, 0.0, 0.5]], dtype=np.float32)
    nahe = np.array([[True, True, True, False]])
    ergebnis = mit_wegrand(wert, nahe)
    assert ergebnis[0].tolist() == pytest.approx([0.575, 1.0, 0.0, 0.5])


def test_junger_bestand_ist_fuer_den_steinpilz_kaum_geeignet_mittelalter_am_besten() -> None:
    hoehe = np.array([[2.0, 10.0, 20.0, 30.0]], dtype=np.float32)
    schluss = np.full(hoehe.shape, 0.7, dtype=np.float32)
    faktor = strukturfaktor("steinpilz", hoehe, schluss)[0]
    assert faktor[0] == pytest.approx(0.1)
    assert faktor[0] < faktor[1] < faktor[2]
    assert faktor[2] == pytest.approx(1.0)
    assert faktor[3] < faktor[2]


def test_ohne_hoehendaten_bleibt_der_strukturfaktor_neutral() -> None:
    leer = np.full((1, 2), STRUKTUR_KEIN_WERT, dtype=np.float32)
    assert strukturfaktor("pfifferling", leer, leer).tolist() == [[1.0, 1.0]]


def test_nordhang_wird_aufgewertet_suedhang_abgewertet_ebene_bleibt_neutral() -> None:
    # Gelände steigt nach Süden (Zeilen nach unten) um 10 m je 10-m-Pixel: steiler Nordhang.
    nordhang = np.array([[0.0, 0.0], [10.0, 10.0], [20.0, 20.0]], dtype=np.float32)
    assert hangfaktor(nordhang, 10.0)[1, 0] == pytest.approx(1.15)
    assert hangfaktor(-nordhang, 10.0)[1, 0] == pytest.approx(0.85)
    assert hangfaktor(np.zeros((3, 3), dtype=np.float32), 10.0)[1, 1] == pytest.approx(1.0)
