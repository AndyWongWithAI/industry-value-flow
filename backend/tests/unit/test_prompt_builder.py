from schema.industry import Industry
from domain.prompt_builder import build_pain_point_prompt


def test_prompt_includes_industry_name():
    ind = Industry(id="agriculture", name="农业", color="#4a90e2")
    p = build_pain_point_prompt(ind, ["种植", "畜牧"], "总价值 100 亿元")
    assert "农业" in p
    assert "种植" in p
    assert "畜牧" in p
    assert "100" in p
    assert "JSON" in p


def test_prompt_has_token_upper_bound():
    ind = Industry(id="finance", name="金融", color="#50c878")
    p = build_pain_point_prompt(ind, ["银行", "保险"] * 100, "x" * 5000)
    # 触发 token 上限
    assert len(p) < 16000  # 粗略上限
