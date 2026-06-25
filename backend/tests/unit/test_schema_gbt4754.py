"""Tests for GB/T 4754-2017 middle category code whitelist."""
import pytest

from backend.schema.gbt4754 import (
    GBT4754_MIDDLE_CATEGORIES,
    get_category_for_code,
    get_label_for_code,
    is_valid_middle_category_code,
)


class TestMiddleCategoryList:
    def test_至少_90_项中类(self):
        # GB/T 4754-2017 中类共 100+ 项,实施时确认最新版本
        assert len(GBT4754_MIDDLE_CATEGORIES) >= 90

    def test_每项包含_code_label_category_三个键(self):
        for item in GBT4754_MIDDLE_CATEGORIES:
            assert set(item.keys()) == {"code", "label", "category"}

    def test_代码格式为字母加两位数字(self):
        # 格式: 1 个大写字母 + 2 位数字 (例如 "C17")
        for item in GBT4754_MIDDLE_CATEGORIES:
            code = item["code"]
            assert len(code) == 3, f"code {code!r} length must be 3"
            assert code[0].isalpha() and code[0].isupper(), f"code {code!r} first char must be uppercase letter"
            assert code[1:].isdigit(), f"code {code!r} last 2 chars must be digits"

    def test_大类代码在A到T范围(self):
        # GB/T 4754 大类 A-T (20 大类)
        valid = set("ABCDEFGHIJKLMNOPQRST")
        for item in GBT4754_MIDDLE_CATEGORIES:
            assert item["category"] in valid, f"category {item['category']!r} not in A-T"

    def test_code唯一(self):
        codes = [item["code"] for item in GBT4754_MIDDLE_CATEGORIES]
        assert len(codes) == len(set(codes)), "codes must be unique"


class TestIsValidMiddleCategoryCode:
    def test_合法代码_C17_返回_True(self):
        # C17 纺织业
        assert is_valid_middle_category_code("C17") is True

    def test_合法代码_A01_返回_True(self):
        assert is_valid_middle_category_code("A01") is True

    def test_合法代码_T96_返回_True(self):
        # T96 国际组织 (最后一个中类)
        assert is_valid_middle_category_code("T96") is True

    def test_非法代码_XX99_返回_False(self):
        assert is_valid_middle_category_code("XX99") is False

    def test_非法代码_C99_返回_False(self):
        # C99 不存在
        assert is_valid_middle_category_code("C99") is False

    def test_非法代码_小写_返回_False(self):
        assert is_valid_middle_category_code("c17") is False

    def test_空字符串_返回_False(self):
        assert is_valid_middle_category_code("") is False


class TestGetCategoryForCode:
    def test_C17_返回_C(self):
        assert get_category_for_code("C17") == "C"

    def test_A01_返回_A(self):
        assert get_category_for_code("A01") == "A"

    def test_T96_返回_T(self):
        assert get_category_for_code("T96") == "T"

    def test_不存在的代码_返回_None(self):
        assert get_category_for_code("XX99") is None


class TestGetLabelForCode:
    def test_C17_返回_纺织业(self):
        assert get_label_for_code("C17") == "纺织业"

    def test_不存在的代码_返回_None(self):
        assert get_label_for_code("XX99") is None
