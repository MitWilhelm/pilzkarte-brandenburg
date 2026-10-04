"""Tests für die Nachbarschafts-Merkmale in pipeline/nachbarschaft.py."""

import numpy as np

from pipeline.nachbarschaft import fenster_summe, in_der_naehe, mischfaktor

KIEFER = 0
BIRKE = 7
KEIN_WERT = 999


def test_fenstersumme_zaehlt_im_3x3_fenster_und_am_rand_nur_vorhandene_pixel() -> None:
    maske = np.ones((3, 3), dtype=np.bool_)
    assert fenster_summe(maske, 1).tolist() == [[4, 6, 4], [6, 9, 6], [4, 6, 4]]


def test_fenstersumme_mit_radius_null_gibt_die_maske_selbst_zurueck() -> None:
    maske = np.array([[True, False], [False, True]])
    assert fenster_summe(maske, 0).tolist() == [[1, 0], [0, 1]]


def test_fenstersumme_stimmt_mit_einer_direkten_zaehlung_ueberein() -> None:
    zufall = np.random.default_rng(seed=7)
    maske = zufall.random((12, 15)) > 0.5
    erwartet = np.array(
        [[maske[max(0, z - 3) : z + 4, max(0, s - 3) : s + 4].sum() for s in range(15)] for z in range(12)]
    )
    assert np.array_equal(fenster_summe(maske, 3), erwartet)


def test_reiner_kiefernbestand_hat_mischfaktor_null() -> None:
    baumarten = np.full((9, 9), KIEFER, dtype=np.uint16)
    assert mischfaktor(baumarten, frozenset({KIEFER, BIRKE})).max() == 0.0


def test_kiefer_mit_viel_birke_im_umkreis_ist_voll_gemischt() -> None:
    baumarten = np.full((7, 7), KIEFER, dtype=np.uint16)
    baumarten[:, ::2] = BIRKE
    assert mischfaktor(baumarten, frozenset({KIEFER, BIRKE}))[3, 3] == 1.0


def test_wasser_im_umkreis_zaehlt_nicht_in_die_bezugsgroesse() -> None:
    baumarten = np.full((7, 7), KEIN_WERT, dtype=np.uint16)
    baumarten[3, 3] = KIEFER
    baumarten[3, 4] = BIRKE
    assert mischfaktor(baumarten, frozenset({KIEFER, BIRKE}))[3, 3] == 1.0


def test_in_der_naehe_markiert_pixel_bis_zum_radius_um_einen_weg() -> None:
    maske = np.zeros((1, 7), dtype=bool)
    maske[0, 3] = True
    assert in_der_naehe(maske, 2).tolist() == [[False, True, True, True, True, True, False]]
