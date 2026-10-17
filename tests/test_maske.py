"""Tests für den weichen Übergang am Barnim-Rand (pipeline/maske.py)."""

import numpy as np
import pytest

from pipeline.maske import verlauf_ausserhalb


def _quadrat() -> np.ndarray:
    innen = np.zeros((101, 101), dtype=bool)
    innen[30:71, 30:71] = True
    return innen


def test_innerhalb_der_flaeche_bleibt_die_karte_farbig() -> None:
    alpha = verlauf_ausserhalb(_quadrat(), sigma_pixel=4.0, deckkraft_aussen=200)
    assert alpha[50, 50] == 0
    assert alpha[40, 40] == 0


def test_weit_ausserhalb_gilt_die_volle_deckkraft() -> None:
    alpha = verlauf_ausserhalb(_quadrat(), sigma_pixel=4.0, deckkraft_aussen=200)
    assert alpha[2, 2] == 200
    assert alpha[98, 50] == 200


def test_der_uebergang_nach_aussen_wird_stetig_dunkler() -> None:
    alpha = verlauf_ausserhalb(_quadrat(), sigma_pixel=4.0, deckkraft_aussen=200)
    zeile = alpha[50, 71:90].astype(int)  # von der rechten Kante nach außen
    assert zeile[0] < 40
    assert zeile[-1] > 150
    assert (np.diff(zeile) >= 0).all()


def test_ungueltige_parameter_sind_verletzte_invarianten() -> None:
    with pytest.raises(ValueError, match="Invariante verletzt: Sigma"):
        verlauf_ausserhalb(_quadrat(), sigma_pixel=0.0, deckkraft_aussen=200)
    with pytest.raises(ValueError, match="Invariante verletzt: Deckkraft"):
        verlauf_ausserhalb(_quadrat(), sigma_pixel=4.0, deckkraft_aussen=0)
