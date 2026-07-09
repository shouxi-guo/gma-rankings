(function () {
  "use strict";

  var DATA_URL = "data/gma.json";
  var FALLBACK_URL = "data/gma.sample.json";
  var PAGE_SIZE = 100;
  var SECTIONS = ["演唱類", "演奏類", "傳藝類", "技術類", "特別獎"];
  var LANGS = ["華語", "台語", "客語", "原住民語"];
  // entity looks like a company/unit when it ENDS with a business suffix
  // (optionally followed by a parenthetical alias); performers like
  // "山狗大樂團"/"東埔國小合唱團" are deliberately NOT matched
  var COMPANY_RE = /(公司|事業|出版社|工作室|音像|傳播|唱片|文化|音樂|娛樂|經紀|合作行|出版部|製作所)([（(][^）)]*[）)])?$/;

  var UI_TEXT = {
    loading: "載入資料中...",
    loadFail: "資料載入失敗：",
    titleSearch: "搜尋人名 / 團體",
    searchPlaceholder: "例：蔡依林、五月天",
    ranking: "排行榜",
    person: "個人頁",
    edition: "依屆次",
    award: "依獎項",
    lineage: "獎項沿革",
    allAwards: "全部獎項",
    allSections: "全部類別",
    allLangs: "全部語種",
    awardName: "獎項",
    section: "類別",
    lang: "語種",
    fromEdition: "屆次起",
    toEdition: "屆次迄",
    sortBy: "排序",
    sortWins: "得獎數",
    sortNoms: "入圍數",
    sortRate: "得獎率",
    entityType: "統計對象",
    typePerson: "個人・團體",
    typeUnit: "公司・單位",
    typeAll: "全部（混排）",
    showMore: "顯示更多",
    totalRows: "共 {0} 筆統計；目前顯示 {1} 筆",
    rank: "排名",
    name: "名字",
    wins: "得獎數",
    noms: "入圍數",
    rate: "得獎率",
    strength: "得獎數橫條",
    empty: "無資料",
    win: "🏆 得獎",
    nom: "入圍",
    backLabel: "← 返回",
    nomineeCol: "入圍 / 得獎者",
    choosePerson: "請在上方搜尋框輸入或選擇人名、團體名稱。",
    totalNoms: "總入圍",
    totalWins: "總得獎",
    activeRange: "活躍屆次",
    sectionDist: "類別分布",
    editionCol: "屆",
    year: "年",
    work: "作品",
    performer: "演唱/演奏/導演",
    unit: "報名單位",
    result: "結果",
    chooseEdition: "選擇屆次",
    summaryEdition: "第 {0} 屆共 {1} 筆紀錄",
    showNominees: "顯示入圍",
    summaryAward: "{0}，共 {1} 筆紀錄",
    currentAward: "現行獎名",
    lineageCol: "歷屆名稱沿革",
    covered: "涵蓋屆數",
    currentName: "現行",
    originalName: "當屆原名",
    unknown: "未分類",
    noLang: "無",
    editionFormat: "第 {0} 屆（{1}）",
    edOnly: "第 {0} 屆",
    edSuffix: "屆",
    sourceExtra: "第36/37屆資料整理自維基百科。"
  };

  var state = {
    data: null,
    meta: {},
    records: [],
    editions: [],
    awards: {},
    awardList: [],
    categories: [],
    names: [],
    lang: "trad",
    tab: "ranking",
    selectedPerson: "",
    selectedEdition: "",
    selectedAward: "",
    showNominees: false,
    rankVisible: PAGE_SIZE,
    rankingFilters: {
      aid: "",
      section: "",
      lang: "",
      from: "",
      to: "",
      sort: "wins",

      type: "person"  // 預設個人・團體，避免公司與歌手混排
    }
  };

  var dom = {};
  var t2sMap = new Map();

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    buildT2SMap();
    state.lang = localStorage.getItem("gma-lang") === "simp" ? "simp" : "trad";

    dom.status = document.getElementById("status");
    dom.app = document.getElementById("app");
    dom.globalSearch = document.getElementById("globalSearch");
    dom.suggestions = document.getElementById("suggestions");
    dom.langButtons = Array.prototype.slice.call(
      document.querySelectorAll("#langSwitch button"));
    dom.brandTitle = document.querySelector("h1");
    dom.tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));

    bindBaseEvents();
    applyStaticText();
    loadData();
  }

  function buildT2SMap() {
    var obj = typeof T2S_MAP === "object" && T2S_MAP ? T2S_MAP : {};
    Object.keys(obj).forEach(function (key) {
      t2sMap.set(key, obj[key]);
    });
  }

  function t2s(value) {
    var str = value == null ? "" : String(value);
    var out = "";
    for (var i = 0; i < str.length; i += 1) {
      out += t2sMap.get(str.charAt(i)) || str.charAt(i);
    }
    return out;
  }

  function tx(value) {
    return state.lang === "simp" ? t2s(value) : String(value == null ? "" : value);
  }

  function txt(key) {
    return tx(UI_TEXT[key] || key);
  }

  function norm(value) {
    return t2s(clean(value)).toLowerCase();
  }

  function bindBaseEvents() {
    dom.tabs.forEach(function (button) {
      button.addEventListener("click", function () {
        setTab(button.getAttribute("data-tab"));
      });
    });

    dom.langButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var lang = button.getAttribute("data-lang");
        if (lang !== state.lang) {
          state.lang = lang;
          localStorage.setItem("gma-lang", state.lang);
          applyStaticText();
          render();
        }
      });
    });

    // clicking the site title resets everything back to the default view
    dom.brandTitle.addEventListener("click", resetToHome);

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

    window.addEventListener("hashchange", function () {
      readHash();
      render();
    });
  }

  function applyStaticText() {
    document.documentElement.lang = state.lang === "simp" ? "zh-Hans" : "zh-Hant";
    document.title = tx("金曲獎資料庫 GMA Rankings");
    document.querySelector("h1").innerHTML = "🏆 " + tx("金曲獎資料庫") + " <span>GMA Rankings</span>";
    document.querySelector(".subtitle").textContent = tx("資料來源：文化部影視及流行音樂產業局開放資料");
    document.querySelector(".global-search label").textContent = txt("titleSearch");
    dom.globalSearch.placeholder = txt("searchPlaceholder");
    dom.langButtons.forEach(function (button) {
      button.classList.toggle("is-on",
        button.getAttribute("data-lang") === state.lang);
    });
    dom.tabs.forEach(function (button) {
      button.textContent = txt(button.getAttribute("data-tab"));
    });
    var footerSpans = document.querySelectorAll("footer span");
    if (footerSpans[0]) {
      footerSpans[0].textContent = tx("本站為非官方資料整理，獎項與得獎名單以主辦單位公告為準。");
    }
    if (footerSpans[1]) {
      footerSpans[1].textContent = txt("sourceExtra");
    }
    dom.status.textContent = txt("loading");
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
        dom.status.textContent = txt("loadFail") + error.message;
      });
  }

  function prepareData(json) {
    var meta = json.meta || {};
    var rawRecords = Array.isArray(json.records) ? json.records : [];

    state.data = json;
    state.meta = meta;
    state.records = rawRecords.map(function (record) {
      return {
        e: Number(record.e) || 0,
        y: Number(record.y) || 0,
        cat: clean(record.cat),
        aid: clean(record.aid) || clean(record.cat),
        work: clean(record.work),
        who: clean(record.who),
        unit: clean(record.unit),
        win: Boolean(record.win),
        grp: clean(record.grp),
        perf: clean(record.perf)
      };
    });

    state.awards = normalizeAwards(meta.awards || {});
    state.awardList = Object.keys(state.awards).map(function (aid) {
      return Object.assign({ aid: aid }, state.awards[aid]);
    }).sort(function (a, b) {
      return sectionIndex(a.section) - sectionIndex(b.section) || sortText(a.name, b.name);
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

    state.editions = Object.keys(editionMap).map(function (key) {
      return { e: Number(key), y: Number(editionMap[key]) || 0 };
    }).filter(function (item) {
      return item.e > 0;
    }).sort(function (a, b) {
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
    if (state.awardList.length) {
      state.selectedAward = state.awardList[0].aid;
    }

    readHash();
  }

  function normalizeAwards(awards) {
    var result = {};
    Object.keys(awards).forEach(function (aid) {
      var item = awards[aid] || {};
      result[aid] = {
        name: clean(item.name) || aid,
        section: clean(item.section) || UI_TEXT.unknown,
        lang: clean(item.lang),
        names: Array.isArray(item.names) ? item.names.map(function (nameItem) {
          return {
            n: clean(nameItem.n),
            eds: Array.isArray(nameItem.eds) ? nameItem.eds.map(Number).filter(Boolean).sort(function (a, b) {
              return a - b;
            }) : []
          };
        }).filter(function (nameItem) {
          return nameItem.n;
        }) : []
      };
    });

    state.records.forEach(function (record) {
      if (!result[record.aid]) {
        result[record.aid] = {
          name: record.cat || record.aid,
          section: record.grp || UI_TEXT.unknown,
          lang: "",
          names: [{ n: record.cat || record.aid, eds: uniqueNumbers([record.e]) }]
        };
      }
    });

    return result;
  }

  function buildNames() {
    var all = [];
    state.records.forEach(function (record) {
      splitPeople(record.who).concat(splitPerf(record.perf)).forEach(function (name) {
        all.push(name);
      });
    });
    return unique(all).filter(function (name) {
      return name !== "從缺";
    }).sort(sortText);
  }

  function readHash() {
    var hash;
    try {
      hash = decodeURIComponent(window.location.hash || "").replace(/^#/, "");
    } catch (e) {
      hash = "";  // malformed percent-encoding in the URL
    }
    if (!hash) {
      return;
    }
    var parts = hash.split("/");
    if (parts[0] === "person" && parts[1]) {
      state.selectedPerson = parts.slice(1).join("/");
      state.tab = "person";
    } else if (parts[0] === "edition" && parts[1]) {
      state.selectedEdition = parts[1];
      state.tab = "edition";
    } else if (parts[0] === "award" && parts[1]) {
      state.selectedAward = parts.slice(1).join("/");
      state.tab = "award";
    } else if (parts[0] === "work" && parts[1] && parts[2]) {
      state.selectedWorkE = Number(parts[1]) || 0;
      state.selectedWork = parts.slice(2).join("/");
      state.tab = "work";
    } else if (parts[0] === "lineage") {
      state.tab = "lineage";
    } else if (parts[0] === "ranking") {
      state.tab = "ranking";
    }
  }

  function writeHash() {
    var next;
    if (state.tab === "person" && state.selectedPerson) {
      next = "person/" + encodeURIComponent(state.selectedPerson);
    } else if (state.tab === "edition") {
      next = "edition/" + encodeURIComponent(state.selectedEdition);
    } else if (state.tab === "award") {
      next = "award/" + encodeURIComponent(state.selectedAward);
    } else if (state.tab === "work" && state.selectedWork) {
      next = "work/" + state.selectedWorkE + "/" + encodeURIComponent(state.selectedWork);
    } else if (state.tab === "lineage") {
      next = "lineage";
    } else {
      next = "ranking";
    }
    if (window.location.hash.replace(/^#/, "") !== next) {
      window.location.hash = next;
    }
  }

  function setTab(tab) {
    state.tab = tab;
    state.rankVisible = PAGE_SIZE;
    writeHash();
    render();
  }

  function resetToHome() {
    state.tab = "ranking";
    state.selectedPerson = "";
    state.rankVisible = PAGE_SIZE;
    state.rankingFilters = {
      aid: "",
      section: "",
      lang: "",
      from: state.editions.length ? String(state.editions[0].e) : "",
      to: state.editions.length ? String(state.editions[state.editions.length - 1].e) : "",
      sort: "wins",

      type: "person"
    };
    dom.globalSearch.value = "";
    hideSuggestions();
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
    } else if (state.tab === "work") {
      renderWork();
    } else if (state.tab === "lineage") {
      renderLineage();
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
    var maxWins = rows.length ? Math.max.apply(null, rows.map(function (row) {
      return row.wins;
    })) : 0;

    clear(dom.app);
    var panel = el("section", { className: "panel" }, [
      el("div", { className: "filters ranking-filters" }, [
        field(txt("awardName"), awardSelect("rankAward", true, filters.aid, function (value) {
          filters.aid = value;
          resetRanking();
        })),
        field(txt("section"), selectControl("rankSection", [{ value: "", label: txt("allSections") }].concat(SECTIONS.map(optionLabel)), filters.section, function (value) {
          filters.section = value;
          resetRanking();
        })),
        field(txt("lang"), selectControl("rankLang", [{ value: "", label: txt("allLangs") }].concat(LANGS.map(optionLabel)), filters.lang, function (value) {
          filters.lang = value;
          resetRanking();
        })),
        field(txt("fromEdition"), selectControl("rankFrom", state.editions.map(editionOption), filters.from, function (value) {
          filters.from = value;
          if (Number(filters.to) < Number(value)) {
            filters.to = value;
          }
          resetRanking();
        })),
        field(txt("toEdition"), selectControl("rankTo", state.editions.map(editionOption), filters.to, function (value) {
          filters.to = value;
          if (Number(filters.from) > Number(value)) {
            filters.from = value;
          }
          resetRanking();
        })),
        field(txt("sortBy"), selectControl("rankSort", [
          { value: "wins", label: txt("sortWins") },
          { value: "noms", label: txt("sortNoms") },
          { value: "rate", label: txt("sortRate") }
        ], filters.sort, function (value) {
          filters.sort = value;
          resetRanking();
        })),
        field(txt("entityType"), selectControl("rankType", [
          { value: "person", label: txt("typePerson") },
          { value: "unit", label: txt("typeUnit") },
          { value: "", label: txt("typeAll") }
        ], filters.type, function (value) {
          filters.type = value;
          resetRanking();
        }))
      ]),
      el("div", { className: "summary" }, [
        format(txt("totalRows"), rows.length, visibleRows.length)
      ]),
      table([txt("rank"), txt("name"), txt("wins"), txt("noms"), txt("rate"), txt("strength")], visibleRows.map(function (row, index) {
        var tr = document.createElement("tr");
        tr.tabIndex = 0;
        tr.className = "clickable rank-row";
        tr.addEventListener("click", function () {
          openPerson(row.name);
        });
        tr.addEventListener("keydown", function (event) {
          if (event.key === "Enter") {
            openPerson(row.name);
          }
        });
        appendCells(tr, [
          rankCell(index + 1),
          tx(row.name),
          String(row.wins),
          String(row.noms),
          percent(row.rate),
          barCell(row.wins, maxWins)
        ]);
        return tr;
      }), "ranking-table")
    ]);

    if (state.rankVisible < rows.length) {
      var more = el("button", { className: "more", type: "button" }, [txt("showMore")]);
      more.addEventListener("click", function () {
        state.rankVisible += PAGE_SIZE;
        renderRanking();
      });
      panel.appendChild(more);
    }

    dom.app.appendChild(panel);
  }

  function resetRanking() {
    state.rankVisible = PAGE_SIZE;
    renderRanking();
  }

  function buildRanking() {
    var filters = state.rankingFilters;
    var from = Number(filters.from) || -Infinity;
    var to = Number(filters.to) || Infinity;
    var map = new Map();

    state.records.forEach(function (record) {
      var award = getAward(record.aid);
      if (filters.aid && record.aid !== filters.aid) {
        return;
      }
      if (filters.section && award.section !== filters.section) {
        return;
      }
      if (filters.lang && award.lang !== filters.lang) {
        return;
      }
      if (record.e < from || record.e > to) {
        return;
      }

      var entities = unique(splitPeople(record.who).concat(splitPerf(record.perf)));
      entities.forEach(function (name) {
        if (!name || name === "從缺") {
          return;
        }
        if (filters.type === "person" && COMPANY_RE.test(name)) {
          return;
        }
        if (filters.type === "unit" && !COMPANY_RE.test(name)) {
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

    var rows = Array.from(map.values()).map(function (row) {
      row.rate = row.noms ? row.wins / row.noms : 0;
      return row;
    });

    rows.sort(function (a, b) {
      if (filters.sort === "noms") {
        return b.noms - a.noms || b.wins - a.wins || sortText(a.name, b.name);
      }
      if (filters.sort === "rate") {
        return b.rate - a.rate || b.wins - a.wins || b.noms - a.noms || sortText(a.name, b.name);
      }
      return b.wins - a.wins || b.noms - a.noms || sortText(a.name, b.name);
    });

    return rows;
  }

  function renderPerson() {
    clear(dom.app);

    if (!state.selectedPerson) {
      dom.app.appendChild(el("section", { className: "panel empty" }, [
        el("p", {}, [txt("choosePerson")])
      ]));
      return;
    }

    var personKey = norm(state.selectedPerson);
    var records = state.records.filter(function (record) {
      return unique(splitPeople(record.who).concat(splitPerf(record.perf))).some(function (name) {
        return norm(name) === personKey;
      });
    }).sort(function (a, b) {
      return b.e - a.e || sortText(awardName(a), awardName(b)) || sortText(a.work, b.work);
    });

    var wins = records.filter(function (record) {
      return record.win;
    }).length;
    var editions = uniqueNumbers(records.map(function (record) {
      return record.e;
    })).sort(function (a, b) {
      return a - b;
    });
    var range = editions.length ? editions[0] + "-" + editions[editions.length - 1] : "";
    var bySection = groupBy(records, function (record) {
      return getAward(record.aid).section || txt("unknown");
    });
    var dist = Object.keys(bySection).sort(function (a, b) {
      return sectionIndex(a) - sectionIndex(b) || sortText(a, b);
    }).map(function (section) {
      return tx(section) + " " + bySection[section].length + " " + tx("次");
    }).join("　");

    dom.app.appendChild(el("section", { className: "panel" }, [
      el("div", { className: "person-head" }, [
        el("h2", {}, [tx(state.selectedPerson)])
      ]),
      el("div", { className: "cards" }, [
        statCard(txt("totalNoms"), records.length),
        statCard(txt("totalWins"), wins),
        statCard(txt("rate"), percent(records.length ? wins / records.length : 0)),
        statCard(txt("activeRange"), range)
      ]),
      el("div", { className: "distribution" }, [
        el("strong", {}, [txt("sectionDist") + "："]),
        document.createTextNode(dist || txt("empty"))
      ]),
      table([txt("editionCol"), txt("year"), txt("awardName"), txt("nomineeCol"), txt("work"), txt("performer"), txt("unit"), txt("result")], records.map(function (record) {
        var tr = document.createElement("tr");
        if (record.win) {
          tr.className = "winner-row";
        }
        appendCells(tr, [
          format(txt("edOnly"), record.e),
          String(record.y || ""),
          awardLabel(record),
          peopleLinks(record.who),
          workLink(record),
          tx(record.perf) || "—",
          tx(record.unit || ""),
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
    var groupedBySection = groupBy(records, function (record) {
      return getAward(record.aid).section || UI_TEXT.unknown;
    });
    var sectionBlocks = Object.keys(groupedBySection).sort(function (a, b) {
      return sectionIndex(a) - sectionIndex(b) || sortText(a, b);
    }).map(function (section) {
      var sectionRecords = groupedBySection[section];
      var groupedAwards = groupBy(sectionRecords, function (record) {
        return record.aid;
      });
      var awardBlocks = Object.keys(groupedAwards).sort(function (a, b) {
        return sortText(getAward(a).name, getAward(b).name);
      }).map(function (aid) {
        var groupRecords = groupedAwards[aid].slice().sort(function (a, b) {
          return Number(b.win) - Number(a.win) || sortText(a.who, b.who);
        });
        return el("section", { className: "award-group" }, [
          el("h3", {}, [tx(getAward(aid).name)]),
          table([txt("result"), tx("入圍 / 得獎者"), txt("work"), txt("performer"), txt("unit")], groupRecords.map(recordRow))
        ]);
      });
      return el("section", { className: "section-group" }, [
        el("h2", {}, [tx(section)])
      ].concat(awardBlocks));
    });

    dom.app.appendChild(el("section", { className: "panel" }, [
      el("div", { className: "filters compact" }, [
        field(txt("chooseEdition"), select)
      ]),
      el("div", { className: "summary" }, [format(txt("summaryEdition"), edition, records.length)])
    ].concat(sectionBlocks)));
  }

  function renderAward() {
    clear(dom.app);

    var select = awardSelect("awardSelect", false, state.selectedAward, function (value) {
      state.selectedAward = value;
      writeHash();
      renderAward();
    });

    var checkbox = checkField("showNominees", txt("showNominees"), state.showNominees, function (checked) {
      state.showNominees = checked;
      renderAward();
    });

    var award = getAward(state.selectedAward);
    var records = state.records.filter(function (record) {
      return record.aid === state.selectedAward;
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
        el("h3", {}, [format(txt("editionFormat"), edition, year || "")]),
        table([txt("result"), tx("入圍 / 得獎者"), txt("work"), txt("performer"), txt("unit"), txt("originalName")], shown.map(function (record) {
          var tr = recordRow(record);
          var td = document.createElement("td");
          td.textContent = tx(record.cat);
          tr.appendChild(td);
          return tr;
        }))
      ]);
    });

    dom.app.appendChild(el("section", { className: "panel" }, [
      el("div", { className: "filters compact" }, [
        field(txt("chooseEdition").replace(txt("edition"), txt("awardName")), select),
        checkbox
      ]),
      el("div", { className: "award-title" }, [
        el("h2", {}, [tx(award.name)]),
        el("div", { className: "timeline" }, [lineageText(award)])
      ]),
      el("div", { className: "summary" }, [format(txt("summaryAward"), tx(award.name), records.length)])
    ].concat(blocks)));
  }

  function renderLineage() {
    clear(dom.app);

    var grouped = groupBy(state.awardList, function (award) {
      return award.section || UI_TEXT.unknown;
    });
    var blocks = Object.keys(grouped).sort(function (a, b) {
      return sectionIndex(a) - sectionIndex(b) || sortText(a, b);
    }).map(function (section) {
      var rows = grouped[section].slice().sort(function (a, b) {
        return sortText(a.name, b.name);
      }).map(function (award) {
        var tr = document.createElement("tr");
        appendCells(tr, [
          tx(award.name),
          tx(award.lang || txt("noLang")),
          lineageText(award),
          coveredEditions(award).join(", ")
        ]);
        return tr;
      });
      return el("section", { className: "section-group" }, [
        el("h2", {}, [tx(section)]),
        table([txt("currentAward"), txt("lang"), txt("lineageCol"), txt("covered")], rows, "lineage-table")
      ]);
    });

    dom.app.appendChild(el("section", { className: "panel" }, blocks));
  }

  function recordRow(record) {
    var tr = document.createElement("tr");
    if (record.win) {
      tr.className = "winner-row";
    }
    appendCells(tr, [
      badge(record.win),
      peopleLinks(record.who),
      workLink(record),
      tx(record.perf) || "—",
      tx(record.unit || "")
    ]);
    return tr;
  }

  function workParts(workStr) {
    // "歌名《專輯》" -> [歌名, 專輯]; "專輯" -> [專輯]; normalized for matching
    var w = clean(workStr);
    if (!w) {
      return [];
    }
    var m = w.match(/^(.*?)《(.*)》$/);
    var parts = m ? [m[1].trim(), m[2].trim()] : [w];
    return parts.map(norm).filter(Boolean);
  }

  function openWork(record) {
    state.selectedWork = record.work;
    state.selectedWorkE = record.e;
    state.tab = "work";
    writeHash();
    render();
  }

  function workLink(record) {
    var label = formatWork(record);
    if (!label) {
      return document.createTextNode("—");
    }
    var button = document.createElement("button");
    button.type = "button";
    button.className = "person-link";
    button.textContent = tx(label);
    button.addEventListener("click", function () {
      openWork(record);
    });
    return button;
  }

  function peopleLinks(who) {
    var names = splitPeople(who);
    if (!names.length) {
      return document.createTextNode(tx(who || "") || "—");
    }
    var wrap = document.createElement("span");
    names.forEach(function (name, i) {
      if (i > 0) {
        wrap.appendChild(document.createTextNode("、"));
      }
      wrap.appendChild(personLink(name));
    });
    return wrap;
  }

  function renderWork() {
    clear(dom.app);

    var targetParts = workParts(state.selectedWork);
    var edition = state.selectedWorkE;
    if (!targetParts.length || !edition) {
      dom.app.appendChild(el("section", { className: "panel empty" }, [
        el("p", {}, [txt("empty")])
      ]));
      return;
    }

    var records = state.records.filter(function (record) {
      if (record.e !== edition) {
        return false;
      }
      return workParts(record.work).some(function (p) {
        return targetParts.indexOf(p) !== -1;
      });
    }).sort(function (a, b) {
      return Number(b.win) - Number(a.win) || sortText(a.cat, b.cat);
    });

    var wins = records.filter(function (r) { return r.win; }).length;
    var year = records.length ? records[0].y : editionYear(edition);

    var back = el("button", { className: "link-button", type: "button" }, [txt("backLabel")]);
    back.addEventListener("click", function () {
      window.history.back();
    });

    var display = records.length ? formatWork(records[0]) : state.selectedWork;

    dom.app.appendChild(el("section", { className: "panel" }, [
      el("div", { className: "person-head" }, [
        back,
        el("h2", {}, [tx(display)]),
        el("span", { className: "muted" }, [format(txt("editionFormat"), edition, year || "")])
      ]),
      el("div", { className: "cards" }, [
        statCard(txt("totalNoms"), records.length),
        statCard(txt("totalWins"), wins)
      ]),
      table([txt("result"), txt("awardName"), txt("nomineeCol"), txt("work"), txt("performer"), txt("unit")],
        records.map(function (record) {
          var tr = document.createElement("tr");
          if (record.win) {
            tr.className = "winner-row";
          }
          appendCells(tr, [
            badge(record.win),
            awardLabel(record),
            peopleLinks(record.who),
            tx(formatWork(record)),
            tx(record.perf) || "—",
            tx(record.unit || "")
          ]);
          return tr;
        }), "records-table")
    ]));
  }

  function formatWork(record) {
    // 專輯用《》、歌曲用〈〉；資料中歌曲類 work 形如「歌名《收錄專輯》」
    var w = clean(record.work);
    if (!w) {
      return "";
    }
    var m = w.match(/^(.*?)《(.*)》$/);
    if (m) {
      return m[1].trim()
        ? "〈" + m[1].trim() + "〉《" + m[2] + "》"
        : "《" + m[2] + "》";
    }
    var award = getAward(record.aid);
    var label = ((award && award.name) || "") + record.cat;
    if (/歌曲|作曲|作詞|編曲|單曲|MV|錄影帶/.test(label)) {
      return "〈" + w + "〉";
    }
    return "《" + w + "》";
  }

  function renderSuggestions(value) {
    var needle = norm(value);
    clear(dom.suggestions);

    if (!needle) {
      hideSuggestions();
      return;
    }

    var matches = state.names.filter(function (name) {
      return norm(name).indexOf(needle) !== -1;
    }).slice(0, 20);

    if (!matches.length) {
      hideSuggestions();
      return;
    }

    matches.forEach(function (name) {
      var button = el("button", { type: "button" }, [tx(name)]);
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
    writeHash();
    render();
  }

  function findName(value) {
    var needle = norm(value);
    for (var i = 0; i < state.names.length; i += 1) {
      if (norm(state.names[i]) === needle) {
        return state.names[i];
      }
    }
    for (var j = 0; j < state.names.length; j += 1) {
      if (norm(state.names[j]).indexOf(needle) !== -1) {
        return state.names[j];
      }
    }
    return "";
  }

  function awardSelect(id, includeAll, value, onChange) {
    var select = document.createElement("select");
    select.id = id;
    if (includeAll) {
      var all = document.createElement("option");
      all.value = "";
      all.textContent = txt("allAwards");
      select.appendChild(all);
    }

    var grouped = groupBy(state.awardList, function (award) {
      return award.section || UI_TEXT.unknown;
    });
    Object.keys(grouped).sort(function (a, b) {
      return sectionIndex(a) - sectionIndex(b) || sortText(a, b);
    }).forEach(function (section) {
      var optgroup = document.createElement("optgroup");
      optgroup.label = tx(section);
      grouped[section].forEach(function (award) {
        var opt = document.createElement("option");
        opt.value = award.aid;
        opt.textContent = tx(award.name);
        optgroup.appendChild(opt);
      });
      select.appendChild(optgroup);
    });

    select.value = value;
    select.addEventListener("change", function () {
      onChange(select.value);
    });
    return select;
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

  function checkField(id, labelText, checked, onChange) {
    var input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.checked = checked;
    input.addEventListener("change", function () {
      onChange(input.checked);
    });
    return el("label", { className: "check-field", htmlFor: id }, [input, document.createTextNode(labelText)]);
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

  function optionLabel(value) {
    return { value: value, label: tx(value) };
  }

  function editionOption(item) {
    return {
      value: String(item.e),
      label: format(txt("editionFormat"), item.e, item.y)
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
      td.textContent = txt("empty");
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

  function rankCell(rank) {
    var span = document.createElement("span");
    span.className = "rank-num rank-" + rank;
    span.textContent = String(rank);
    return span;
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
    span.textContent = win ? txt("win") : txt("nom");
    return span;
  }

  function personLink(name) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "person-link";
    button.textContent = tx(name || "");
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

  function awardLabel(record) {
    var award = getAward(record.aid);
    var wrap = document.createElement("span");
    wrap.appendChild(document.createTextNode(tx(award.name)));
    if (record.cat && record.cat !== award.name) {
      wrap.appendChild(el("small", {}, ["（" + txt("originalName") + "：" + tx(record.cat) + "）"]));
    }
    return wrap;
  }

  function awardName(record) {
    return getAward(record.aid).name;
  }

  function getAward(aid) {
    return state.awards[aid] || { name: aid || "", section: UI_TEXT.unknown, lang: "", names: [] };
  }

  function lineageText(award) {
    var items = (award.names || []).map(function (item) {
      return tx(item.n) + "（" + edRangeText(item.eds) + "）";
    });
    if (!items.length) {
      items = [tx(award.name)];
    }
    return items.join(" → ");
  }

  function edRangeText(eds) {
    var ranges = compressRanges(eds || []);
    return ranges.map(function (range) {
      if (range[0] === range[1]) {
        return range[0] + txt("edSuffix");
      }
      return range[0] + "-" + range[1] + txt("edSuffix");
    }).join("、");
  }

  function coveredEditions(award) {
    return uniqueNumbers([].concat.apply([], (award.names || []).map(function (item) {
      return item.eds || [];
    }))).sort(function (a, b) {
      return a - b;
    });
  }

  function compressRanges(values) {
    var nums = uniqueNumbers(values).sort(function (a, b) {
      return a - b;
    });
    var ranges = [];
    nums.forEach(function (num) {
      var last = ranges[ranges.length - 1];
      if (last && last[1] + 1 === num) {
        last[1] = num;
      } else {
        ranges.push([num, num]);
      }
    });
    return ranges;
  }

  function editionYear(edition) {
    var found = state.editions.find(function (item) {
      return item.e === edition;
    });
    return found ? found.y : "";
  }

  function splitPerf(value) {
    var cleaned = clean(value);
    if (!cleaned) {
      return [];
    }
    var result = [];
    cleaned.split(/[／/]/).forEach(function (part) {
      var noRole = part.replace(/^[^：:]{1,12}[：:]/, "");
      result = result.concat(splitPlainPeople(noRole));
    });
    return unique(result);
  }

  function splitPeople(value) {
    var cleaned = clean(value);
    if (!cleaned) {
      return [];
    }
    var result = [];
    cleaned.split(/[／/]/).forEach(function (part) {
      var colon = part.match(/^([^：:]{1,32})[：:](.+)$/);
      if (colon) {
        // "評審團獎：陳小霞" — keep the label only if it is not a role word
        if (!/演唱|演奏|作曲|作詞|導演|錄音|混音|母帶|主要|人員/.test(colon[1])) {
          result.push(clean(colon[1]));
        }
        result = result.concat(splitPlainPeople(colon[2]));
      } else {
        result = result.concat(splitPlainPeople(part));
      }
    });
    return unique(result);
  }

  function splitPlainPeople(value) {
    // split on 、,，;； only OUTSIDE parentheses, so
    // "草東沒有派對（林耕佑、詹爲筑）" is not broken into fragments
    var text = clean(value);
    var tokens = [];
    var buf = "", depth = 0;
    for (var i = 0; i < text.length; i += 1) {
      var ch = text.charAt(i);
      if (ch === "（" || ch === "(") depth += 1;
      if (ch === "）" || ch === ")") depth = Math.max(0, depth - 1);
      if (depth === 0 && /[、,，;；]/.test(ch)) {
        tokens.push(buf); buf = "";
      } else {
        buf += ch;
      }
    }
    tokens.push(buf);

    var result = [];
    tokens.forEach(function (token) {
      var name = clean(token).replace(/^及/, "").replace(/等$/, "");
      if (!name) return;
      // "團體（成員A、成員B）" -> the group AND each member;
      // "孫家麟（孫儀）" (alias, no 、 inside) stays as one entity
      var m = name.match(/^(.+?)[（(]([^（）()]*[、,，][^（）()]*)[）)]$/);
      if (m) {
        result.push(clean(m[1]));
        m[2].split(/[、,，;；]/).forEach(function (member) {
          var p = clean(member);
          if (p) result.push(p);
        });
      } else {
        result.push(name);
      }
    });
    return result;
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

  function uniqueNumbers(values) {
    var seen = new Set();
    var result = [];
    values.forEach(function (value) {
      var num = Number(value);
      if (num && !seen.has(num)) {
        seen.add(num);
        result.push(num);
      }
    });
    return result;
  }

  function sectionIndex(section) {
    var index = SECTIONS.indexOf(section);
    return index === -1 ? SECTIONS.length : index;
  }

  function sortText(a, b) {
    return String(a || "").localeCompare(String(b || ""), "zh-Hant-u-co-stroke", {
      numeric: true,
      sensitivity: "base"
    });
  }

  function percent(value) {
    return Math.round((Number(value) || 0) * 1000) / 10 + "%";
  }

  function format(template) {
    var args = Array.prototype.slice.call(arguments, 1);
    return String(template).replace(/\{(\d+)\}/g, function (_, index) {
      return args[Number(index)] == null ? "" : String(args[Number(index)]);
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
