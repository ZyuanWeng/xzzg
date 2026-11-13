(function () {
  "use strict";
  var page = document.getElementById("page-5");
  var content = document.getElementById("equityResearchContent");
  var nav = document.getElementById("equityCategoryNav");
  var dataset = window.equityResearchData;
  var plots = [];
  var palette = ["#1f5b8f", "#c49332", "#2a9d8f", "#b9574f", "#72a8d4", "#75658e", "#426c51", "#b37c96"];

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function chineseDate(value) {
    var p = value.split("-");
    return p[0] + "年" + Number(p[1]) + "月" + Number(p[2]) + "日";
  }
  function range(chart, period) {
    var end = new Date(chart.end + "T00:00:00Z");
    var start = new Date(chart.start + "T00:00:00Z");
    if (period !== "全部") {
      var candidate = new Date(end);
      if (period === "YTD") candidate = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
      else candidate.setUTCFullYear(end.getUTCFullYear() - (period === "1年" ? 1 : 3));
      if (candidate > start) start = candidate;
    }
    // The boundary leaves the last daily/weekly column completely visible.
    return [new Date(start.getTime() - 3 * 86400000).toISOString(), new Date(end.getTime() + 3 * 86400000).toISOString()];
  }
  function shortName(name) {
    if (name.indexOf("股债性价比（ERP,") === 0) return "股债性价比（ERP）";
    return name.replace("ERP+1*标准差", "ERP +1σ").replace("ERP-1*标准差", "ERP -1σ");
  }
  function color(chart, series, index) {
    if (chart.number <= 2) {
      if (series.name.indexOf("股债性价比") === 0) return "#1f5b8f";
      if (series.name.indexOf("均值") >= 0) return "#c49332";
      return "#72a8d4";
    }
    return palette[index % palette.length];
  }
  function traces(chart) {
    return chart.series.map(function (series, index) {
      var percent = chart.axes[series.axis].percent;
      var suffix = chart.number === 8 && series.axis === "right" ? "%" : "";
      var trace = {
        name: shortName(series.name), x: series.x, y: series.y,
        type: series.type === "bar" ? "bar" : "scatter", mode: "lines",
        yaxis: series.axis === "right" ? "y2" : "y",
        connectgaps: false,
        line: { color: color(chart, series, index), width: 1.7, dash: series.name.indexOf("参考线") >= 0 || series.name.indexOf("标准差") >= 0 ? "dash" : "solid" },
        marker: { color: color(chart, series, index) },
        hovertemplate: "%{y:" + (percent ? ".2%" : ",.2f") + "}" + suffix + "<extra>" + shortName(series.name) + "</extra>"
      };
      if (chart.horizontal) {
        trace.x = series.y; trace.y = series.x; trace.orientation = "h";
        trace.marker.color = series.y.map(function (v) { return v >= 0 ? "#2879b2" : "#b9574f"; });
        trace.hovertemplate = "%{y}：%{x:.2%}<extra></extra>";
        trace.text = series.y.map(function (v) { return (v * 100).toFixed(2) + "%"; });
        trace.textposition = "outside"; trace.cliponaxis = false;
      }
      if (chart.band && index === 0) {
        trace.line.width = 0; trace.hoverinfo = "skip"; delete trace.hovertemplate;
      }
      if (chart.band && index === 1) {
        var lower = new Map(chart.series[0].x.map(function (x, i) { return [x, chart.series[0].y[i]]; }));
        trace.y = series.x.map(function (x, i) {
          return lower.get(x) == null || series.y[i] == null ? null : lower.get(x) + series.y[i];
        });
        trace.fill = "tonexty"; trace.fillcolor = "rgba(114,168,212,.22)"; trace.line.width = 0;
        trace.hoverinfo = "skip"; delete trace.hovertemplate;
      }
      return trace;
    });
  }
  function axisRange(values, zero) {
    var lo = Infinity, hi = -Infinity;
    values.forEach(function (v) { if (v != null && Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    if (!Number.isFinite(lo)) return null;
    if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    var pad = (hi - lo || Math.abs(hi) || 1) * .12;
    return [lo - pad, hi + pad];
  }
  function scaleAxes(plot, selectedRange) {
    var updates = {}, buckets = { y: [], y2: [] }, zeros = { y: false, y2: false };
    var start = Date.parse(selectedRange[0]), end = Date.parse(selectedRange[1]);
    plot.data.forEach(function (trace) {
      if (trace.visible === "legendonly" || trace.visible === false) return;
      var axis = trace.yaxis || "y";
      if (trace.type === "bar") zeros[axis] = true;
      trace.x.forEach(function (x, i) { var t = Date.parse(x); if (t >= start && t <= end) buckets[axis].push(trace.y[i]); });
    });
    ["y", "y2"].forEach(function (axis) {
      var value = axisRange(buckets[axis], zeros[axis]);
      if (value) { updates[axis === "y" ? "yaxis.range" : "yaxis2.range"] = value; updates[axis === "y" ? "yaxis.autorange" : "yaxis2.autorange"] = false; }
    });
    return updates;
  }
  function layout(chart) {
    var mobile = window.innerWidth <= 720;
    var result = {
      height: mobile ? 360 : 420, autosize: true,
      paper_bgcolor: "#fff", plot_bgcolor: "#fff", showlegend: false,
      font: { family: "Microsoft YaHei, PingFang SC, Arial", size: mobile ? 10 : 11, color: "#233c59" },
      margin: { l: mobile ? 55 : 66, r: chart.axes.right ? (mobile ? 55 : 66) : 25, t: 30, b: 55 },
      hovermode: chart.horizontal ? "closest" : "x unified",
      hoverlabel: { bgcolor: "#fff", bordercolor: "#8ca1b5", namelength: -1 },
      barmode: "group", bargap: .2, uirevision: chart.id,
      xaxis: { showgrid: false, showline: true, linecolor: "#93a1b2", zeroline: false, automargin: true },
      yaxis: { showgrid: true, gridcolor: "#e8edf3", showline: true, linecolor: "#93a1b2", automargin: true, zeroline: true, zerolinecolor: "#b6c3d0" }
    };
    if (chart.horizontal) {
      result.margin.l = mobile ? 75 : 90; result.margin.r = 60;
      result.xaxis.tickformat = ".0%"; result.xaxis.range = axisRange(chart.series[0].y, true);
      result.xaxis.title = { text: "周涨跌幅", font: { size: 11 } };
      result.yaxis = { type: "category", autorange: "reversed", automargin: true, showgrid: false };
    } else {
      result.xaxis.type = "date";
      result.xaxis.range = range(chart, chart.period);
      result.xaxis.tickformat = "%Y年%-m月"; result.xaxis.nticks = mobile ? 3 : 5;
      result.xaxis.unifiedhovertitle = { text: "<b>%{x|%Y年%-m月%-d日}</b>" };
      result.xaxis.rangeslider = { visible: true, range: range(chart, "全部"), thickness: .09, bgcolor: "#edf3f9", bordercolor: "#c7d3e0", borderwidth: 1 };
      result.yaxis.tickformat = chart.axes.left.percent ? ".1%" : ",.1f";
      result.yaxis.title = { text: chart.axes.left.title, standoff: 8, font: { size: 10 } };
      if (chart.axes.right) result.yaxis2 = {
        overlaying: "y", side: "right", showgrid: false, showline: true, linecolor: "#93a1b2", zeroline: false, automargin: true,
        title: { text: chart.axes.right.title, standoff: 8, font: { size: 10 } }, tickformat: chart.axes.right.percent ? ".0%" : ",.1f"
      };
    }
    return result;
  }
  function adjust(plot, chart, changes) {
    if (plot._adjusting || chart.horizontal) return;
    plot._adjusting = true;
    return Promise.resolve(Plotly.relayout(plot, changes)).finally(function () { plot._adjusting = false; });
  }
  function makeCard(chart) {
    var card = el("article", "macro-chart-card equity-card" + (chart.horizontal || chart.number === 5 || chart.number === 10 ? " is-wide" : ""));
    var header = el("header", "macro-chart-card-header");
    var title = el("div"); title.appendChild(el("h4", "", chart.title));
    title.appendChild(el("p", "", chart.end ? "数据截至 " + chineseDate(chart.end) : "行业周涨跌幅")); header.appendChild(title);
    var plot = el("div", "equity-plot"); plot.id = "plot-" + chart.id; plot.setAttribute("aria-label", chart.title + "图表");
    var controls = el("div", "macro-period-switch");
    if (!chart.horizontal) {
      chart.period = Date.parse(chart.end) - Date.parse(chart.start) > 1095 * 86400000 ? "3年" : "全部";
      ["YTD", "1年", "3年", "全部"].forEach(function (period) {
        var button = el("button", period === chart.period ? "active" : "", period); button.type = "button";
        button.setAttribute("aria-pressed", String(period === chart.period));
        button.addEventListener("click", function () {
          if (!plot.data) return;
          var selected = range(chart, period), updates = scaleAxes(plot, selected);
          updates["xaxis.range"] = selected; updates["xaxis.autorange"] = false;
          adjust(plot, chart, updates);
          controls.querySelectorAll("button").forEach(function (b) { b.classList.toggle("active", b === button); b.setAttribute("aria-pressed", String(b === button)); });
        }); controls.appendChild(button);
      }); header.appendChild(controls);
    }
    card.appendChild(header);
    var legend = el("div", "equity-legend"); legend.setAttribute("aria-label", chart.title + "图例");
    chart.series.forEach(function (series, i) {
      if (chart.band && i === 0) return;
      var button = el("button"); button.type = "button"; button.title = series.name; button.setAttribute("aria-pressed", "true");
      var swatch = el("span", "equity-swatch" + (series.type === "bar" || (chart.band && i === 1) ? " is-bar" : ""));
      swatch.style.setProperty("--series-color", color(chart, series, i));
      button.appendChild(swatch); button.appendChild(el("span", "", shortName(series.name)));
      button.addEventListener("click", function () {
        if (!plot.data) return;
        var visible = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(visible));
        Plotly.restyle(plot, { visible: visible ? true : "legendonly" }, chart.band && i === 1 ? [0, 1] : [i]).then(function () {
          if (!chart.horizontal) adjust(plot, chart, scaleAxes(plot, plot.layout.xaxis.range));
        });
      }); legend.appendChild(button);
    });
    card.appendChild(legend); card.appendChild(plot);
    card.appendChild(el("p", "equity-source", "数据来源：" + dataset.meta.source_label + " · " + chart.sheet.trim()));
    var item = { chart: chart, plot: plot, card: card, controls: controls };
    plots.push(item);
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        if (page.classList.contains("active") && plot.clientWidth !== item.width) resizePlot(item);
      }).observe(plot);
    }
    return card;
  }
  function render() {
    if (!page.classList.contains("active")) return;
    if (!window.Plotly) { content.textContent = "图表库未加载，请检查网络后刷新。"; return; }
    plots.forEach(function (item) {
      if (item.started) { resizePlot(item); return; }
      item.started = true;
      Plotly.newPlot(item.plot, traces(item.chart), layout(item.chart), { displayModeBar: false, responsive: true, scrollZoom: false }).then(function () {
        resizePlot(item);
        if (item.chart.horizontal) return;
        adjust(item.plot, item.chart, scaleAxes(item.plot, item.plot.layout.xaxis.range));
        item.plot.on("plotly_relayout", function (changes) {
          if (item.plot._adjusting || !Object.keys(changes).some(function (k) { return k.indexOf("xaxis.range") === 0 || k === "xaxis.autorange"; })) return;
          item.controls.querySelectorAll("button").forEach(function (b) { b.classList.remove("active"); b.setAttribute("aria-pressed", "false"); });
          adjust(item.plot, item.chart, scaleAxes(item.plot, item.plot.layout.xaxis.range));
        });
      }).catch(function () { item.started = false; item.plot.textContent = "该图表加载失败，请刷新重试。"; });
    });
  }
  function resizePlot(item) {
    if (!item.plot.data || !item.plot.clientWidth) return;
    var mobile = window.innerWidth <= 720;
    item.width = item.plot.clientWidth;
    Plotly.relayout(item.plot, {
      width: item.plot.clientWidth, height: mobile ? 360 : 420,
      "margin.l": item.chart.horizontal ? (mobile ? 75 : 90) : (mobile ? 55 : 66),
      "margin.r": item.chart.horizontal ? 60 : item.chart.axes.right ? (mobile ? 55 : 66) : 25,
      "xaxis.nticks": mobile ? 3 : 5
    });
  }
  function route() {
    var hash = window.location.hash;
    if (hash !== "#page-5" && !hash.startsWith("#equity-section-")) return;
    if (!page.classList.contains("active")) {
      document.querySelector('.main-nav [data-page-link="page-5"]').click();
      window.history.replaceState(null, "", hash);
    }
    window.setTimeout(function () {
      render();
      var target = document.getElementById(hash.slice(1));
      if (target) target.scrollIntoView({ block: "start" });
    }, 120);
  }
  function init() {
    if (!page || !content || !nav) return;
    if (!dataset) { content.textContent = "暂无权益图表数据。"; return; }
    document.getElementById("equityUpdateDate").textContent = "数据更新至 " + chineseDate(dataset.meta.latest_date);
    content.textContent = "";
    dataset.groups.forEach(function (group, i) {
      var link = el("a", i === 0 ? "active" : "", group.label); link.href = "#equity-section-" + group.id;
      nav.appendChild(link);
      var section = el("section", "macro-category equity-category"); section.id = "equity-section-" + group.id;
      var heading = el("header", "macro-category-header"), title = el("div", "macro-category-title");
      title.appendChild(el("span", "macro-category-index", String(i + 1).padStart(2, "0"))); title.appendChild(el("h3", "", group.label)); heading.appendChild(title); section.appendChild(heading);
      var grid = el("div", "macro-chart-grid" + (group.charts.length % 2 ? " is-odd" : ""));
      group.charts.forEach(function (chart) { grid.appendChild(makeCard(chart)); }); section.appendChild(grid); content.appendChild(section);
    });
    new MutationObserver(function () { window.requestAnimationFrame(render); }).observe(page, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("hashchange", route);
    window.addEventListener("resize", function () {
      if (!page.classList.contains("active") || !window.Plotly) return;
      window.requestAnimationFrame(function () { plots.forEach(resizePlot); });
    });
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (!page.classList.contains("active") || ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        var current = dataset.groups[0].id;
        var cutoff = nav.getBoundingClientRect().bottom + 40;
        dataset.groups.forEach(function (group) { if (document.getElementById("equity-section-" + group.id).getBoundingClientRect().top < cutoff) current = group.id; });
        nav.querySelectorAll("a").forEach(function (a) { a.classList.toggle("active", a.hash === "#equity-section-" + current); });
        ticking = false;
      });
    }, { passive: true });
    route(); render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
