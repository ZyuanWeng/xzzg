(function () {
  "use strict";

  var page = document.getElementById("page-3");
  var nav = document.getElementById("macroCategoryNav");
  var content = document.getElementById("macroResearchContent");
  var updateDate = document.getElementById("macroUpdateDate");
  var dataset = window.macroResearchData;
  var rendered = false;
  var colors = ["#1d6db7", "#d4a12e", "#7c8999", "#b94b45", "#2a8176"];

  function createElement(tag, className, textValue) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (textValue !== undefined) element.textContent = textValue;
    return element;
  }

  function wrapLabel(label) {
    var text = String(label);
    if (text.length <= 8) return text;
    var parts = [];
    for (var index = 0; index < text.length; index += 7) {
      parts.push(text.slice(index, index + 7));
    }
    return parts.join("<br>");
  }

  function parseDate(value) {
    var parts = String(value).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDate(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function periodRange(chart, label) {
    var dates = [];
    chart.series.forEach(function (series) {
      dates = dates.concat(series.x || []);
    });
    dates.sort();
    if (!dates.length) return null;
    var first = parseDate(dates[0]);
    var latest = parseDate(dates[dates.length - 1]);
    var start = new Date(first.getTime());
    if (label === "YTD") start = new Date(latest.getFullYear(), 0, 1);
    if (label === "1年") {
      start = new Date(latest.getTime());
      start.setFullYear(start.getFullYear() - 1);
    }
    if (label === "3年") {
      start = new Date(latest.getTime());
      start.setFullYear(start.getFullYear() - 3);
    }
    return [formatDate(start), formatDate(latest)];
  }

  function buildPeriodSwitch(chart, chartElement) {
    var controls = createElement("div", "macro-period-switch");
    ["YTD", "1年", "3年", "全部"].forEach(function (label) {
      var button = createElement("button", label === "全部" ? "active" : "", label);
      button.type = "button";
      button.addEventListener("click", function () {
        var range = periodRange(chart, label);
        if (!range || !window.Plotly) return;
        Plotly.relayout(chartElement, { "xaxis.range": range });
        controls.querySelectorAll("button").forEach(function (item) {
          item.classList.toggle("active", item === button);
        });
      });
      controls.appendChild(button);
    });
    return controls;
  }

  function buildPage() {
    if (!dataset || !Array.isArray(dataset.groups)) {
      content.innerHTML = "";
      content.appendChild(createElement("p", "macro-error", "暂无宏观图表数据，请先运行 update_macro_data.bat。"));
      if (updateDate) updateDate.textContent = "暂无数据";
      return false;
    }

    nav.innerHTML = "";
    content.innerHTML = "";
    var latest = dataset.meta && dataset.meta.latest_date;
    if (updateDate) updateDate.textContent = latest ? "数据更新至 " + latest : "数据已载入";

    dataset.groups.forEach(function (group, groupIndex) {
      var navLink = createElement("a", groupIndex === 0 ? "active" : "", group.label);
      navLink.href = "#macro-" + group.id;
      navLink.addEventListener("click", function () {
        nav.querySelectorAll("a").forEach(function (item) { item.classList.toggle("active", item === navLink); });
      });
      nav.appendChild(navLink);

      var section = createElement("section", "macro-category");
      section.id = "macro-" + group.id;
      var sectionHeader = createElement("header", "macro-category-header");
      var titleWrap = createElement("div", "macro-category-title");
      titleWrap.appendChild(createElement("span", "macro-category-index", String(groupIndex + 1).padStart(2, "0")));
      titleWrap.appendChild(createElement("h3", "", group.label));
      sectionHeader.appendChild(titleWrap);
      sectionHeader.appendChild(createElement("p", "", group.caption));
      section.appendChild(sectionHeader);

      var gridClass = "macro-chart-grid";
      if (group.charts.length === 1) gridClass += " is-single";
      if (group.charts.length > 1 && group.charts.length % 2 === 1) gridClass += " is-odd";
      var grid = createElement("div", gridClass);
      group.charts.forEach(function (chart) {
        var cardClass = "macro-chart-card";
        if (chart.x_mode === "category" && chart.kind === "bar") cardClass += " is-categorical";
        var card = createElement("article", cardClass);
        var cardHeader = createElement("header", "macro-chart-card-header");
        var heading = createElement("div");
        heading.appendChild(createElement("h4", "", chart.title));
        cardHeader.appendChild(heading);
        var chartElement = createElement("div", "macro-chart");
        chartElement.id = "macro-chart-" + chart.id;
        chartElement._macroChart = chart;
        if (chart.x_mode === "date") cardHeader.appendChild(buildPeriodSwitch(chart, chartElement));
        card.appendChild(cardHeader);
        card.appendChild(chartElement);
        grid.appendChild(card);
      });
      section.appendChild(grid);
      content.appendChild(section);
    });
    content.appendChild(createElement("p", "macro-source-note", "数据来源：国内宏观经济数据库，兴证资管"));
    return true;
  }

  function chartTraces(chart) {
    if (chart.kind === "radar") {
      return chart.series.map(function (series, index) {
        var theta = series.x.slice();
        var radial = series.y.slice();
        if (theta.length) {
          theta.push(theta[0]);
          radial.push(radial[0]);
        }
        return {
          type: "scatterpolar",
          mode: "lines",
          name: series.name,
          theta: theta,
          r: radial,
          line: { color: colors[index % colors.length], width: 2 },
          fill: index === 0 ? "toself" : "none",
          fillcolor: "rgba(29,109,183,0.07)",
          hovertemplate: "%{theta}<br>%{r:.1f}<extra>" + series.name + "</extra>"
        };
      });
    }

    return chart.series.map(function (series, index) {
      var trace = {
        x: series.x,
        y: series.y,
        name: series.name,
        type: chart.kind === "bar" ? "bar" : "scatter",
        hovertemplate: "%{x}<br>%{y:,.2f}<extra>" + series.name + "</extra>"
      };
      if (chart.kind === "line") {
        trace.mode = "lines";
        trace.line = { color: colors[index % colors.length], width: 2 };
      } else {
        trace.marker = { color: colors[index % colors.length] };
        if (chart.color_by_sign) {
          trace.marker.color = series.y.map(function (value) { return value >= 0 ? "#2878b8" : "#b9574f"; });
        }
      }
      return trace;
    });
  }

  function chartLayout(chart, element) {
    var mobile = window.innerWidth <= 720;
    var categoricalBar = chart.kind === "bar" && chart.x_mode === "category";
    var layout = {
      autosize: true,
      height: categoricalBar ? (mobile ? 390 : 450) : (mobile ? 340 : 380),
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff",
      margin: { l: mobile ? 46 : 58, r: 20, t: 58, b: categoricalBar ? (mobile ? 132 : 116) : 56 },
      font: { family: "Microsoft YaHei, PingFang SC, Arial", color: "#233c59", size: mobile ? 10 : 11 },
      hovermode: chart.kind === "line" ? "x unified" : "closest",
      legend: { orientation: "h", x: 0, y: 1.12, font: { size: mobile ? 9 : 11 } },
      showlegend: true,
      barmode: chart.stacked ? "relative" : "group",
      bargap: 0.24,
      uirevision: chart.id,
      xaxis: {
        type: chart.x_mode === "date" ? "date" : "category",
        showline: true,
        linecolor: "#7b8a9c",
        showgrid: false,
        zeroline: false,
        automargin: true,
        tickformat: chart.x_mode === "date" ? "%Y-%m" : undefined,
        tickvals: categoricalBar ? chart.series[0].x : undefined,
        ticktext: categoricalBar ? chart.series[0].x.map(wrapLabel) : undefined,
        tickfont: { size: categoricalBar ? (mobile ? 8 : 9) : (mobile ? 9 : 10) }
      },
      yaxis: {
        range: chart.y_range,
        showline: true,
        linecolor: "#7b8a9c",
        showgrid: false,
        zeroline: true,
        zerolinecolor: "#52657a",
        zerolinewidth: 1,
        automargin: true
      }
    };

    if (chart.kind === "radar") {
      delete layout.xaxis;
      delete layout.yaxis;
      delete layout.barmode;
      layout.margin = { l: mobile ? 54 : 72, r: mobile ? 54 : 72, t: 52, b: 42 };
      layout.polar = {
        bgcolor: "#ffffff",
        radialaxis: { range: chart.y_range, tickfont: { size: 9 }, gridcolor: "#dbe3ec", linecolor: "#9eabb9" },
        angularaxis: { tickfont: { size: mobile ? 9 : 10 }, gridcolor: "#dbe3ec", linecolor: "#9eabb9" }
      };
    }
    return layout;
  }

  function renderCharts() {
    if (rendered || !page || !page.classList.contains("active")) return;
    if (!window.Plotly) {
      content.innerHTML = "";
      content.appendChild(createElement("p", "macro-error", "图表库加载失败，请检查网络后刷新页面。"));
      return;
    }
    document.querySelectorAll(".macro-chart").forEach(function (element) {
      var chart = element._macroChart;
      Plotly.newPlot(element, chartTraces(chart), chartLayout(chart, element), {
        displayModeBar: false,
        responsive: true,
        scrollZoom: false
      });
    });
    rendered = true;
  }

  function resizeCharts() {
    if (!rendered || !window.Plotly) return;
    document.querySelectorAll(".macro-chart.js-plotly-plot").forEach(function (element) {
      Plotly.Plots.resize(element);
    });
  }

  function activate() {
    window.setTimeout(function () {
      renderCharts();
      resizeCharts();
    }, 100);
  }

  function bindCategoryTracking() {
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking || !page.classList.contains("active")) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        var current = dataset.groups[0] && dataset.groups[0].id;
        dataset.groups.forEach(function (group) {
          var section = document.getElementById("macro-" + group.id);
          if (section && section.getBoundingClientRect().top <= 170) current = group.id;
        });
        nav.querySelectorAll("a").forEach(function (link) {
          link.classList.toggle("active", link.getAttribute("href") === "#macro-" + current);
        });
        ticking = false;
      });
    }, { passive: true });
  }

  function init() {
    if (!page || !nav || !content || !buildPage()) return;
    bindCategoryTracking();
    document.querySelectorAll('[data-page-link="page-3"], [data-page="page-3"]').forEach(function (link) {
      link.addEventListener("click", activate);
    });
    window.addEventListener("resize", resizeCharts);
    if (window.location.hash === "#page-3" && !page.classList.contains("active")) {
      var directLink = document.querySelector('[data-page-link="page-3"]');
      if (directLink) directLink.click();
    }
    if (page.classList.contains("active")) activate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
