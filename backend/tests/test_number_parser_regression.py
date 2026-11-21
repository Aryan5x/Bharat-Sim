import re
import pytest


def number(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = re.match(r"^\s*(-?\d+(?:\.\d+)?)", value)
        return float(match.group(1)) if match else None
    return None


def test_number_parsing():
    assert number(123) == 123.0
    assert number(45.67) == 45.67
    assert number(True) is None
    assert number(False) is None
    assert number(" 142.5ms ") == 142.5
    assert number("200") == 200.0
    assert number("-15.2 MB") == -15.2
    assert number("N/A") is None
    assert number(None) is None
