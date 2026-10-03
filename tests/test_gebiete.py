"""Tests für die reinen Funktionen in pipeline/gebiete.py."""

import numpy as np
import pytest

from pipeline.gebiete import TESTGEBIETE, Untersuchungsgebiet, ausschnitt_in, zaehle_baumarten

TOLERANZ_METER = 1.0


@pytest.mark.parametrize("gebiet", TESTGEBIETE, ids=lambda gebiet: gebiet.name)
def test_ausschnitt_in_utm_ist_ein_6_km_quadrat(gebiet: Untersuchungsgebiet) -> None:
    ausschnitt = ausschnitt_in(gebiet, 25833)
    assert abs((ausschnitt.rechts - ausschnitt.links) - 6000) < TOLERANZ_METER
    assert abs((ausschnitt.oben - ausschnitt.unten) - 6000) < TOLERANZ_METER


def test_ausschnitt_joachimsthal_liegt_in_brandenburg_in_utm_zone_33() -> None:
    ausschnitt = ausschnitt_in(TESTGEBIETE[0], 25833)
    assert 400_000 < ausschnitt.links < 450_000
    assert 5_860_000 < ausschnitt.unten < 5_880_000


def test_ausschnitt_im_dlr_system_ist_etwas_groesser_weil_gedreht() -> None:
    # UTM 33 und LAEA sind bei 13,7° Ost um knapp 4° verdreht:
    # 6000 m * (cos 4° + sin 4°) ≈ 6400 m für das umschließende Rechteck.
    ausschnitt = ausschnitt_in(TESTGEBIETE[0], 3035)
    assert ausschnitt.rechts - ausschnitt.links >= 6000
    assert ausschnitt.rechts - ausschnitt.links < 6500


def test_kiefer_mit_code_null_wird_gezaehlt_und_nicht_als_leer_behandelt() -> None:
    raster = np.array([[0, 0, 7], [999, 5, 0]], dtype=np.uint16)
    assert zaehle_baumarten(raster) == {"Kiefer": 3, "Birke": 1, "Buche": 1}


def test_unbekannter_baumart_code_meldet_eine_verletzte_invariante() -> None:
    raster = np.array([[0, 42]], dtype=np.uint16)
    with pytest.raises(ValueError, match="Invariante verletzt: unbekannter Baumart-Code 42"):
        zaehle_baumarten(raster)
