(function () {
  "use strict";

  var dataset = window.GOLD_SIGNAL_SERIES_DATA;
  var monitorDataset = window.GOLD_MONITOR_DATA;
  var chartIds = [];

  function parseDate(value) {
    var parts = String(value).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDate(value) {
    var date = value instanceof Date ? value : parseDate(value);
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  function chineseDate(value) {
    var date = value instanceof Date ? value : parseDate(value);
    return date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日";
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

  function periodRange(dates, startDate, label) {
    var latest = parseDate(dates[dates.length - 1]);
    var first = parseDate(startDate || dates[0]);
    var start;
    if (label === "YTD") start = new Date(latest.getFullYear(), 0, 1);
    else if (label === "1年") start = subtractYears(latest, 1);
    else if (label === "3年") start = subtractYears(latest, 3);
    else start = first;
    return [formatDate(start), formatDate(latest)];
  }

  function chartWidth(element) {
    return Math.max(300, element.clientWidth || 300);
  }

  function isCompactChart(element) {
    if (element.clientWidth > 0) return element.clientWidth < 520;
    return window.innerWidth < 720;
  }

  function renderPeriodControls(element, dates, startDate, activeLabel) {
    var card = element.closest(".gold-signal-chart-card");
    var title = card && card.querySelector("h3");
    if (!card || !title) return;

    var header = card.querySelector(".gold-signal-chart-head");
    if (!header) {
      header = document.createElement("div");
      header.className = "gold-signal-chart-head";
      title.parentNode.insertBefore(header, title);
      header.appendChild(title);
    }

    var controls = header.querySelector(".gold-signal-period-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "gold-signal-period-controls";
      controls.setAttribute("aria-label", "日期范围");
      header.appendChild(controls);
    }

    controls.innerHTML = "";
    ["YTD", "1年", "3年", "全部"].forEach(function (label) {
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.className = label === activeLabel ? "is-active" : "";
      button.setAttribute("aria-pressed", label === activeLabel ? "true" : "false");
      button.addEventListener("click", function () {
        Plotly.relayout(element, { "xaxis.range": periodRange(dates, startDate, label) });
        controls.querySelectorAll("button").forEach(function (item) {
          var selected = item === button;
          item.classList.toggle("is-active", selected);
          item.setAttribute("aria-pressed", selected ? "true" : "false");
        });
      });
      controls.appendChild(button);
    });
  }

  function renderBasisLegend(element) {
    var card = element.closest(".gold-signal-chart-card");
    if (!card) return;
    var legend = card.querySelector(".gold-signal-basis-legend");
    if (!legend) {
      legend = document.createElement("div");
      legend.className = "gold-signal-basis-legend";
      legend.setAttribute("aria-label", "图例");
      legend.innerHTML = [
        '<span><i class="gold-signal-legend-line gold-signal-legend-line--raw"></i>原始期限基差</span>',
        '<span><i class="gold-signal-legend-line gold-signal-legend-line--ma"></i>基差 MA60</span>',
        '<span><i class="gold-signal-legend-box"></i>T+1 基差信号为 1</span>'
      ].join("");
      card.insertBefore(legend, element);
    }
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
      hovertemplate: "日期：%{x|%Y年%-m月%-d日}<br>" + name + "：%{y:,.2f}<extra></extra>"
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderSummary(groupKey) {
    if (!monitorDataset || !monitorDataset.summary) return;
    var element = document.getElementById(groupKey + "-signal-summary");
    var rows = monitorDataset.summary[groupKey] || [];
    if (!element || !rows.length) return;

    element.innerHTML = [
      '<table class="gold-monitor-table">',
      '<thead><tr><th>指标</th><th>频率</th><th>最新确认期</th><th>当前生效信号</th><th>当前状态</th><th>信号计算规则</th></tr></thead>',
      '<tbody>',
      rows.map(function (row) {
        var active = Number(row.signal) === 1;
        return '<tr>'
          + '<td><strong>' + escapeHtml(row.indicator) + '</strong></td>'
          + '<td>' + escapeHtml(row.frequency) + '</td>'
          + '<td>' + escapeHtml(chineseDate(row.confirmed)) + '</td>'
          + '<td><span class="gold-monitor-signal gold-monitor-signal--' + (active ? 'on' : 'off') + '">' + escapeHtml(row.signal) + '</span></td>'
          + '<td><span class="gold-monitor-status gold-monitor-status--' + (active ? 'on' : 'off') + '">' + escapeHtml(row.status) + '</span></td>'
          + '<td class="gold-monitor-rule">' + escapeHtml(row.rule) + '</td>'
          + '</tr>';
      }).join(""),
      '</tbody></table>'
    ].join("");
  }

  function renderBasisChart() {
    if (!monitorDataset || !monitorDataset.basis) return false;
    var element = document.getElementById("daily-basis");
    if (!element) return false;

    var basis = monitorDataset.basis;
    var dates = basis.dates;
    var latest = parseDate(dates[dates.length - 1]);
    var defaultStart = subtractYears(latest, 3);
    var compact = isCompactChart(element);
    var customData = dates.map(function (_, index) {
      var percentile = basis.percentile[index];
      return [
        percentile == null ? null : percentile * 100,
        basis.currentSignal[index],
        basis.t1Signal[index]
      ];
    });

    chartIds.push("daily-basis");
    var traces = [
      {
        x: dates,
        y: basis.raw,
        customdata: customData,
        type: "scatter",
        mode: "lines",
        name: "原始期限基差",
        line: { color: "#165aa7", width: 1.7 },
        hovertemplate: "日期：%{x|%Y年%-m月%-d日}<br>原始期限基差：%{y:,.2f}<br>MA60近三年分位数：%{customdata[0]:.2f}%<br>当日基差状态信号：%{customdata[1]}<br>T+1基差信号：%{customdata[2]}<extra></extra>"
      },
      {
        x: dates,
        y: basis.ma60,
        type: "scatter",
        mode: "lines",
        name: "基差 MA60",
        line: { color: "#d08322", width: 2.1 },
        hovertemplate: "基差 MA60：%{y:,.2f}<extra></extra>"
      },
      {
        x: [dates[0]],
        y: [null],
        type: "scatter",
        mode: "markers",
        name: "T+1 基差信号为 1",
        marker: { symbol: "square", size: 13, color: "rgba(89, 145, 207, 0.25)", line: { color: "rgba(89, 145, 207, 0.65)", width: 1 } },
        hoverinfo: "skip"
      },
      {
        x: dates,
        y: basis.t1Signal,
        yaxis: "y2",
        type: "scatter",
        mode: "lines",
        line: { width: 0 },
        opacity: 0,
        showlegend: false,
        hoverinfo: "skip"
      }
    ];

    var layout = {
      width: chartWidth(element),
      height: compact ? 450 : 465,
      autosize: false,
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff",
      font: { family: "Microsoft YaHei, PingFang SC, Arial", color: "#203552", size: 11 },
      margin: { l: compact ? 54 : 64, r: compact ? 46 : 62, t: compact ? 82 : 68, b: compact ? 62 : 69 },
      hovermode: "x unified",
      uirevision: "daily-basis",
      showlegend: false,
      shapes: signalShapes(dates, basis.t1Signal, "daily"),
      xaxis: {
        type: "date",
        tickformat: "%Y年%-m月",
        unifiedhovertitle: { text: "<b>%{x|%Y年%-m月%-d日}</b>" },
        range: [formatDate(defaultStart), formatDate(latest)],
        showline: true,
        linecolor: "#7f8da0",
        showgrid: false,
        zeroline: false,
        tickfont: { size: 10 },
        rangeslider: {
          visible: true,
          thickness: 0.09,
          bgcolor: "#edf3f9",
          bordercolor: "#c8d5e4",
          borderwidth: 1
        }
      },
      yaxis: {
        title: { text: "基差", font: { size: 11 } },
        automargin: true,
        showline: true,
        linecolor: "#7f8da0",
        showgrid: false,
        zeroline: true,
        zerolinecolor: "#aeb8c5",
        tickformat: ".1f"
      },
      yaxis2: {
        title: { text: "信号（0/1）", font: { size: 11 } },
        overlaying: "y",
        side: "right",
        range: [0, 1],
        tickvals: [0, 1],
        showgrid: false,
        showline: true,
        linecolor: "#7f8da0",
        zeroline: false
      }
    };

    Plotly.newPlot(element, traces, layout, { displayModeBar: false, responsive: true, scrollZoom: false });
    renderBasisLegend(element);
    renderPeriodControls(element, dates, dates[0], "3年");
    return true;
  }

  function renderChart(groupKey, group, chart) {
    var element = document.getElementById(chart.id);
    if (!element) return;
    chartIds.push(chart.id);
    var compact = isCompactChart(element);

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
      margin: { l: compact ? 54 : 64, r: compact ? 12 : 26, t: compact ? 72 : 42, b: 54 },
      hovermode: "x unified",
      uirevision: chart.id,
      shapes: signalShapes(group.dates, chart.signal, groupKey),
      legend: { orientation: "h", x: 0, y: compact ? 1.18 : 1.1, yanchor: compact ? "top" : "bottom", font: { size: compact ? 9 : 11 } },
      xaxis: {
        type: "date",
        tickformat: "%Y年%-m月",
        unifiedhovertitle: { text: "<b>%{x|%Y年%-m月%-d日}</b>" },
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
    renderPeriodControls(element, group.dates, chart.startDate, "全部");
  }

  function render() {
    if (!dataset || !window.Plotly) return;
    ["monthly", "daily"].forEach(function (groupKey) {
      var group = dataset[groupKey];
      var update = document.getElementById(groupKey + "SignalUpdate");
      var monitorRows = monitorDataset && monitorDataset.summary && monitorDataset.summary[groupKey];
      var monitorDate = monitorRows && monitorRows.length ? monitorRows[0].confirmed : group.asOf;
      if (groupKey === "daily" && monitorDataset && monitorDataset.basis && monitorDataset.basis.dates.length) {
        monitorDate = monitorDataset.basis.dates[monitorDataset.basis.dates.length - 1];
      }
      if (update) update.textContent = "数据更新至 " + chineseDate(monitorDate);
      renderSummary(groupKey);
      group.charts.forEach(function (chart) {
        if (chart.id === "daily-basis" && renderBasisChart()) return;
        renderChart(groupKey, group, chart);
      });
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
