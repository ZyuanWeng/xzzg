import json
import sys
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET


PROJECT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = Path.home() / "Downloads" / "网站图表-固收.xlsx"
OUTPUT_FILE = PROJECT_DIR / "fixed-income-data.js"
EXCEL_EPOCH = datetime(1899, 12, 30)
NS = {"c": "http://schemas.openxmlformats.org/drawingml/2006/chart"}

CHARTS = [
    {
        "number": 1,
        "id": "global-10y",
        "group": "global-rates",
        "title": "主要经济体10年期国债收益率",
        "subtitle": "收益率（%）",
        "unit": "%",
        "decimals": 3,
        "order": ["中国", "美国", "日本", "德国", "英国", "法国"],
    },
    {
        "number": 2,
        "id": "china-us-spread",
        "group": "global-rates",
        "title": "中美10年期国债收益率与利差",
        "subtitle": "收益率（%） / 利差（bp，右轴）",
        "unit": "%",
        "decimals": 3,
        "kind": "spread-combo",
        "order": ["中美利差（bp，右轴）", "中国", "美国"],
        "aliases": {"中美利差（bp，右轴）": "中美利差"},
    },
    {
        "number": 3,
        "id": "credit-spread",
        "group": "credit-spread",
        "title": "中国信用利差",
        "subtitle": "企业债收益率相对国债利差（bp）",
        "unit": "bp",
        "decimals": 1,
        "order": ["AAA:1Y", "AAA:5Y", "AAA:10Y", "AA+:1Y", "AA+:5Y", "AA+:10Y"],
        "aliases": {
            "AAA:1Y": "AAA 1年",
            "AAA:5Y": "AAA 5年",
            "AAA:10Y": "AAA 10年",
            "AA+:1Y": "AA+ 1年",
            "AA+:5Y": "AA+ 5年",
            "AA+:10Y": "AA+ 10年",
        },
    },
    {
        "number": 4,
        "id": "treasury-curve",
        "group": "domestic-market",
        "title": "国债收益率曲线",
        "subtitle": "1年、5年、10年与30年期限（%）",
        "unit": "%",
        "decimals": 3,
        "order": ["国债1Y", "国债5Y", "国债10Y", "国债30Y"],
        "aliases": {"国债1Y": "1年", "国债5Y": "5年", "国债10Y": "10年", "国债30Y": "30年"},
    },
    {
        "number": 5,
        "id": "policy-bank-curve",
        "group": "domestic-market",
        "title": "国开债收益率曲线",
        "subtitle": "1年、5年、10年与30年期限（%）",
        "unit": "%",
        "decimals": 3,
        "order": ["国开债1Y", "国开债5Y", "国开债10Y", "国开债30Y"],
        "aliases": {"国开债1Y": "1年", "国开债5Y": "5年", "国开债10Y": "10年", "国开债30Y": "30年"},
    },
    {
        "number": 6,
        "id": "treasury-futures",
        "group": "domestic-market",
        "title": "国债期货主力合约",
        "subtitle": "活跃合约结算价（元）",
        "unit": "元",
        "decimals": 3,
        "order": ["TS", "TF", "T", "TL"],
        "aliases": {"TS": "TS（2年）", "TF": "TF（5年）", "T": "T（10年）", "TL": "TL（30年）"},
    },
]

GROUPS = [
    {"id": "global-rates", "label": "全球利率", "caption": "主要经济体国债收益率及中美利差"},
    {"id": "credit-spread", "label": "信用利差", "caption": "不同评级与期限的信用风险溢价"},
    {"id": "domestic-market", "label": "境内债市", "caption": "国债、国开债及国债期货"},
]


def cache_values(node, cache_type):
    if node is None:
        return []
    cache = node.find(f".//c:{cache_type}Cache", NS)
    if cache is None:
        return []
    count_node = cache.find("c:ptCount", NS)
    count = int(count_node.attrib.get("val", 0)) if count_node is not None else 0
    points = {}
    for point in cache.findall("c:pt", NS):
        value = point.find("c:v", NS)
        if value is not None:
            points[int(point.attrib.get("idx", len(points)))] = value.text
    if not count and points:
        count = max(points) + 1
    return [points.get(index) for index in range(count)]


def series_name(series):
    text_node = series.find("c:tx", NS)
    cached = cache_values(text_node, "str")
    if cached and cached[0]:
        return str(cached[0]).strip()
    literal = text_node.find("c:v", NS) if text_node is not None else None
    if literal is not None and literal.text:
        return literal.text.strip()
    formula = text_node.find(".//c:f", NS) if text_node is not None else None
    return formula.text.strip() if formula is not None and formula.text else "数据序列"


def number_or_none(value):
    if value in (None, "", "#N/A"):
        return None
    try:
        return round(float(value), 6)
    except (TypeError, ValueError):
        return None


def excel_date(value):
    try:
        return (EXCEL_EPOCH + timedelta(days=float(value))).strftime("%Y-%m-%d")
    except (TypeError, ValueError, OverflowError):
        return None


def find_input_file():
    if DEFAULT_INPUT.exists():
        return DEFAULT_INPUT
    candidates = [path for path in DEFAULT_INPUT.parent.glob("*固收*.xlsx") if not path.name.startswith("~$")]
    if not candidates:
        return DEFAULT_INPUT
    return max(candidates, key=lambda path: path.stat().st_mtime)


def extract_chart(archive, config):
    chart_path = f"xl/charts/chart{config['number']}.xml"
    if chart_path not in archive.namelist():
        raise ValueError(f"Excel 中没有找到 {chart_path}")

    root = ET.fromstring(archive.read(chart_path))
    extracted = []
    raw_dates = []

    for series in root.findall(".//c:ser", NS):
        category_node = series.find("c:cat", NS)
        if category_node is None:
            category_node = series.find("c:xVal", NS)
        value_node = series.find("c:val", NS)
        if value_node is None:
            value_node = series.find("c:yVal", NS)

        categories = cache_values(category_node, "num") or cache_values(category_node, "str")
        if categories and not raw_dates:
            raw_dates = [excel_date(value) for value in categories]
        values = [number_or_none(value) for value in cache_values(value_node, "num")]
        extracted.append({"source_name": series_name(series), "values": values})

    if not raw_dates:
        raise ValueError(f"{chart_path} 没有可识别的日期数据")

    valid_indices = [index for index, value in enumerate(raw_dates) if value]
    dates = [raw_dates[index] for index in valid_indices][::-1]
    normalized = []
    for series in extracted:
        values = series["values"]
        aligned = [values[index] if index < len(values) else None for index in valid_indices][::-1]
        source_name = series["source_name"]
        normalized.append({
            "source_name": source_name,
            "name": config.get("aliases", {}).get(source_name, source_name),
            "values": aligned,
        })

    by_name = {series["source_name"]: series for series in normalized}
    ordered = [by_name[name] for name in config.get("order", []) if name in by_name]
    ordered.extend(series for series in normalized if series not in ordered)
    for series in ordered:
        series.pop("source_name", None)

    return {
        "id": config["id"],
        "title": config["title"],
        "subtitle": config["subtitle"],
        "kind": config.get("kind", "line"),
        "unit": config["unit"],
        "decimals": config["decimals"],
        "dates": dates,
        "series": ordered,
        "default_period": "3年",
    }


def main():
    input_file = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else find_input_file()
    if not input_file.exists():
        raise FileNotFoundError(f"没有找到 Excel 文件：{input_file}")

    with zipfile.ZipFile(input_file) as archive:
        charts = [extract_chart(archive, config) for config in CHARTS]

    groups = []
    for group in GROUPS:
        chart_ids = [item["id"] for item in CHARTS if item["group"] == group["id"]]
        groups.append({**group, "charts": [chart for chart in charts if chart["id"] in chart_ids]})

    latest_date = max(chart["dates"][-1] for chart in charts if chart["dates"])
    payload = {
        "meta": {
            "source": input_file.name,
            "source_label": "Wind，兴证资管",
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "latest_date": latest_date,
            "chart_count": len(charts),
        },
        "groups": groups,
    }
    content = "window.fixedIncomeResearchData = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
    OUTPUT_FILE.write_text(content, encoding="utf-8")

    print(f"更新完成：{OUTPUT_FILE}")
    print(f"已写入 {len(charts)} 张固收图表，分为 {len(groups)} 个模块。")
    print(f"数据更新至：{latest_date}")
    print("回到浏览器按 Ctrl + F5 查看新数据。")


if __name__ == "__main__":
    main()
