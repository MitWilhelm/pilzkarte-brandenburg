"""Tests für die reinen Funktionen in pipeline/gebiete.py."""

import numpy as np
import pytest

from pipeline.gebiete import zaehle_baumarten


def test_kiefer_mit_code_null_wird_gezaehlt_und_nicht_als_leer_behandelt() -> None:
    raster = np.array([[0, 0, 7], [999, 5, 0]], dtype=np.uint16)
    assert zaehle_baumarten(raster) == {"Kiefer": 3, "Birke": 1, "Buche": 1}


def test_unbekannter_baumart_code_meldet_eine_verletzte_invariante() -> None:
    raster = np.array([[0, 42]], dtype=np.uint16)
    with pytest.raises(ValueError, match="Invariante verletzt: unbekannter Baumart-Code 42"):
        zaehle_baumarten(raster)
