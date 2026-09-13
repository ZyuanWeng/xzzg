(function () {
  "use strict";

  var page = document.getElementById("page-4");
  var nav = document.getElementById("fixedIncomeCategoryNav");
  var content = document.getElementById("fixedIncomeResearchContent");
  var updateDate = document.getElementById("fixedIncomeUpdateDate");
  var dataset = window.fixedIncomeResearchData;
  var rendered = false;

  var globalColors = {
    "中国": "#1f5b8f",
    "美国": "#c49332",
    "日本": "#2a9d8f",
    "德国": "#72a8d4",
    "英国": "#b9574f",
    "法国": "#75658e",
    "中美利差": "#b9574f"
  };
  var tenorColors = {
    "1年": "#72a8d4",
    "5年": "#2a9d8f",
    "10年": "#1f5b8f",
    "30年": "#c49332"
  };
  var futuresColors = ["#72a8d4", "#2a9d8f", "#1f5b8f", "#c49332"];
  var creditColors = ["#1f5b8f", "#397eb8", "#72a8d4", "#9f4f4a", "#c49332", "#75658e"];

  function createElement(tag, className, textValue) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (textValue !== undefined) element.textContent = textValue;
    return element;
  }

  function parseDate(value) {
    var parts = String(value).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDate(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  }

  function formatChineseDate(value) {
    var date = parseDate(value);
    return date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日";
  }

  function paddedEnd(value) {
    var end = parseDate(value);
    end.setDate(end.getDate() + 10);
    return formatDate(end);
  }

  function periodRange(chart, label) {
    if (!chart.dates || !chart.dates.length) return null;
    var first = parseDate(chart.dates[0]);
    var latest = parseDate(chart.dates[chart.dates.length - 1]);
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
    if (start < first) start = first;
    return [formatDate(start), paddedEnd(chart.dates[chart.dates.length - 1])];
  }

  function paddedNumericRange(values, includeZero) {
    if (!values.length) return null;
    var minimum = Math.min.apply(null, values);
    var maximum = Math.max.apply(null, values);
    if (includeZero) {
      minimum = Math.min(minimum, 0);
      maximum = Math.max(maximum, 0);
    }
    var span = maximum - minimum;
    var padding = span ? span * 0.08 : Math.max(Math.abs(maximum) * 0.08, 1);
    var lower = minimum - padding;
    if (!includeZero && minimum >= 0) lower = Math.max(0, lower);
    return [lower, maximum + padding];
  }

  function visibleAxisUpdates(chart, range) {
    var startTime = parseDate(String(range[0]).slice(0, 10)).getTime();
    var endTime = parseDate(String(range[1]).slice(0, 10)).getTime();
    var leftValues = [];
    var rightValues = [];

    chart.series.forEach(function (series) {
      var target = chart.kind === "spread-combo" && series.name === "中美利差" ? rightValues : leftValues;
      series.values.forEach(function (value, index) {
        if (value === null || value === undefined) return;
        var dateTime = parseDate(chart.dates[index]).getTime();
        if (dateTime >= startTime && dateTime <= endTime) target.push(value);
      });
    });

    var updates = {};
    var leftRange = paddedNumericRange(leftValues, false);
    var rightRange = paddedNumericRange(rightValues, true);
    if (leftRange) {
      updates["yaxis.range"] = leftRange;
      updates["yaxis.autorange"] = false;
    }
    if (rightRange) {
      updates["yaxis2.range"] = rightRange;
      updates["yaxis2.autorange"] = false;
    }
    return updates;
  }

  function buildPeriodSwitch(chart, chartElement) {
    var controls = createElement("div", "macro-period-switch fixed-income-period-switch");
    ["YTD", "1年", "3年", "全部"].forEach(function (label) {
      var active = label === chart.default_period;
      var button = createElement("button", active ? "active" : "", label);
      button.type = "button";
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.addEventListener("click", function () {
        var range = periodRange(chart, label);
        if (!range || !window.Plotly) return;
        var updates = visibleAxisUpdates(chart, range);
        updates["xaxis.range"] = range;
        updates["xaxis.autorange"] = false;
        chartElement._fixedIncomeRelayoutGuard = true;
        Promise.resolve(Plotly.relayout(chartElement, updates)).then(function () {
          chartElement._fixedIncomeRelayoutGuard = false;
        });
        controls.querySelectorAll("button").forEach(function (item) {
          var selected = item === button;
          item.classList.toggle("active", selected);
          item.setAttribute("aria-pressed", selected ? "true" : "false");
        });
      });
      controls.appendChild(button);
    });
    return controls;
  }

  function buildPage() {
    if (!dataset || !Array.isArray(dataset.groups)) {
      content.innerHTML = "";
      content.appendChild(createElement("p", "macro-error", "暂无固收图表数据，请先运行 update_fixed_income_data.bat。"));
      if (updateDate) updateDate.textContent = "暂无数据";
      return false;
    }

    nav.innerHTML = "";
    content.innerHTML = "";
    if (updateDate && dataset.meta.latest_date) {
      updateDate.textContent = "数据更新至 " + formatChineseDate(dataset.meta.latest_date);
    }

    dataset.groups.forEach(function (group, groupIndex) {
      var navLink = createElement("a", groupIndex === 0 ? "active" : "", group.label);
      navLink.href = "#fixed-income-" + group.id;
      navLink.addEventListener("click", function () {
        nav.querySelectorAll("a").forEach(function (item) {
          item.classList.toggle("active", item === navLink);
        });
      });
      nav.appendChild(navLink);

      var section = createElement("section", "macro-category fixed-income-category");
      section.id = "fixed-income-" + group.id;
      var sectionHeader = createElement("header", "macro-category-header");
      var titleWrap = createElement("div", "macro-category-title");
      titleWrap.appendChild(createElement("span", "macro-category-index", String(groupIndex + 1).padStart(2, "0")));
      titleWrap.appendChild(createElement("h3", "", group.label));
      sectionHeader.appendChild(titleWrap);
      sectionHeader.appendChild(createElement("p", "", group.caption));
      section.appendChild(sectionHeader);

      var gridClass = "macro-chart-grid fixed-income-chart-grid";
      if (group.charts.length === 1) gridClass += " is-single";
      if (group.charts.length > 1 && group.charts.length % 2 === 1) gridClass += " is-odd";
      var grid = createElement("div", gridClass);

      group.charts.forEach(function (chart) {
        var card = createElement("article", "macro-chart-card fixed-income-chart-card");
        var cardHeader = createElement("header", "macro-chart-card-header");
        var heading = createElement("div");
        heading.appendChild(createElement("h4", "", chart.title));
        heading.appendChild(createElement("p", "", chart.subtitle));
        cardHeader.appendChild(heading);

        var chartElement = createElement("div", "fixed-income-chart");
        chartElement.id = "fixed-income-chart-" + chart.id;
        chartElement.setAttribute("aria-label", chart.title + "图表");
        chartElement._fixedIncomeChart = chart;
        cardHeader.appendChild(buildPeriodSwitch(chart, chartElement));

        card.appendChild(cardHeader);
        card.appendChild(chartElement);
        card.appendChild(createElement("p", "fixed-income-chart-source", "数据来源：" + dataset.meta.source_label));
        grid.appendChild(card);
      });

      section.appendChild(grid);
      content.appendChild(section);
    });
    return true;
  }

  function seriesStyle(chart, series, index) {
    if (chart.id === "global-10y" || chart.id === "china-us-spread") {
      return { color: globalColors[series.name] || "#7c8999", dash: "solid" };
    }
    if (chart.id === "credit-spread") {
      return { color: creditColors[index % creditColors.length], dash: series.name.indexOf("AA+") === 0 ? "dash" : "solid" };
    }
    if (chart.id === "treasury-futures") {
      return { color: futuresColors[index % futuresColors.length], dash: "solid" };
    }
    return { color: tenorColors[series.name] || "#7c8999", dash: "solid" };
  }

  function chartTraces(chart) {
    return chart.series.map(function (series, index) {
      var style = seriesStyle(chart, series, index);
      var isSpread = chart.kind === "spread-combo" && series.name === "中美利差";
      var decimals = isSpread ? 1 : chart.decimals;
      var unit = isSpread ? "bp" : chart.unit;
      var trace = {
        x: chart.dates,
        y: series.values,
        name: series.name,
        type: "scatter",
        mode: "lines",
        connectgaps: true,
        line: { color: style.color, width: isSpread ? 1.2 : 1.8, dash: style.dash },
        hovertemplate: "<b>" + series.name + "</b>：%{y:,." + decimals + "f} " + unit + "<extra></extra>"
      };

      if (isSpread) {
        trace.yaxis = "y2";
        trace.fill = "tozeroy";
        trace.fillcolor = "rgba(185,87,79,0.14)";
        trace.legendrank = 30;
      } else {
        trace.legendrank = index + 1;
      }
      return trace;
    });
  }

  function chartLayout(chart) {
    var mobile = window.innerWidth <= 720;
    var combo = chart.kind === "spread-combo";
    var initialRange = periodRange(chart, chart.default_period);
    var fullRange = periodRange(chart, "全部");
    var initialAxes = visibleAxisUpdates(chart, initialRange);
    var yTitle = chart.unit === "%" ? "收益率（%）" : chart.unit === "bp" ? "利差（bp）" : "结算价（元）";
    var layout = {
      autosize: true,
      height: mobile ? 370 : (chart.id === "credit-spread" ? 430 : 405),
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#ffffff",
      margin: { l: mobile ? 52 : 62, r: combo ? (mobile ? 52 : 68) : 24, t: mobile ? 72 : 78, b: 58 },
      font: { family: "Microsoft YaHei, PingFang SC, Arial", color: "#233c59", size: mobile ? 10 : 11 },
      hovermode: "x unified",
      hoverdistance: 40,
      hoverlabel: { bgcolor: "#ffffff", bordercolor: "#6c7d90", font: { color: "#152e4a", size: mobile ? 10 : 12 }, namelength: -1 },
      legend: {
        orientation: "h",
        x: 0,
        y: 1.16,
        xanchor: "left",
        yanchor: "top",
        traceorder: "normal",
        font: { size: mobile ? 9 : 10 }
      },
      showlegend: true,
      uirevision: chart.id,
      xaxis: {
        type: "date",
        range: initialRange,
        showline: true,
        linecolor: "#7b8a9c",
        linewidth: 1,
        showgrid: false,
        zeroline: false,
        automargin: true,
        tickformat: mobile ? "%Y年" : "%Y年%m月",
        tickfont: { size: mobile ? 9 : 10 },
        unifiedhovertitle: { text: "<b>%{x|%Y年%m月%d日}</b>" },
        rangeslider: {
          visible: true,
          range: fullRange,
          thickness: 0.085,
          bgcolor: "#edf3f9",
          bordercolor: "#c7d3e0",
          borderwidth: 1
        },
        fixedrange: false
      },
      yaxis: {
        title: { text: yTitle, font: { size: mobile ? 10 : 11 }, standoff: 8 },
        tickformat: chart.unit === "元" ? ",.1f" : ",.1f",
        showline: true,
        linecolor: "#7b8a9c",
        linewidth: 1,
        showgrid: true,
        gridcolor: "#e8edf3",
        gridwidth: 1,
        zeroline: false,
        automargin: true,
        fixedrange: false
      }
    };

    if (initialAxes["yaxis.range"]) layout.yaxis.range = initialAxes["yaxis.range"];

    if (combo) {
      layout.yaxis2 = {
        title: { text: "利差（bp）", font: { size: mobile ? 10 : 11 }, standoff: 8 },
        overlaying: "y",
        side: "right",
        tickformat: ",.0f",
        showline: true,
        linecolor: "#9b6a66",
        showgrid: false,
        zeroline: true,
        zerolinecolor: "#9aa7b5",
        zerolinewidth: 1,
        automargin: true,
        fixedrange: false
      };
      if (initialAxes["yaxis2.range"]) layout.yaxis2.range = initialAxes["yaxis2.range"];
    }
    return layout;
  }

  function bindVisibleRangeScaling(element, chart) {
    if (!element || typeof element.on !== "function") return;
    element.on("plotly_relayout", function (changes) {
      if (element._fixedIncomeRelayoutGuard) return;
      var changedXRange = Object.keys(changes || {}).some(function (key) {
        return key.indexOf("xaxis.range") === 0 || key === "xaxis.autorange";
      });
      if (!changedXRange || !element.layout || !element.layout.xaxis.range) return;

      window.clearTimeout(element._fixedIncomeScaleTimer);
      element._fixedIncomeScaleTimer = window.setTimeout(function () {
        var updates = visibleAxisUpdates(chart, element.layout.xaxis.range);
        if (!Object.keys(updates).length) return;
        element._fixedIncomeRelayoutGuard = true;
        Promise.resolve(Plotly.relayout(element, updates)).then(function () {
          element._fixedIncomeRelayoutGuard = false;
        });
      }, 60);
    });
  }

  function renderCharts() {
    if (rendered || !page || !page.classList.contains("active")) return;
    if (!window.Plotly) {
      content.innerHTML = "";
      content.appendChild(createElement("p", "macro-error", "图表库加载失败，请检查网络后刷新页面。"));
      return;
    }

    document.querySelectorAll(".fixed-income-chart").forEach(function (element) {
      var chart = element._fixedIncomeChart;
      Plotly.newPlot(element, chartTraces(chart), chartLayout(chart), {
        displayModeBar: false,
        responsive: true,
        scrollZoom: false
      }).then(function () {
        bindVisibleRangeScaling(element, chart);
      });
    });
    rendered = true;
  }

  function resizeCharts() {
    if (!rendered || !window.Plotly) return;
    document.querySelectorAll(".fixed-income-chart.js-plotly-plot").forEach(function (element) {
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
          var section = document.getElementById("fixed-income-" + group.id);
          if (section && section.getBoundingClientRect().top <= 170) current = group.id;
        });
        nav.querySelectorAll("a").forEach(function (link) {
          link.classList.toggle("active", link.getAttribute("href") === "#fixed-income-" + current);
        });
        ticking = false;
      });
    }, { passive: true });
  }

  function init() {
    if (!page || !nav || !content || !buildPage()) return;
    bindCategoryTracking();
    document.querySelectorAll('[data-page-link="page-4"], [data-page="page-4"]').forEach(function (link) {
      link.addEventListener("click", activate);
    });
    window.addEventListener("resize", resizeCharts);
    if (window.location.hash === "#page-4" && !page.classList.contains("active")) {
      var directLink = document.querySelector('[data-page-link="page-4"]');
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
