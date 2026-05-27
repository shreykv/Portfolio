/* =============================================================================
 * screener-performance.js
 * "Performance vs S&P 500" chart for the screener mini-site.
 *
 * Renders INLINE into the existing "Performance vs S&P 500" section of
 * screener.js (no new route). Reads via the existing api.js (anon key,
 * read-only RLS) and matches the site's camelCase + CSS-variable conventions.
 *
 * TESTED, framework-independent core:
 *   normalizeData()      - reshape api.js rows into engine inputs
 *   computePerformance() - equal-weight, rebalanced-at-each-snapshot cumulative
 *                          return per strategy vs the SPY benchmark
 *
 * Scaffolding-phase design (matches the project handoff):
 *   - Curve points are anchored at SNAPSHOT DATES. The only unambiguous
 *     resolution with sparse data; daily-resolution valuation is a later
 *     upgrade (the price data to support it is already being collected).
 *   - <2 snapshots, or no priced period yet -> honest "collecting data (N/8)"
 *     state instead of a misleading flat line.
 *   - A pick missing a price at a period endpoint is dropped from THAT period's
 *     average (and recorded in coverage), never treated as a 0% return.
 *   - Weekend/holiday snapshot dates fall back to the latest trading day on or
 *     before the date (within PRICE_LOOKBACK_DAYS).
 * ============================================================================= */

(function (global) {
  'use strict';

  var PRICE_LOOKBACK_DAYS = 5;
  var BENCHMARK = 'SPY';
  var TARGET_SNAPSHOTS = 8;

  /* COLUMN MAP — keys here are the camelCase field names api.js produces via
   * toCamelCase(), confirmed against screener_schema.sql. The only non-obvious
   * one is pickStrategy: the column is `strategy_key` -> `strategyKey`. */
  var COLUMN_MAP = {
    snapshotId:     'id',
    snapshotDate:   'createdAt',     // screener_snapshots.created_at (TIMESTAMPTZ)
    pickSnapshotId: 'snapshotId',    // screener_picks.snapshot_id
    pickStrategy:   'strategyKey',   // screener_picks.strategy_key
    pickTicker:     'ticker',
    priceTicker:    'ticker',
    priceDate:      'date',          // screener_prices.date (DATE)
    priceClose:     'close'
  };

  // --- date helpers (ISO 'YYYY-MM-DD'; string compare == chronological) ------
  function isoDay(v) {
    if (v == null) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v).slice(0, 10);
  }
  function daysBetween(isoA, isoB) {
    var a = new Date(isoA + 'T00:00:00Z').getTime();
    var b = new Date(isoB + 'T00:00:00Z').getTime();
    return Math.round((a - b) / 86400000);
  }
  function minusDays(iso, n) {
    var t = new Date(iso + 'T00:00:00Z').getTime() - n * 86400000;
    return new Date(t).toISOString().slice(0, 10);
  }

  /* ---------------------------------------------------------------------------
   * normalizeData — reshape rows into { snapshots, picks, prices }. Pure.
   * ------------------------------------------------------------------------- */
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

  // latest close on or before `date`, within PRICE_LOOKBACK_DAYS
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
   * computePerformance — chained equal-weight returns vs benchmark.
   * Returns cumulative DECIMALS (0.1 == +10%); ×100 at render.
   * ------------------------------------------------------------------------- */
  function computePerformance(snapshots, picks, prices, opts) {
    opts = opts || {};
    var benchTicker = opts.benchmark || BENCHMARK;
    var cache = {};
    var coverage = {
      snapshotCount: snapshots.length,
      dateRange: snapshots.length
        ? { start: snapshots[0].date, end: snapshots[snapshots.length - 1].date } : null,
      periods: [], notes: []
    };

    if (snapshots.length < 2) {
      return { ready: false, dates: snapshots.map(function (s) { return s.date; }),
               strategies: [], series: {}, benchmark: [], benchmarkTicker: benchTicker, coverage: coverage };
    }

    var bySnap = {}, strategySet = {};
    picks.forEach(function (p) {
      strategySet[p.strategy] = true;
      var s = bySnap[p.snapshotId] || (bySnap[p.snapshotId] = {});
      (s[p.strategy] || (s[p.strategy] = [])).push(p.ticker);
    });
    var strategies = Object.keys(strategySet).sort();

    var dates = snapshots.map(function (s) { return s.date; });
    var cumFactor = {}, series = {};
    strategies.forEach(function (st) { cumFactor[st] = 1; series[st] = [0]; });
    var benchFactor = 1, benchmark = [0];

    for (var i = 0; i < snapshots.length - 1; i++) {
      var di = snapshots[i].date, dj = snapshots[i + 1].date;
      var held = bySnap[snapshots[i].id] || {};
      var periodInfo = { from: di, to: dj, strategies: {}, benchmark: null };

      strategies.forEach(function (st) {
        var tickers = held[st] || [], rets = [], missing = 0;
        tickers.forEach(function (tk) {
          var p0 = priceAt(prices, cache, tk, di), p1 = priceAt(prices, cache, tk, dj);
          if (p0 != null && p1 != null && p0 > 0) rets.push(p1 / p0 - 1);
          else missing++;
        });
        if (rets.length) {
          var r = rets.reduce(function (a, b) { return a + b; }, 0) / rets.length;
          cumFactor[st] *= (1 + r);
          periodInfo.strategies[st] = { ret: r, used: rets.length, missing: missing };
        } else {
          periodInfo.strategies[st] = { ret: null, used: 0, missing: missing };
          if (tickers.length) coverage.notes.push(st + ': no priced picks for ' + di + '\u2192' + dj + ' (held flat)');
        }
        series[st].push(cumFactor[st] - 1);
      });

      var b0 = priceAt(prices, cache, benchTicker, di), b1 = priceAt(prices, cache, benchTicker, dj);
      if (b0 != null && b1 != null && b0 > 0) { var br = b1 / b0 - 1; benchFactor *= (1 + br); periodInfo.benchmark = br; }
      else coverage.notes.push(benchTicker + ': missing price for ' + di + '\u2192' + dj + ' (held flat)');
      benchmark.push(benchFactor - 1);
      coverage.periods.push(periodInfo);
    }

    var hasSignal = coverage.periods.some(function (per) {
      return Object.keys(per.strategies).some(function (k) { return per.strategies[k].ret != null; });
    });

    return { ready: hasSignal, dates: dates, strategies: strategies, series: series,
             benchmark: benchmark, benchmarkTicker: benchTicker, coverage: coverage };
  }

  /* =========================================================================
   * Browser integration (render + fetch glue)
   * ========================================================================= */

  function readColors(el) {
    var cs = getComputedStyle(el);
    function v(name, fb) { var x = cs.getPropertyValue(name).trim(); return x || fb; }
    return {
      benchmark: v('--muted2', '#9aa0a6'),
      grid:      v('--border', 'rgba(255,255,255,0.10)'),
      text:      v('--text', '#e8e8e8'),
      // fallback palette; per-strategy colors normally come from strategyMeta
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
        ' / ' + TARGET_SNAPSHOTS + '</strong>. The chart appears automatically once at ' +
        'least two snapshots exist, and sharpens with each weekly refresh.' +
      '</div>';
  }

  function strategyDisplayOrder(perf, opts) {
    var order = (opts && opts.strategyOrder ? opts.strategyOrder.slice() : []).filter(function (k) {
      return perf.strategies.indexOf(k) !== -1;
    });
    perf.strategies.forEach(function (s) { if (order.indexOf(s) === -1) order.push(s); });
    return order;
  }

  async function renderPerformance(container, perf, opts) {
    opts = opts || {};
    if (!perf.ready) return renderEmptyState(container, perf);

    var colors = readColors(container);
    var meta = opts.strategyMeta || {};
    container.innerHTML =
      '<div class="screener-perf">' +
        '<p class="screener-perf__range">' +
          perf.coverage.dateRange.start + ' \u2192 ' + perf.coverage.dateRange.end +
          ' \u00b7 ' + perf.coverage.snapshotCount + ' snapshots \u00b7 equal-weight, rebalanced weekly' +
        '</p>' +
        '<div class="screener-perf__chart"><canvas></canvas></div>' +
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

    var order = strategyDisplayOrder(perf, opts);
    var datasets = order.map(function (st, i) {
      return {
        label: (meta[st] && meta[st].name) || st,
        data: perf.series[st].map(function (v) { return +(v * 100).toFixed(2); }),
        borderColor: (meta[st] && meta[st].color) || colors.palette[i % colors.palette.length],
        backgroundColor: 'transparent', tension: 0.2, pointRadius: 3, borderWidth: 2
      };
    });
    datasets.push({
      label: perf.benchmarkTicker,
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

  /* ---------------------------------------------------------------------------
   * init — entry point called from screener.js.
   * `fetchers` = { getSnapshots(): rows, getPicks(): rows, getPrices(since): rows }
   * (wire these to api.js — see screener-integration.md).
   * `opts`     = { strategyMeta, strategyOrder, columnMap?, benchmark? }
   * ------------------------------------------------------------------------- */
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
  if (typeof module !== 'undefined' && module.exports) module.exports = moduleApi;  // node/tests
  global.ScreenerPerformance = moduleApi;                                           // browser global

})(typeof window !== 'undefined' ? window : globalThis);
