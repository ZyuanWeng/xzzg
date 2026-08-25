(function () {
  "use strict";

  var dataset = window.GOLD_SIGNAL_SERIES_DATA;
  var chartIds = [];

  function parseDate(value) {
    var parts = String(value).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDate(value) {
    var date = value instanceof Date ? value : parseDate(value);
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  function subtractYears(date, years) {
    var result = new Date(date.getTime());
    result.setFullYear(result.getFullYear() - years);
    return result;
  }

  function nextDate(dates, index, frequency) {
    if (index + 1 < dates.length) return dates[index + 1];
    var result = parseDate(dates[index]);
    if (frequency === "monthly") result.setMonth(result.getMonth() + 1);
    else result.setDate(result.getDate() + 1);
    return formatDate(result);
  }

  function signalShapes(dates, signal, frequency) {
    var shapes = [];
    var start = -1;

    function close(endIndex) {
      if (start < 0) return;
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: dates[start],
        x1: nextDate(dates, Math.max(start, endIndex - 1), frequency),
        y0: 0,
        y1: 1,
        layer: "below",
        fillcolor: "rgba(89, 145, 207, 0.20)",
        line: { width: 0 }
      });
      start = -1;
    }

    signal.forEach(function (value, index) {
      if (Number(value) === 1 && start < 0) start = index;
      if (Number(value) !== 1 && start >= 0) close(index);
    });
    if (start >= 0) close(dates.length);
    return shapes;
  }

  function valueTickFormat(chart) {
    var values = (chart.values || []).concat(chart.secondaryValues || []).filter(function (value) { return typeof value === "number"; });
    var max = values.reduce(function (current, value) { return Math.max(current, Math.abs(value)); }, 0);
    return max >= 1000 ? ",.0f" : ".1f";
  }

  function periodButtons(dates, startDate) {
    var latest = parseDate(dates[dates.length - 1]);
    var first = parseDate(startDate || dates[0]);
    return ["YTD", "1年", "3年", "全部"].map(function (label) {
      var start;
      if (label === "YTD") start = new Date(latest.getFullYear(), 0, 1);
      else if (label === "1年") start = subtractYears(latest, 1);
      else if (label === "3年") start = subtractYears(latest, 3);
      else start = first;
      return { label: label, method: "relayout", args: [{ "xaxis.range": [formatDate(start), formatDate(latest)] }] };
    });
  }

  function chartWidth(element) {
    return Math.max(300, element.clientWidth || 300);
  }

  function lineTrace(dates, values, name, color, width) {
    return {
      x: dates,
      y: values,
      type: "scatter",
      mode: "lines",
      name: name,
      connectgaps: false,
      line: { color: color, width: width || 2 },
      hovertemplate: "日期：%{x}<br>" + name + "：%{y:,.2f}<extra></extra>"
    };
  }

  function renderChart(groupKey, group, chart) {
    var element = document.getElementById(chart.id);
    if (!element) return;
    chartIds.push(chart.id);
    var compact = chartWidth(element) < 520;

    var traces = [
      lineTrace(group.dates, chart.values, chart.valueLabel, "#165aa7", 2),
      {
        x: [group.dates[0]],
        y: [null],
        type: "scatter",
        mode: "markers",
        name: "阴影代表信号为 1",
        marker: { symbol: "square", size: 13, color: "rgba(89, 145, 207, 0.25)", line: { color: "rgba(89, 145, 207, 0.65)", width: 1 } },
        hoverinfo: "skip"
      }
    ];
    if (chart.secondaryValues) traces.splice(1, 0, lineTrace(group.dates, chart.secondaryValues, chart.secondaryLabel, "#c49332", 1.8));

    var layout = {
      width: chartWidth(element),
      height: compact ? 430 : 390,
      autosize: false,
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff",
      font: { family: "Microsoft YaHei, PingFang SC, Arial", color: "#203552", size: 11 },
      margin: { l: compact ? 54 : 64, r: compact ? 12 : 26, t: compact ? 122 : 82, b: 54 },
      hovermode: "x unified",
      uirevision: chart.id,
      shapes: signalShapes(group.dates, chart.signal, groupKey),
      legend: { orientation: "h", x: 0, y: compact ? 1.1 : 1.14, font: { size: compact ? 9 : 11 } },
      updatemenus: [{
        type: "buttons",
        direction: "left",
        x: compact ? 0 : 1,
        xanchor: compact ? "left" : "right",
        y: compact ? 1.36 : 1.2,
        yanchor: "top",
        active: 3,
        buttons: periodButtons(group.dates, chart.startDate),
        bgcolor: "#ffffff",
        bordercolor: "#b9c7da",
        font: { color: "#17395f", size: 10 },
        pad: { l: 2, r: 2, t: 1, b: 1 }
      }],
      xaxis: {
        type: "date",
        range: [chart.startDate || group.dates[0], group.dates[group.dates.length - 1]],
        showline: true,
        linecolor: "#7f8da0",
        showgrid: false,
        zeroline: false,
        tickfont: { size: 10 },
        rangeslider: { visible: false }
      },
      yaxis: {
        automargin: true,
        showline: true,
        linecolor: "#7f8da0",
        showgrid: false,
        zeroline: true,
        zerolinecolor: "#aeb8c5",
        tickformat: valueTickFormat(chart)
      }
    };

    Plotly.newPlot(element, traces, layout, { displayModeBar: false, responsive: true, scrollZoom: false });
  }

  function render() {
    if (!dataset || !window.Plotly) return;
    ["monthly", "daily"].forEach(function (groupKey) {
      var group = dataset[groupKey];
      var update = document.getElementById(groupKey + "SignalUpdate");
      if (update) update.textContent = "数据更新至 " + group.asOf;
      group.charts.forEach(function (chart) { renderChart(groupKey, group, chart); });
    });
  }

  function resize() {
    if (!window.Plotly) return;
    chartIds.forEach(function (id) {
      var element = document.getElementById(id);
      if (element && element.data && element.offsetParent) Plotly.relayout(element, { width: chartWidth(element) });
    });
  }

  function bind() {
    render();
    window.addEventListener("resize", resize);
    document.querySelectorAll('[data-page-link="page-2"], [data-page="page-2"]').forEach(function (control) {
      control.addEventListener("click", function () { window.setTimeout(resize, 120); });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
