(function () {
  "use strict";

  var chartId = "gold-volatility-chart";
  var data = Array.isArray(window.goldVolatilityData) ? window.goldVolatilityData : [];

  function parseDate(value) {
    var parts = String(value).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDate(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function subtractYears(date, years) {
    var result = new Date(date.getTime());
    result.setFullYear(result.getFullYear() - years);
    return result;
  }

  function buildSignalShapes() {
    var shapes = [];
    var startIndex = -1;

    function pushShape(endIndex) {
      if (startIndex < 0) return;
      var endDate;
      if (endIndex < data.length) {
        endDate = data[endIndex].date;
      } else {
        var last = parseDate(data[data.length - 1].date);
        last.setDate(last.getDate() + 1);
        endDate = formatDate(last);
      }
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: data[startIndex].date,
        x1: endDate,
        y0: 0,
        y1: 1,
        layer: "below",
        fillcolor: "rgba(241, 184, 77, 0.20)",
        line: { width: 0 }
      });
      startIndex = -1;
    }

    data.forEach(function (row, index) {
      if (Number(row.signal) === 1 && startIndex < 0) {
        startIndex = index;
      }
      if (Number(row.signal) !== 1 && startIndex >= 0) {
        pushShape(index);
      }
    });
    pushShape(data.length);
    return shapes;
  }

  function getPeriodStart(label, latest) {
    if (label === "YTD") {
      return new Date(latest.getFullYear(), 0, 1);
    }
    if (label === "1年") {
      return subtractYears(latest, 1);
    }
    if (label === "3年") {
      return subtractYears(latest, 3);
    }
    return parseDate(data[0].date);
  }

  function chartWidth(chart) {
    var frame = chart.closest(".chart-frame");
    return Math.max(320, frame ? frame.clientWidth : chart.clientWidth);
  }

  function render() {
    var chart = document.getElementById(chartId);
    if (!chart) return;

    if (!window.Plotly) {
      chart.innerHTML = '<p class="date-message">图表库加载失败，请检查网络后刷新页面。</p>';
      return;
    }

    if (!data.length) {
      chart.innerHTML = '<p class="date-message">暂无黄金隐含波动率数据。</p>';
      return;
    }

    var dates = data.map(function (row) { return row.date; });
    var gvz = data.map(function (row) { return Number(row.gvz); });
    var goldSpot = data.map(function (row) { return Number(row.gold_spot); });
    var latest = parseDate(dates[dates.length - 1]);
    var first = parseDate(dates[0]);
    var latestLabel = formatDate(latest);
    var updateDate = document.getElementById("goldUpdateDate");
    if (updateDate) {
      updateDate.textContent = "数据更新至 " + latestLabel;
    }
    var width = chartWidth(chart);
    var shapes = buildSignalShapes();

    var traces = [
      {
        x: dates,
        y: gvz,
        type: "scatter",
        mode: "lines",
        name: "黄金隐含波动率（GVZ）",
        line: { color: "#9a6415", width: 2.2 },
        hovertemplate: "日期：%{x}<br>GVZ：%{y:.2f}<extra></extra>"
      },
      {
        x: [dates[0]],
        y: [null],
        type: "scatter",
        mode: "markers",
        name: "阴影代表信号为1",
        marker: {
          symbol: "square",
          size: 13,
          color: "rgba(241, 184, 77, 0.28)",
          line: { color: "rgba(209, 145, 35, 0.65)", width: 1 }
        },
        hoverinfo: "skip"
      },
      {
        x: dates,
        y: goldSpot,
        type: "scatter",
        mode: "lines",
        name: "黄金现价（右）",
        yaxis: "y3",
        line: { color: "#2368c4", width: 2 },
        hovertemplate: "日期：%{x}<br>黄金现价：%{y:.2f}<extra></extra>"
      }
    ];

    var buttons = ["YTD", "1年", "3年", "全部"].map(function (label) {
      var start = label === "全部" ? first : getPeriodStart(label, latest);
      return {
        label: label,
        method: "relayout",
        args: [{ "xaxis.range": [formatDate(start), latestLabel] }]
      };
    });

    var layout = {
      width: width,
      height: 610,
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff",
      font: { family: "Microsoft YaHei, PingFang SC, Arial", color: "#203552" },
      margin: { l: 82, r: 88, t: 84, b: 66 },
      hovermode: "x unified",
      uirevision: "gold-volatility-data",
      shapes: shapes,
      legend: { orientation: "h", x: 0, y: 1.12, font: { size: 12 } },
      updatemenus: [{
        type: "buttons",
        direction: "left",
        x: 1,
        xanchor: "right",
        y: 1.17,
        yanchor: "top",
        active: 3,
        buttons: buttons,
        bgcolor: "#ffffff",
        bordercolor: "#b9c7da",
        font: { color: "#17395f" }
      }],
      xaxis: {
        type: "date",
        showline: true,
        linecolor: "#6f7f92",
        showgrid: false,
        zeroline: false,
        tickfont: { size: 11 },
        rangeslider: { visible: true, thickness: 0.08, bgcolor: "#eef2f7", bordercolor: "#c6d2e2", borderwidth: 1 }
      },
      yaxis: {
        domain: [0, 1],
        title: { text: "" },
        automargin: true,
        showline: true,
        linecolor: "#6f7f92",
        showgrid: false,
        zeroline: false
      },
      yaxis3: {
        overlaying: "y",
        side: "right",
        title: { text: "" },
        showline: true,
        linecolor: "#2368c4",
        tickfont: { color: "#2368c4" },
        tickformat: ",.0f",
        showgrid: false,
        zeroline: false
      }
    };

    Plotly.newPlot(chart, traces, layout, { displayModeBar: false, responsive: true, scrollZoom: false });
  }

  function resize() {
    var chart = document.getElementById(chartId);
    if (!chart || !window.Plotly || !chart.data) return;
    Plotly.relayout(chart, { width: chartWidth(chart) });
  }

  function bind() {
    render();
    window.addEventListener("resize", resize);
  document.querySelectorAll('[data-page-link="page-2"], [data-page="page-2"]').forEach(function (button) {
      button.addEventListener("click", function () {
        window.setTimeout(resize, 100);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
