// =============================================================================
// Screener Mini-Site — strategy picks rendered as per-strategy tables.
// =============================================================================
// Each strategy gets its own full-width section with: header + summary,
// expandable criteria thresholds, and a rich table whose COLUMNS are driven
// by that strategy's criteria definitions (so Value Investing shows P/E + P/B
// + ROE + ..., Lower Risk shows growth windows + PEG, etc.).
// Reads via api.js (anon key, read-only RLS). Performance chart is rendered
// by the separate screener-performance.js module.
// =============================================================================

class Screener {
  constructor() {
    this.latest = null;
    this.error = null;
  }

  async init() {
    const container = document.getElementById('screener-content');
    if (!container) return;

    container.innerHTML = this.renderShell();
    await this.loadLatest();
    this.renderStrategies();
    await this.renderPerformance();
  }

  async loadLatest() {
    try {
      this.latest = await api.getLatestScreenerPicks();
      this.error = null;
    } catch (err) {
      console.error('Screener load failed:', err);
      this.latest = [];
      this.error = err.message || 'Failed to load picks.';
    }
  }

  // ==========================================================================
  // Strategy metadata — must stay in sync with strategies.py.
  // `criteria[].field` is the camelCase column name api.js produces.
  // `format`: 'pct' → x*100 + %; 'ratio' → 2 decimals; 'currency-b' → $X.XXB/M.
  // ==========================================================================

  static STRATEGY_INFO = {
    buffett: {
      name: 'Value Investing',
      subtitle: 'Underpriced companies with solid fundamentals',
      color: '#f59e0b',
      summary:
        'Seeks stocks that appear underpriced by the market. Solid fundamentals — ' +
        'low P/E, strong returns on equity, a healthy balance sheet, and a positive ' +
        'dividend — bought at a discount and held for the long term.',
      criteria: [
        { field: 'peRatio',         label: 'P/E',            description: 'P/E ratio 0–25',            format: 'ratio'      },
        { field: 'priceToBook',     label: 'P/B',            description: 'P/B ratio 0–5',             format: 'ratio'      },
        { field: 'roe',             label: 'ROE',            description: 'ROE > 20%',                 format: 'pct'        },
        { field: 'debtToEquity',    label: 'D/E',            description: 'Debt-to-equity 0–0.5',      format: 'ratio'      },
        { field: 'freeCashFlow',    label: 'FCF (TTM)',      description: 'Free cash flow > 0',        format: 'currency-b' },
        { field: 'dividendYield',   label: 'Div Yield',      description: 'Dividend yield > 0',        format: 'pct'        },
        { field: 'revenueGrowth5y', label: 'Rev Growth 5Y',  description: 'Revenue growth (5Y) > 20%', format: 'pct'        },
      ],
    },
    lower_risk: {
      name: 'Lower Risk',
      subtitle: 'Consistent growers with strong balance sheets',
      color: '#10b981',
      summary:
        'Established companies with strong financial fundamentals trading at a low ' +
        'price relative to expected growth. Excludes Financial Services, Basic ' +
        'Materials, Energy, Utilities, and Real Estate.',
      criteria: [
        { field: 'revenueGrowth5y',  label: 'Rev Growth 5Y', description: 'Revenue growth (5Y) > 50%',  format: 'pct'        },
        { field: 'revenueGrowth1y',  label: 'Rev Growth 1Y', description: 'Revenue growth (1Y TTM) > 5%', format: 'pct'      },
        { field: 'earningsGrowth1y', label: 'EPS Growth 1Y', description: 'Earnings growth (1Y TTM) > 5%', format: 'pct'     },
        { field: 'roe',              label: 'ROE',           description: 'ROE > 15%',                  format: 'pct'        },
        { field: 'debtToEquity',     label: 'D/E',           description: 'Debt-to-equity 0–1.0',       format: 'ratio'      },
        { field: 'freeCashFlow',     label: 'FCF (TTM)',     description: 'Free cash flow > 0',         format: 'currency-b' },
        { field: 'pegRatio',         label: 'PEG',           description: 'PEG (5Y) 0–1.0',             format: 'ratio'      },
      ],
    },
    balanced_risk: {
      name: 'Balanced Risk',
      subtitle: 'Quality growth at a fair-to-low price',
      color: '#3b82f6',
      summary:
        'GARP-style — growth at a reasonable price. Consistent growers trading at ' +
        'fair valuations relative to expected growth. Excludes Financial Services, ' +
        'Basic Materials, Energy, Utilities, and Real Estate.',
      criteria: [
        { field: 'revenueGrowth5y',  label: 'Rev Growth 5Y', description: 'Revenue growth (5Y) > 50%',  format: 'pct'        },
        { field: 'revenueGrowth1y',  label: 'Rev Growth 1Y', description: 'Revenue growth (1Y TTM) > 5%', format: 'pct'      },
        { field: 'earningsGrowth5y', label: 'EPS Growth 5Y', description: 'Earnings growth (5Y) > 10%', format: 'pct'        },
        { field: 'roe',              label: 'ROE',           description: 'ROE > 15%',                  format: 'pct'        },
        { field: 'debtToEquity',     label: 'D/E',           description: 'Debt-to-equity 0–1.0',       format: 'ratio'      },
        { field: 'freeCashFlow',     label: 'FCF (TTM)',     description: 'Free cash flow > 0',         format: 'currency-b' },
        { field: 'pegRatio',         label: 'PEG',           description: 'PEG (5Y) 0–2.0',             format: 'ratio'      },
      ],
    },
  };

  static STRATEGY_ORDER = ['buffett', 'lower_risk', 'balanced_risk'];

  // ==========================================================================
  // Rendering
  // ==========================================================================

  renderShell() {
    return `
      <section class="screener-shell">
        <header class="screener-header">
          <h1>📈 Strategy Screener</h1>
          <p class="muted">
            S&amp;P 500 stocks ranked weekly against three legendary investor strategies.
          </p>
          <div class="screener-meta" id="screener-meta">
            <span class="muted">Loading latest picks…</span>
          </div>
        </header>

        <div id="screener-strategies">
          <div class="screener-loading">Loading…</div>
        </div>

        <h2 class="section-title" style="margin-top:36px">Performance vs S&amp;P 500</h2>
        <div id="screener-performance">
          <div class="screener-placeholder">
            📊 Tracking begins on first weekly snapshot. Performance chart will appear
            here once 2+ weekly snapshots have accumulated.
          </div>
        </div>

        <h2 class="section-title" style="margin-top:36px">Methodology</h2>
        <div class="screener-methodology">
          <p class="muted">
            Fundamentals are pulled weekly from Yahoo Finance via the open-source
            <code>yfinance</code> library. Every S&amp;P 500 stock is evaluated against
            each strategy's criteria. A stock is listed if it clears every criterion's
            <strong>minimum</strong>; its <strong>X/N badge</strong> counts how many it
            also clears at the stricter <strong>ideal</strong> threshold. Up to 20 picks
            per strategy are shown.
          </p>
          <p class="muted">
            The screener engine runs locally on my laptop; snapshots are written to
            Supabase Postgres, and this page reads them via the Supabase REST API.
            Auto-refreshes weekly. Source code:
            <a href="https://github.com/shreykv" target="_blank" rel="noopener" style="color:var(--accent)">github.com/shreykv</a>.
          </p>
        </div>

        <p class="screener-disclaimer">
          For educational and personal interest only. Not financial advice. Data may be
          delayed, incomplete, or contain errors. Multi-year (5Y) growth figures are
          approximated from the ~4 years of annual statements available via yfinance, so
          they may understate or overstate true 5-year growth. Strategy thresholds are
          interpretations of public descriptions and may not match how the named investors
          actually invest.
        </p>
      </section>
    `;
  }

  renderStrategies() {
    const container = document.getElementById('screener-strategies');
    const metaEl = document.getElementById('screener-meta');
    if (!container) return;

    if (this.error) {
      container.innerHTML = `<div class="screener-error">⚠️ ${this.escape(this.error)}</div>`;
      metaEl.innerHTML = '<span class="muted">Unable to fetch latest snapshot.</span>';
      return;
    }

    const picks = this.latest || [];
    if (picks.length === 0) {
      container.innerHTML = `
        <div class="screener-empty">
          No snapshot available yet — the first weekly refresh hasn't run.
          Check back after the next Sunday update.
        </div>
      `;
      metaEl.innerHTML = '<span class="muted">No data yet</span>';
      return;
    }

    // Group by strategy and sort each group by rank ascending
    const byStrategy = {};
    for (const p of picks) {
      (byStrategy[p.strategyKey] ||= []).push(p);
    }
    for (const k of Object.keys(byStrategy)) {
      byStrategy[k].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    }

    // Meta strip
    const ts = picks[0].snapshotCreatedAt;
    const dt = new Date(ts);
    metaEl.innerHTML = `
      <span><strong>Last update:</strong> ${this.formatDate(dt)}</span>
      <span class="muted">·</span>
      <span><strong>Universe:</strong> S&amp;P 500</span>
      <span class="muted">·</span>
      <span><strong>Cadence:</strong> Weekly</span>
    `;

    container.innerHTML = Screener.STRATEGY_ORDER
      .map(key => this.renderStrategySection(key, byStrategy[key] || []))
      .join('');
  }

  renderStrategySection(key, picks) {
    const info = Screener.STRATEGY_INFO[key];
    if (!info) return '';

    const baselinesHtml = info.criteria
      .map(c => `<li>${this.escape(c.description)}</li>`)
      .join('');

    const body = picks.length
      ? this.renderPicksTable(info, picks)
      : `<p class="screener-strategy__empty">No stocks currently pass the minimum criteria.</p>`;

    const countLine = picks.length
      ? `<div class="screener-strategy__count">${picks.length} stock${picks.length === 1 ? '' : 's'} meeting minimum criteria</div>`
      : '';

    return `
      <section class="screener-strategy" style="--st-color: ${info.color}">
        <header class="screener-strategy__header">
          <h2 class="screener-strategy__name">${this.escape(info.name)}</h2>
          <p class="screener-strategy__subtitle muted">${this.escape(info.subtitle)}</p>
          <p class="screener-strategy__summary">${this.escape(info.summary)}</p>
          <details class="screener-strategy__criteria">
            <summary>View criteria thresholds</summary>
            <ul>${baselinesHtml}</ul>
          </details>
          ${countLine}
        </header>
        ${body}
      </section>
    `;
  }

  renderPicksTable(info, picks) {
    const metricHeaders = info.criteria
      .map(c => `<th class="screener-table__metric">${this.escape(c.label)}</th>`)
      .join('');

    const rowsHtml = picks.map((p, i) => {
      const met = p.criteriaMet, total = p.criteriaTotal;
      const hasBadge = (met != null && total != null);
      const badgeFull = hasBadge && met === total;
      const badgeClass = `screener-badge${badgeFull ? ' screener-badge--full' : ''}`;
      const badgeText = hasBadge ? `${met}/${total}` : '—';

      const metricCells = info.criteria.map(c => {
        const v = p[c.field];
        return `<td class="screener-table__metric">${this.fmtMetric(v, c.format)}</td>`;
      }).join('');

      return `
        <tr>
          <td class="screener-table__rank">${p.rank ?? (i + 1)}</td>
          <td class="screener-table__ticker">${this.escape(p.ticker)}</td>
          <td class="screener-table__name">${this.escape(p.name || '')}</td>
          <td class="screener-table__sector">${this.escape(p.sector || '—')}</td>
          <td class="screener-table__badge"><span class="${badgeClass}">${badgeText}</span></td>
          ${metricCells}
        </tr>
      `;
    }).join('');

    return `
      <div class="screener-table-wrap">
        <table class="screener-table">
          <thead>
            <tr>
              <th class="screener-table__rank">#</th>
              <th class="screener-table__ticker">Ticker</th>
              <th class="screener-table__name">Name</th>
              <th class="screener-table__sector">Sector</th>
              <th class="screener-table__badge">Criteria</th>
              ${metricHeaders}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  // ==========================================================================
  // Performance chart — delegated to screener-performance.js
  // ==========================================================================

  async renderPerformance() {
    const el = document.getElementById('screener-performance');
    if (!el || !window.ScreenerPerformance) return;
    await window.ScreenerPerformance.init(el, {
      getSnapshots: ()      => api.getScreenerSnapshots(500),
      getPicks:     ()      => api.getAllScreenerPicks(),
      getPrices:    (since) => api.getAllScreenerPrices(since),
    }, {
      strategyMeta:  Screener.STRATEGY_INFO,
      strategyOrder: Screener.STRATEGY_ORDER,
    });
  }

  // ==========================================================================
  // Formatters & helpers
  // ==========================================================================

  fmtMetric(value, format) {
    if (value == null || (typeof value === 'number' && !isFinite(value))) {
      return '<span class="muted">—</span>';
    }
    const v = Number(value);
    if (!isFinite(v)) return '<span class="muted">—</span>';

    switch (format) {
      case 'pct':
        return (v * 100).toFixed(1) + '%';
      case 'ratio':
        return v.toFixed(2);
      case 'ratio1':
        return v.toFixed(1);
      case 'currency-b': {
        const abs = Math.abs(v);
        const sign = v < 0 ? '-' : '';
        if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
        if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
        return `${sign}$${abs.toLocaleString()}`;
      }
      default:
        return String(value);
    }
  }

  formatDate(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  escape(str) {
    return String(str ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
}

// Export module instance (matches the gymLog / tournament / counter pattern)
const screener = new Screener();
