(function () {
  "use strict";

  var DATA_URL = "data/gma.json";
  var FALLBACK_URL = "data/gma.sample.json";
  var PAGE_SIZE = 100;

  var state = {
    data: null,
    records: [],
    editions: [],
    categories: [],
    names: [],
    tab: "ranking",
    selectedPerson: "",
    rankVisible: PAGE_SIZE,
    rankingFilters: {
      cat: "",
      from: "",
      to: "",
      name: ""
    },
    selectedEdition: "",
    selectedAward: "",
    showNominees: false
  };

  var dom = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    dom.status = document.getElementById("status");
    dom.app = document.getElementById("app");
    dom.globalSearch = document.getElementById("globalSearch");
    dom.suggestions = document.getElementById("suggestions");
    dom.tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));

    bindBaseEvents();
    loadData();
  }

  function bindBaseEvents() {
    dom.tabs.forEach(function (button) {
      button.addEventListener("click", function () {
        setTab(button.getAttribute("data-tab"));
      });
    });

    dom.globalSearch.addEventListener("input", function () {
      renderSuggestions(dom.globalSearch.value);
    });

    dom.globalSearch.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        var value = dom.globalSearch.value.trim();
        if (value) {
          var exact = findName(value) || value;
          openPerson(exact);
          hideSuggestions();
        }
      } else if (event.key === "Escape") {
        hideSuggestions();
      }
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest(".global-search")) {
        hideSuggestions();
      }
    });
  }

  function loadData() {
    fetch(DATA_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("primary data not found");
        }
        return response.json();
      })
      .catch(function () {
        return fetch(FALLBACK_URL).then(function (response) {
          if (!response.ok) {
            throw new Error("sample data not found");
          }
          return response.json();
        });
      })
      .then(function (json) {
        prepareData(json);
        dom.status.hidden = true;
        dom.app.hidden = false;
        render();
      })
      .catch(function (error) {
        dom.status.textContent = "資料載入失敗：" + error.message;
      });
  }

  function prepareData(json) {
    var meta = json.meta || {};
    var rawRecords = Array.isArray(json.records) ? json.records : [];

    state.data = json;
    state.records = rawRecords.map(function (record) {
      return {
        e: Number(record.e) || 0,
        y: Number(record.y) || 0,
        cat: clean(record.cat),
        work: clean(record.work),
        who: clean(record.who),
        unit: clean(record.unit),
        win: Boolean(record.win),
        grp: clean(record.grp),
        perf: clean(record.perf)
      };
    });

    var editionMap = {};
    if (meta.editions && typeof meta.editions === "object") {
      Object.keys(meta.editions).forEach(function (key) {
        editionMap[String(key)] = Number(meta.editions[key]) || 0;
      });
    }
    state.records.forEach(function (record) {
      if (record.e && !editionMap[String(record.e)]) {
        editionMap[String(record.e)] = record.y;
      }
    });

    state.editions = Object.keys(editionMap)
      .map(function (key) {
        return { e: Number(key), y: Number(editionMap[key]) || 0 };
      })
      .filter(function (item) {
        return item.e > 0;
      })
      .sort(function (a, b) {
        return a.e - b.e;
      });

    state.categories = unique(state.records.map(function (record) {
      return record.cat;
    })).sort(sortText);

    state.names = buildNames();

    if (state.editions.length) {
      state.rankingFilters.from = String(state.editions[0].e);
      state.rankingFilters.to = String(state.editions[state.editions.length - 1].e);
      state.selectedEdition = String(state.editions[state.editions.length - 1].e);
    }
    if (state.categories.length) {
      state.selectedAward = state.categories[0];
    }

    readHash();
  }

  function buildNames() {
    var all = [];
    state.records.forEach(function (record) {
      if (record.who) {
        all.push(record.who);
      }
      splitPeople(record.who).concat(splitPeople(record.perf)).forEach(function (name) {
        all.push(name);
      });
    });
    return unique(all).filter(function (name) {
      return name !== "從缺";
    }).sort(sortText);
  }

  function readHash() {
    var hash = decodeURIComponent(window.location.hash || "").replace(/^#/, "");
    if (!hash) {
      return;
    }
    var parts = hash.split("/");
    if (parts[0] === "person" && parts[1]) {
      state.selectedPerson = parts.slice(1).join("/");
      state.tab = "person";
      dom.globalSearch.value = state.selectedPerson;
    } else if (parts[0] === "edition" && parts[1]) {
      state.selectedEdition = parts[1];
      state.tab = "edition";
    } else if (parts[0] === "award" && parts[1]) {
      state.selectedAward = parts.slice(1).join("/");
      state.tab = "award";
    } else if (parts[0] === "ranking") {
      state.tab = "ranking";
    }
  }

  function writeHash() {
    if (state.tab === "person" && state.selectedPerson) {
      window.location.hash = "person/" + encodeURIComponent(state.selectedPerson);
    } else if (state.tab === "edition") {
      window.location.hash = "edition/" + encodeURIComponent(state.selectedEdition);
    } else if (state.tab === "award") {
      window.location.hash = "award/" + encodeURIComponent(state.selectedAward);
    } else {
      window.location.hash = "ranking";
    }
  }

  function setTab(tab) {
    state.tab = tab;
    state.rankVisible = PAGE_SIZE;
    writeHash();
    render();
  }

  function render() {
    updateTabs();
    if (state.tab === "person") {
      renderPerson();
    } else if (state.tab === "edition") {
      renderEdition();
    } else if (state.tab === "award") {
      renderAward();
    } else {
      renderRanking();
    }
  }

  function updateTabs() {
    dom.tabs.forEach(function (button) {
      button.classList.toggle("is-active", button.getAttribute("data-tab") === state.tab);
    });
  }

  function renderRanking() {
    var filters = state.rankingFilters;
    var rows = buildRanking();
    var visibleRows = rows.slice(0, state.rankVisible);
    var maxWins = rows.length ? rows[0].wins : 0;

    clear(dom.app);
    dom.app.appendChild(el("section", { className: "panel" }, [
      el("div", { className: "filters" }, [
        field("獎項名稱", selectControl("rankCat", [{ value: "", label: "全部" }].concat(state.categories.map(function (cat) {
          return { value: cat, label: cat };
        })), filters.cat, function (value) {
          filters.cat = value;
          state.rankVisible = PAGE_SIZE;
          renderRanking();
        })),
        field("屆次起", selectControl("rankFrom", state.editions.map(editionOption), filters.from, function (value) {
          filters.from = value;
          if (Number(filters.to) < Number(value)) {
            filters.to = value;
          }
          state.rankVisible = PAGE_SIZE;
          renderRanking();
        })),
        field("屆次迄", selectControl("rankTo", state.editions.map(editionOption), filters.to, function (value) {
          filters.to = value;
          if (Number(filters.from) > Number(value)) {
            filters.from = value;
          }
          state.rankVisible = PAGE_SIZE;
          renderRanking();
        })),
        field("名字關鍵字", inputControl("rankName", filters.name, "例：陳奕迅", function (value) {
          filters.name = value;
          state.rankVisible = PAGE_SIZE;
          renderRanking();
        }))
      ]),
      el("div", { className: "summary" }, [
        document.createTextNode("共 " + rows.length + " 筆統計；目前顯示 " + visibleRows.length + " 筆")
      ]),
      table(["排名", "名字", "得獎數", "入圍數", "得獎數橫條"], visibleRows.map(function (row, index) {
        var tr = document.createElement("tr");
        tr.tabIndex = 0;
        tr.className = "clickable";
        tr.addEventListener("click", function () {
          openPerson(row.name);
        });
        tr.addEventListener("keydown", function (event) {
          if (event.key === "Enter") {
            openPerson(row.name);
          }
        });
        appendCells(tr, [
          String(index + 1),
          row.name,
          String(row.wins),
          String(row.noms),
          barCell(row.wins, maxWins)
        ]);
        return tr;
      }), "ranking-table")
    ]));

    if (state.rankVisible < rows.length) {
      var more = el("button", { className: "more", type: "button" }, ["顯示更多"]);
      more.addEventListener("click", function () {
        state.rankVisible += PAGE_SIZE;
        renderRanking();
      });
      dom.app.querySelector(".panel").appendChild(more);
    }
  }

  function buildRanking() {
    var filters = state.rankingFilters;
    var from = Number(filters.from) || -Infinity;
    var to = Number(filters.to) || Infinity;
    var nameNeedle = filters.name.trim().toLowerCase();
    var map = new Map();

    state.records.forEach(function (record) {
      if (filters.cat && record.cat !== filters.cat) {
        return;
      }
      if (record.e < from || record.e > to) {
        return;
      }
      // credit both the official recipient (who, split on 、/ etc. for
      // co-credits) and the performers (perf), so singers get counted on
      // album awards registered to their label
      var entities = unique(splitPeople(record.who).concat(splitPeople(record.perf)));
      entities.forEach(function (name) {
        if (!name || name === "從缺") {
          return;
        }
        if (nameNeedle && name.toLowerCase().indexOf(nameNeedle) === -1) {
          return;
        }
        if (!map.has(name)) {
          map.set(name, { name: name, wins: 0, noms: 0 });
        }
        var item = map.get(name);
        item.noms += 1;
        if (record.win) {
          item.wins += 1;
        }
      });
    });

    return Array.from(map.values()).sort(function (a, b) {
      return b.wins - a.wins || b.noms - a.noms || sortText(a.name, b.name);
    });
  }

  function renderPerson() {
    clear(dom.app);

    if (!state.selectedPerson) {
      dom.app.appendChild(el("section", { className: "panel empty" }, [
        el("p", {}, ["請在上方搜尋框輸入或選擇人名、團體名稱。"])
      ]));
      return;
    }

    var records = state.records.filter(function (record) {
      return record.who === state.selectedPerson ||
        splitPeople(record.who).indexOf(state.selectedPerson) !== -1 ||
        splitPeople(record.perf).indexOf(state.selectedPerson) !== -1;
    }).sort(function (a, b) {
      return b.e - a.e || sortText(a.cat, b.cat) || sortText(a.work, b.work);
    });

    var wins = records.filter(function (record) {
      return record.win;
    }).length;

    var back = el("button", { className: "link-button", type: "button" }, ["← 返回排行榜"]);
    back.addEventListener("click", function () {
      setTab("ranking");
    });

    dom.app.appendChild(el("section", { className: "panel" }, [
      el("div", { className: "person-head" }, [
        back,
        el("h2", {}, [state.selectedPerson])
      ]),
      el("div", { className: "cards" }, [
        statCard("總入圍", records.length),
        statCard("總得獎", wins)
      ]),
      table(["屆", "年", "獎項", "作品", "演唱/演奏/導演", "報名單位", "結果"], records.map(function (record) {
        var tr = document.createElement("tr");
        appendCells(tr, [
          "第" + record.e + "屆",
          String(record.y || ""),
          catLabel(record),
          record.work || "",
          record.perf || "",
          record.unit || "",
          badge(record.win)
        ]);
        return tr;
      }), "records-table")
    ]));
  }

  function renderEdition() {
    clear(dom.app);

    var select = selectControl("editionSelect", state.editions.map(editionOption), state.selectedEdition, function (value) {
      state.selectedEdition = value;
      writeHash();
      renderEdition();
    });

    var edition = Number(state.selectedEdition);
    var records = state.records.filter(function (record) {
      return record.e === edition;
    });
    var grouped = groupBy(records, function (record) {
      return catLabel(record);
    });
    var cats = Object.keys(grouped).sort(sortText);

    var blocks = cats.map(function (cat) {
      var groupRecords = grouped[cat].slice().sort(function (a, b) {
        return Number(b.win) - Number(a.win) || sortText(a.who, b.who);
      });
      return el("section", { className: "award-group" }, [
        el("h3", {}, [cat]),
        table(["結果", "入圍 / 得獎者", "作品", "演唱/演奏/導演", "報名單位"], groupRecords.map(function (record) {
          var tr = document.createElement("tr");
          if (record.win) {
            tr.className = "winner-row";
          }
          appendCells(tr, [
            badge(record.win),
            personLink(record.who),
            record.work || "",
            record.perf || "",
            record.unit || ""
          ]);
          return tr;
        }))
      ]);
    });

    dom.app.appendChild(el("section", { className: "panel" }, [
      el("div", { className: "filters" }, [
        field("選擇屆次", select)
      ]),
      el("div", { className: "summary" }, ["第" + edition + "屆共 " + records.length + " 筆紀錄"])
    ].concat(blocks)));
  }

  function renderAward() {
    clear(dom.app);

    var select = selectControl("awardSelect", state.categories.map(function (cat) {
      return { value: cat, label: cat };
    }), state.selectedAward, function (value) {
      state.selectedAward = value;
      writeHash();
      renderAward();
    });

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "showNominees";
    checkbox.checked = state.showNominees;
    checkbox.addEventListener("change", function () {
      state.showNominees = checkbox.checked;
      renderAward();
    });

    var records = state.records.filter(function (record) {
      return record.cat === state.selectedAward;
    });
    var grouped = groupBy(records, function (record) {
      return String(record.e);
    });
    var editions = Object.keys(grouped).map(Number).sort(function (a, b) {
      return b - a;
    });

    var blocks = editions.map(function (edition) {
      var groupRecords = grouped[String(edition)].slice().sort(function (a, b) {
        return Number(b.win) - Number(a.win) || sortText(a.who, b.who);
      });
      var shown = state.showNominees ? groupRecords : groupRecords.filter(function (record) {
        return record.win;
      });
      var year = groupRecords.length ? groupRecords[0].y : editionYear(edition);

      return el("section", { className: "award-group" }, [
        el("h3", {}, ["第" + edition + "屆（" + (year || "") + "）"]),
        table(["結果", "入圍 / 得獎者", "作品", "演唱/演奏/導演", "報名單位"], shown.map(function (record) {
          var tr = document.createElement("tr");
          if (record.win) {
            tr.className = "winner-row";
          }
          appendCells(tr, [
            badge(record.win),
            personLink(record.who),
            record.work || "",
            record.perf || "",
            record.unit || ""
          ]);
          return tr;
        }))
      ]);
    });

    dom.app.appendChild(el("section", { className: "panel" }, [
      el("div", { className: "filters" }, [
        field("選擇獎項", select),
        el("label", { className: "check-field" }, [checkbox, document.createTextNode("顯示入圍者")])
      ]),
      el("div", { className: "summary" }, [state.selectedAward + "，共 " + records.length + " 筆紀錄"])
    ].concat(blocks)));
  }

  function renderSuggestions(value) {
    var needle = value.trim().toLowerCase();
    clear(dom.suggestions);

    if (!needle) {
      hideSuggestions();
      return;
    }

    var matches = state.names.filter(function (name) {
      return name.toLowerCase().indexOf(needle) !== -1;
    }).slice(0, 20);

    if (!matches.length) {
      hideSuggestions();
      return;
    }

    matches.forEach(function (name) {
      var button = el("button", { type: "button" }, [name]);
      button.addEventListener("click", function () {
        openPerson(name);
        hideSuggestions();
      });
      dom.suggestions.appendChild(button);
    });
    dom.suggestions.hidden = false;
  }

  function hideSuggestions() {
    dom.suggestions.hidden = true;
  }

  function openPerson(name) {
    state.selectedPerson = name;
    state.tab = "person";
    dom.globalSearch.value = name;
    writeHash();
    render();
  }

  function findName(value) {
    var lower = value.toLowerCase();
    for (var i = 0; i < state.names.length; i += 1) {
      if (state.names[i].toLowerCase() === lower) {
        return state.names[i];
      }
    }
    for (var j = 0; j < state.names.length; j += 1) {
      if (state.names[j].toLowerCase().indexOf(lower) !== -1) {
        return state.names[j];
      }
    }
    return "";
  }

  function selectControl(id, options, value, onChange) {
    var select = document.createElement("select");
    select.id = id;
    options.forEach(function (option) {
      var opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      select.appendChild(opt);
    });
    select.value = value;
    select.addEventListener("change", function () {
      onChange(select.value);
    });
    return select;
  }

  function inputControl(id, value, placeholder, onInput) {
    var input = document.createElement("input");
    input.id = id;
    input.type = "search";
    input.value = value;
    input.placeholder = placeholder;
    input.addEventListener("input", function () {
      onInput(input.value);
    });
    return input;
  }

  function field(labelText, control) {
    var label = document.createElement("label");
    label.className = "field";
    var span = document.createElement("span");
    span.textContent = labelText;
    label.appendChild(span);
    label.appendChild(control);
    return label;
  }

  function editionOption(item) {
    return {
      value: String(item.e),
      label: "第" + item.e + "屆（" + item.y + "）"
    };
  }

  function table(headers, rows, className) {
    var wrap = document.createElement("div");
    wrap.className = "table-wrap";

    var tableEl = document.createElement("table");
    if (className) {
      tableEl.className = className;
    }

    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    headers.forEach(function (header) {
      var th = document.createElement("th");
      th.textContent = header;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    var tbody = document.createElement("tbody");
    if (rows.length) {
      rows.forEach(function (row) {
        tbody.appendChild(row);
      });
    } else {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = headers.length;
      td.className = "empty-cell";
      td.textContent = "無資料";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    tableEl.appendChild(thead);
    tableEl.appendChild(tbody);
    wrap.appendChild(tableEl);
    return wrap;
  }

  function appendCells(tr, values) {
    values.forEach(function (value) {
      var td = document.createElement("td");
      if (value instanceof Node) {
        td.appendChild(value);
      } else {
        td.textContent = value == null ? "" : String(value);
      }
      tr.appendChild(td);
    });
  }

  function barCell(value, max) {
    var wrap = document.createElement("div");
    wrap.className = "bar-wrap";
    var bar = document.createElement("div");
    bar.className = "bar";
    bar.style.width = max ? Math.max(3, Math.round(value / max * 100)) + "%" : "0";
    var text = document.createElement("span");
    text.textContent = String(value);
    wrap.appendChild(bar);
    wrap.appendChild(text);
    return wrap;
  }

  function badge(win) {
    var span = document.createElement("span");
    span.className = win ? "badge win" : "badge nom";
    span.textContent = win ? "🏆 得獎" : "入圍";
    return span;
  }

  function personLink(name) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "person-link";
    button.textContent = name || "";
    button.addEventListener("click", function () {
      if (name) {
        openPerson(name);
      }
    });
    return button;
  }

  function statCard(label, value) {
    return el("div", { className: "stat" }, [
      el("span", {}, [label]),
      el("strong", {}, [String(value)])
    ]);
  }

  function catLabel(record) {
    return record.grp ? record.grp + " / " + record.cat : record.cat;
  }

  function editionYear(edition) {
    var found = state.editions.find(function (item) {
      return item.e === edition;
    });
    return found ? found.y : "";
  }

  function groupBy(items, keyFn) {
    var result = {};
    items.forEach(function (item) {
      var key = keyFn(item);
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(item);
    });
    return result;
  }

  function unique(values) {
    var seen = new Set();
    var result = [];
    values.forEach(function (value) {
      var cleaned = clean(value);
      if (cleaned && !seen.has(cleaned)) {
        seen.add(cleaned);
        result.push(cleaned);
      }
    });
    return result;
  }

  function splitPeople(value) {
    var cleaned = clean(value);
    if (!cleaned) {
      return [];
    }
    return cleaned.split(/[、,，／/;；]/).map(clean).filter(Boolean);
  }

  function sortText(a, b) {
    return String(a || "").localeCompare(String(b || ""), "zh-Hant-u-co-stroke", {
      numeric: true,
      sensitivity: "base"
    });
  }

  function clean(value) {
    return value == null ? "" : String(value).trim();
  }

  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function el(tag, props, children) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (key) {
      if (key === "className") {
        node.className = props[key];
      } else if (key === "htmlFor") {
        node.htmlFor = props[key];
      } else {
        node.setAttribute(key, props[key]);
      }
    });
    (children || []).forEach(function (child) {
      if (child instanceof Node) {
        node.appendChild(child);
      } else {
        node.appendChild(document.createTextNode(String(child)));
      }
    });
    return node;
  }
}());
