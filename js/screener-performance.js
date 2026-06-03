/* =============================================================================
 * screener-performance.js
 * "Performance vs S&P 500" chart for the screener mini-site.
 *
 * MODEL: held while criteria met
 *   - Each pick OPENS a position at its first-appearance snapshot's close.
 *   - The position CLOSES at the next snapshot where the ticker is no longer
 *     in picks; the close uses that snapshot's price as the exit.
 *   - A ticker that drops out and later re-qualifies opens a new, separate
 *     position (no carry-over from the prior position).
 *   - Positions still in picks at the latest snapshot are marked-to-market.
 *
 * BENCHMARK
 *   - Per-strategy summary cards compare against PAIRED SPY: every time the
 *     strategy opens a position, an equal-weight SPY position opens the same
 *     day and holds for the same period. Apples-to-apples since both invest
 *     on the same schedule.
 *   - The SPY line on the chart is plain BUY-AND-HOLD SPY from the first
 *     snapshot. Useful for absolute market context; the FAIR comparison is the
 *     paired-SPY delta on each card. The methodology details below the chart
 *     spell this out.
 *
 * Curve values are decimals (0.1 == +10%); the renderer multiplies by 100.
 * ============================================================================= */

(function (global) {
  'use strict';

  var PRICE_LOOKBACK_DAYS = 5;
  var BENCHMARK = 'SPY';
  var TARGET_SNAPSHOTS = 8;

  var COLUMN_MAP = {
    snapshotId:     'id',
    snapshotDate:   'createdAt',
    pickSnapshotId: 'snapshotId',
    pickStrategy:   'strategyKey',
    pickTicker:     'ticker',
    priceTicker:    'ticker',
    priceDate:      'date',
    priceClose:     'close'
  };

  // ---- date helpers (ISO 'YYYY-MM-DD'; string compare == chronological) ----
  function isoDay(v) {
    if (v == null) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
  }
  function daysBetween(isoA, isoB) {
    return Math.round(
      (new Date(isoA + 'T00:00:00Z').getTime() - new Date(isoB + 'T00:00:00Z').getTime()) / 86400000
    );
  }
  function minusDays(iso, n) {
    return new Date(new Date(iso + 'T00:00:00Z').getTime() - n * 86400000).toISOString().slice(0, 10);
  }

  /* normalizeData — reshape rows into { snapshots, picks, prices }. Pure. */
  function normalizeData(raw, map) {
    map = map || COLUMN_MAP;
    var snaps = (raw.snapshots || []).map(function (r) {
      return { id: r[map.snapshotId], date: isoDay(r[map.snapshotDate]) };
    }).filter(function (s) { return s.id != null && s.date; });
    snaps.sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1
           : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });

    var picks = (raw.picks || []).map(function (r) {
      return {
        snapshotId: r[map.pickSnapshotId],
        strategy:   r[map.pickStrategy],
        ticker:     r[map.pickTicker]
      };
    }).filter(function (p) { return p.snapshotId != null && p.strategy && p.ticker; });

    var prices = {};
    (raw.prices || []).forEach(function (r) {
      var t = r[map.priceTicker], d = isoDay(r[map.priceDate]), c = Number(r[map.priceClose]);
      if (!t || !d || !isFinite(c)) return;
      (prices[t] || (prices[t] = {}))[d] = c;
    });

    return { snapshots: snaps, picks: picks, prices: prices };
  }

  /* priceAt — latest close on or before `date`, within PRICE_LOOKBACK_DAYS. */
  function priceAt(prices, cache, ticker, date) {
    var byDate = prices[ticker];
    if (!byDate) return null;
    var keys = cache[ticker] || (cache[ticker] = Object.keys(byDate).sort());
    var best = null;
    for (var i = keys.length - 1; i >= 0; i--) {
      if (keys[i] <= date) { best = keys[i]; break; }
    }
    if (best == null || daysBetween(date, best) > PRICE_LOOKBACK_DAYS) return null;
    return byDate[best];
  }

  /* ---------------------------------------------------------------------------
   * computePerformance — Model B with paired SPY.
   *
   * Per strategy: walk snapshots chronologically, maintaining a set of open
   * positions per ticker. On each snapshot, close any open positions whose
   * ticker is no longer picked, and open new positions for newly-picked
   * tickers. Each opened position records its entry price, paired SPY entry
   * price, and (later) an exit date when it falls out.
   *
   * Then, for each snapshot date t, average the position returns across
   * positions whose entryDate <= t:
   *   evalDate = exitDate (if closed by t) else t
   *   strat ret = priceAt(ticker, evalDate) / entryPrice - 1
   *   paired SPY ret = priceAt(SPY, evalDate) / spyEntry - 1
   * Both arrays stay length-matched by skipping a position if either price
   * is missing.
   *
   * Returns {
   *   ready, dates, strategies,
   *   series:          { strat: [cumDecimal at each snapshot date] },
   *   pairedBenchmark: { strat: [cumDecimal at each snapshot date] },   // for cards
   *   benchmark:       [cumDecimal at each snapshot date],              // BH SPY (chart line)
   *   benchmarkTicker, coverage
   * }
   * ------------------------------------------------------------------------- */
  function computePerformance(snapshots, picks, prices, opts) {
    opts = opts || {};
    var benchTicker = opts.benchmark || BENCHMARK;
    var cache = {};
    var coverage = {
      snapshotCount: snapshots.length,
      dateRange: snapshots.length
        ? { start: snapshots[0].date, end: snapshots[snapshots.length - 1].date } : null,
      notes: []
    };

    var dates = snapshots.map(function (s) { return s.date; });

    if (snapshots.length < 2) {
      return {
        ready: false, dates: dates, strategies: [],
        series: {}, pairedBenchmark: {}, benchmark: [],
        benchmarkTicker: benchTicker, coverage: coverage
      };
    }

    // Group picks: snapshotId -> strategy -> Set(tickers)
    var picksBySnapAndStrat = {};
    var strategySet = {};
    picks.forEach(function (p) {
      strategySet[p.strategy] = true;
      var bySnap = picksBySnapAndStrat[p.snapshotId] || (picksBySnapAndStrat[p.snapshotId] = {});
      (bySnap[p.strategy] || (bySnap[p.strategy] = Object.create(null)))[p.ticker] = true;
    });
    var strategies = Object.keys(strategySet).sort();

    // Position tracking per strategy
    var posByStrategy = {};
    var openByStrategy = {};
    strategies.forEach(function (st) {
      posByStrategy[st] = [];
      openByStrategy[st] = Object.create(null);
    });

    for (var i = 0; i < snapshots.length; i++) {
      var snap = snapshots[i];
      var pickedAtSnap = picksBySnapAndStrat[snap.id] || {};

      for (var sIdx = 0; sIdx < strategies.length; sIdx++) {
        var st = strategies[sIdx];
        var picked = pickedAtSnap[st] || Object.create(null);
        var open = openByStrategy[st];

        // EXITS first (so a re-entry on the same snap can't see itself as open)
        var openTickers = Object.keys(open);
        for (var k = 0; k < openTickers.length; k++) {
          var openTicker = openTickers[k];
          if (!picked[openTicker]) {
            open[openTicker].exitDate = snap.date;   // close at this snap's close
            delete open[openTicker];
          }
        }

        // ENTRIES: anything picked but not currently open
        var pickedTickers = Object.keys(picked);
        for (var j = 0; j < pickedTickers.length; j++) {
          var tk = pickedTickers[j];
          if (open[tk]) continue;
          var entryPrice = priceAt(prices, cache, tk, snap.date);
          var spyEntry = priceAt(prices, cache, benchTicker, snap.date);
          if (entryPrice == null || entryPrice <= 0 ||
              spyEntry == null || spyEntry <= 0) {
            coverage.notes.push(st + ': could not open ' + tk + ' at ' + snap.date + ' (price unavailable)');
            continue;
          }
          var pos = { ticker: tk, entryDate: snap.date, entryPrice: entryPrice,
                      spyEntry: spyEntry, exitDate: null };
          posByStrategy[st].push(pos);
          open[tk] = pos;
        }
      }
    }

    // No positions opened anywhere -> empty state
    var anyPos = strategies.some(function (st) { return posByStrategy[st].length > 0; });
    if (!anyPos) {
      return {
        ready: false, dates: dates, strategies: strategies,
        series: {}, pairedBenchmark: {}, benchmark: [],
        benchmarkTicker: benchTicker, coverage: coverage
      };
    }

    // Curves
    var series = {};
    var pairedBenchmark = {};
    for (var sx = 0; sx < strategies.length; sx++) {
      var strat = strategies[sx];
      var positions = posByStrategy[strat];
      series[strat] = [];
      pairedBenchmark[strat] = [];

      for (var di = 0; di < dates.length; di++) {
        var t = dates[di];
        var stratSum = 0, spySum = 0, n = 0;
        for (var pi = 0; pi < positions.length; pi++) {
          var pos = positions[pi];
          if (pos.entryDate > t) continue;
          var evalDate = (pos.exitDate != null && pos.exitDate <= t) ? pos.exitDate : t;
          var p = priceAt(prices, cache, pos.ticker, evalDate);
          var sp = priceAt(prices, cache, benchTicker, evalDate);
          if (p == null || p <= 0 || sp == null || sp <= 0) continue;
          stratSum += (p / pos.entryPrice - 1);
          spySum   += (sp / pos.spyEntry - 1);
          n++;
        }
        series[strat].push(n > 0 ? stratSum / n : 0);
        pairedBenchmark[strat].push(n > 0 ? spySum / n : 0);
      }
    }

    // Buy-and-hold SPY reference line (for the chart)
    var benchmark = [];
    var spyAtStart = priceAt(prices, cache, benchTicker, dates[0]);
    for (var bi = 0; bi < dates.length; bi++) {
      if (spyAtStart == null || spyAtStart <= 0) { benchmark.push(0); continue; }
      var spyT = priceAt(prices, cache, benchTicker, dates[bi]);
      benchmark.push(spyT == null ? 0 : spyT / spyAtStart - 1);
    }

    // Ready when at least one strategy has a non-zero curve point (i.e. some
    // position has had time to realize a return). With only one snapshot, all
    // positions have entry == eval -> all 0% -> still not "ready" for display.
    var hasSignal = strategies.some(function (st) {
      var arr = series[st];
      for (var k = 1; k < arr.length; k++) if (arr[k] !== 0) return true;
      return false;
    });

    return {
      ready: hasSignal, dates: dates, strategies: strategies,
      series: series, pairedBenchmark: pairedBenchmark, benchmark: benchmark,
      benchmarkTicker: benchTicker, coverage: coverage
    };
  }

  /* =========================================================================
   * Browser integration (render + fetch glue). Most of this is unchanged from
   * the previous build; the summary cards now read from pairedBenchmark, and
   * a methodology details block is added below the chart.
   * ========================================================================= */

  function readColors(el) {
    var cs = getComputedStyle(el);
    function v(name, fb) { var x = cs.getPropertyValue(name).trim(); return x || fb; }
    return {
      benchmark: v('--muted2', '#9aa0a6'),
      grid:      v('--border', 'rgba(255,255,255,0.10)'),
      text:      v('--text', '#e8e8e8'),
      palette: [ v('--accent', '#3b82f6'), v('--accent2', '#10b981'), '#f59e0b', '#a142f4', '#ff6d00' ]
    };
  }

  function ensureChartJs() {
    if (global.Chart) return Promise.resolve(global.Chart);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
      s.onload = function () { resolve(global.Chart); };
      s.onerror = function () { reject(new Error('chart library failed to load')); };
      document.head.appendChild(s);
    });
  }

  function renderEmptyState(container, perf) {
    container.innerHTML =
      '<div class="screener-placeholder">' +
        '\uD83D\uDCCA Collecting weekly snapshots \u2014 <strong>' + perf.coverage.snapshotCount +
        ' / ' + TARGET_SNAPSHOTS + '</strong>. The chart appears once at least two ' +
        'snapshots exist and one position has time to realize a return.' +
      '</div>';
  }

  function strategyDisplayOrder(perf, opts) {
    var order = (opts && opts.strategyOrder ? opts.strategyOrder.slice() : []).filter(function (k) {
      return perf.strategies.indexOf(k) !== -1;
    });
    perf.strategies.forEach(function (s) { if (order.indexOf(s) === -1) order.push(s); });
    return order;
  }

  function pctSigned(v) {
    return (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
  }

  function methodologyHtml(perf) {
    return '<details class="screener-perf__methodology">' +
      '<summary>How this is calculated</summary>' +
      '<p>Each pick opens a position at the close of the snapshot when it\u2019s ' +
      'first selected, and closes at the next snapshot where it\u2019s no longer ' +
      'in the strategy\u2019s picks. Continuing positions are marked-to-market at ' +
      'the latest snapshot. Each strategy\u2019s cumulative return is the equal-' +
      'weight average across every position (open and closed) at the current date.</p>' +
      '<p>The \u201Cvs ' + perf.benchmarkTicker + '\u201D figure on each strategy card uses ' +
      '<strong>paired ' + perf.benchmarkTicker + '</strong>: every time the strategy opens a ' +
      'position, an equal-weight ' + perf.benchmarkTicker + ' position opens the same day and ' +
      'holds for the same period. This is the apples-to-apples comparison because both invest ' +
      'on the same schedule. The dashed ' + perf.benchmarkTicker + ' line on the chart shows ' +
      'plain buy-and-hold ' + perf.benchmarkTicker + ' from the first snapshot, for absolute ' +
      'market context only.</p>' +
      '<p>Multi-year (5Y) growth figures used in screening are approximated from the ~4 years ' +
      'of annual statements available via yfinance, so they may understate or overstate true ' +
      '5-year growth.</p>' +
      '</details>';
  }

  async function renderPerformance(container, perf, opts) {
    opts = opts || {};
    if (!perf.ready) return renderEmptyState(container, perf);

    var colors = readColors(container);
    var meta = opts.strategyMeta || {};
    var order = strategyDisplayOrder(perf, opts);

    // Per-strategy summary cards (top): cumulative + paired-SPY delta.
    var benchLast = perf.benchmark[perf.benchmark.length - 1];
    var summaryHtml =
      '<div class="screener-perf__summary">' +
        order.map(function (st, i) {
          var stratLast = perf.series[st][perf.series[st].length - 1];
          var pairedLast = (perf.pairedBenchmark[st] || [])[(perf.pairedBenchmark[st] || []).length - 1] || 0;
          var delta = stratLast - pairedLast;
          var name = (meta[st] && meta[st].name) || st;
          var color = (meta[st] && meta[st].color) || colors.palette[i % colors.palette.length];
          var valCls = stratLast >= 0 ? ' is-up' : ' is-down';
          var deltaCls = delta >= 0 ? ' is-up' : ' is-down';
          return '<div class="screener-perf__sum-item" style="--st-color:' + color + '">' +
                   '<div class="screener-perf__sum-label">' + name + '</div>' +
                   '<div class="screener-perf__sum-value' + valCls + '">' + pctSigned(stratLast) + '</div>' +
                   '<div class="screener-perf__sum-delta' + deltaCls + '">vs ' + perf.benchmarkTicker +
                   ' (paired) ' + pctSigned(delta) + '</div>' +
                 '</div>';
        }).join('') +
        '<div class="screener-perf__sum-item screener-perf__sum-item--bench">' +
          '<div class="screener-perf__sum-label">' + perf.benchmarkTicker + ' since start</div>' +
          '<div class="screener-perf__sum-value' + (benchLast >= 0 ? ' is-up' : ' is-down') + '">' +
            pctSigned(benchLast) + '</div>' +
          '<div class="screener-perf__sum-delta">buy-and-hold reference</div>' +
        '</div>' +
      '</div>';

    container.innerHTML =
      '<div class="screener-perf">' +
        summaryHtml +
        '<p class="screener-perf__range">' +
          perf.coverage.dateRange.start + ' \u2192 ' + perf.coverage.dateRange.end +
          ' \u00b7 ' + perf.coverage.snapshotCount + ' snapshots \u00b7 held while criteria met' +
        '</p>' +
        '<div class="screener-perf__chart"><canvas></canvas></div>' +
        methodologyHtml(perf) +
        (perf.coverage.notes.length
          ? '<details class="screener-perf__notes"><summary>Data gaps (' + perf.coverage.notes.length +
            ')</summary><ul><li>' + perf.coverage.notes.join('</li><li>') + '</li></ul></details>'
          : '') +
      '</div>';

    var Chart;
    try { Chart = await ensureChartJs(); }
    catch (e) {
      container.querySelector('.screener-perf__chart').innerHTML =
        '<p class="muted">Couldn\u2019t load the chart library.</p>';
      return;
    }

    // Chart: one solid line per strategy + a dashed buy-and-hold SPY reference.
    var datasets = order.map(function (st, i) {
      return {
        label: (meta[st] && meta[st].name) || st,
        data: perf.series[st].map(function (v) { return +(v * 100).toFixed(2); }),
        borderColor: (meta[st] && meta[st].color) || colors.palette[i % colors.palette.length],
        backgroundColor: 'transparent', tension: 0.2, pointRadius: 3, borderWidth: 2
      };
    });
    datasets.push({
      label: perf.benchmarkTicker + ' (buy & hold)',
      data: perf.benchmark.map(function (v) { return +(v * 100).toFixed(2); }),
      borderColor: colors.benchmark, backgroundColor: 'transparent',
      borderDash: [6, 4], tension: 0.2, pointRadius: 2, borderWidth: 2
    });

    new Chart(container.querySelector('canvas').getContext('2d'), {
      type: 'line',
      data: { labels: perf.dates, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: colors.text, usePointStyle: true, boxWidth: 8 } },
          tooltip: { callbacks: { label: function (c) {
            return c.dataset.label + ': ' + (c.parsed.y >= 0 ? '+' : '') + c.parsed.y + '%';
          } } }
        },
        scales: {
          x: { ticks: { color: colors.text, maxRotation: 0, autoSkip: true }, grid: { color: colors.grid } },
          y: { ticks: { color: colors.text, callback: function (v) { return v + '%'; } }, grid: { color: colors.grid } }
        }
      }
    });
  }

  async function init(containerOrSelector, fetchers, opts) {
    var el = typeof containerOrSelector === 'string'
      ? document.querySelector(containerOrSelector) : containerOrSelector;
    if (!el || !fetchers) return;
    opts = opts || {};
    var colMap = opts.columnMap || COLUMN_MAP;
    try {
      var snapshotsRaw = await fetchers.getSnapshots();
      var sd = (snapshotsRaw || []).map(function (s) { return isoDay(s[colMap.snapshotDate]); })
                                   .filter(Boolean).sort();
      var since = sd.length ? minusDays(sd[0], 7) : null;
      var both = await Promise.all([ fetchers.getPicks(), fetchers.getPrices(since) ]);
      var data = normalizeData({ snapshots: snapshotsRaw, picks: both[0], prices: both[1] }, colMap);
      var perf = computePerformance(data.snapshots, data.picks, data.prices, opts);
      await renderPerformance(el, perf, opts);
    } catch (e) {
      el.innerHTML = '<div class="screener-error">Performance unavailable: ' +
        (e && e.message ? e.message : 'unknown error') + '</div>';
      if (global.console) console.error('ScreenerPerformance.init failed:', e);
    }
  }

  var moduleApi = {
    normalizeData: normalizeData, computePerformance: computePerformance, priceAt: priceAt,
    renderPerformance: renderPerformance, init: init,
    COLUMN_MAP: COLUMN_MAP,
    config: { PRICE_LOOKBACK_DAYS: PRICE_LOOKBACK_DAYS, BENCHMARK: BENCHMARK, TARGET_SNAPSHOTS: TARGET_SNAPSHOTS }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = moduleApi;
  global.ScreenerPerformance = moduleApi;

})(typeof window !== 'undefined' ? window : globalThis);
