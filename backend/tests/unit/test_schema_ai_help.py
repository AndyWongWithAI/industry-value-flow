from schema.ai_help import AIHelp

def test_ai_help_creation():
    h = AIHelp(use_case="产量预测", capability="时序模型", example="玉米 30 天预测", roi_estimate="增收 5%")
    assert h.use_case == "产量预测"