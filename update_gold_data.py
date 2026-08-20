import json
import sys
from pathlib import Path

import pandas as pd


PROJECT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = Path.home() / "Downloads" / "黄金隐含波动率2.xlsx"
OUTPUT_FILE = PROJECT_DIR / "assets" / "gold-volatility-data.js"
REQUIRED_COLUMNS = {"date", "GVZ", "signal", "gold_spot"}


def main() -> None:
    input_file = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_INPUT

    if not input_file.exists():
        raise FileNotFoundError(f"没有找到 Excel 文件：{input_file}")

    frame = pd.read_excel(input_file)
    frame.columns = [str(column).strip() for column in frame.columns]

    missing = REQUIRED_COLUMNS.difference(frame.columns)
    if missing:
        raise ValueError(f"Excel 缺少字段：{', '.join(sorted(missing))}")

    frame = frame[["date", "GVZ", "signal", "gold_spot"]].copy()
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame["GVZ"] = pd.to_numeric(frame["GVZ"], errors="coerce")
    frame["signal"] = pd.to_numeric(frame["signal"], errors="coerce")
    frame["gold_spot"] = pd.to_numeric(frame["gold_spot"], errors="coerce")
    frame = frame.dropna(subset=["date", "GVZ", "signal", "gold_spot"])
    frame["signal"] = frame["signal"].astype(int)

    invalid_signals = sorted(set(frame["signal"]) - {0, 1})
    if invalid_signals:
        raise ValueError(f"signal 列只能填写 0 或 1，发现：{invalid_signals}")

    frame = frame.sort_values("date").drop_duplicates("date", keep="last")
    records = [
        {
            "date": row.date.strftime("%Y-%m-%d"),
            "gvz": round(float(row.GVZ), 4),
            "signal": int(row.signal),
            "gold_spot": round(float(row.gold_spot), 4),
        }
        for row in frame.itertuples(index=False)
    ]

    content = "window.goldVolatilityData = " + json.dumps(
        records,
        ensure_ascii=True,
        separators=(",", ":"),
    ) + ";\n"
    OUTPUT_FILE.write_text(content, encoding="utf-8")

    print(f"更新完成：{OUTPUT_FILE}")
    print(f"共写入 {len(records)} 行，最新日期：{records[-1]['date']}")
    print("回到浏览器按 Ctrl + F5 查看新数据。")


if __name__ == "__main__":
    main()
