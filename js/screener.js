// =============================================================================
// Screener Mini-Site — displays latest stock-strategy picks from Supabase
// =============================================================================
// Read-only. Picks are produced by a separate Python tool running on the
// laptop and pushed to Supabase Postgres. This module fetches via api.js
// and renders strategy cards + methodology.
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
    this.renderGrid();
    this.renderPerformance();
  }

  async renderPerformance() {
    const el = document.getElementById('screener-performance');
    if (!el || !window.ScreenerPerformance) return;
    await window.ScreenerPerformance.init(el, {
      getSnapshots: ()      => api.getScreenerSnapshots(500),
      getPicks:     ()      => api.getAllScreenerPicks(),
      getPrices:    (since) => api.getAllScreenerPrices(since)
    }, {
      strategyMeta:  Screener.STRATEGY_INFO,   // { buffett: {name, color}, ... }
      strategyOrder: Screener.STRATEGY_ORDER
    });
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
  // Strategy metadata (kept in sync with strategies.py thresholds)
  // ==========================================================================

  static STRATEGY_INFO = {
    buffett: {
      name: 'Warren Buffett',
      subtitle: 'Quality businesses at fair prices',
      color: '#f59e0b',
      summary: 'Durable, profitable companies with strong returns on equity, low debt, consistent margins, and reasonable valuations.',
      criteria: [
        'Market cap ≥ $10B',
        'Return on equity ≥ 15%',
        'Profit margin ≥ 10%',
        'Operating margin ≥ 15%',
        'Debt-to-equity ≤ 1.0',
        'P/E ratio 0–25',
        'FCF yield ≥ 3% (bonus)'
      ]
    },
    lower_risk: {
      name: 'Lower Risk',
      subtitle: 'Strong financials, stable growth',
      color: '#10b981',
      summary: 'Large, established companies with rock-solid balance sheets, consistent earnings, and lower-than-market volatility.',
      criteria: [
        'Market cap ≥ $20B',
        'Debt-to-equity ≤ 0.75',
        'Current ratio ≥ 1.2',
        'Profit margin ≥ 8%',
        'ROE ≥ 10%',
        'Revenue growth ≥ 3%',
        'P/E ratio 0–22',
        'Beta ≤ 1.2 (bonus)'
      ]
    },
    balanced_risk: {
      name: 'Balanced Risk',
      subtitle: 'Quality growth at a fair price',
      color: '#3b82f6',
      summary: 'GARP-style: growth at a reasonable price. Meaningful earnings growth without unsustainable valuations.',
      criteria: [
        'Market cap ≥ $5B',
        'Earnings growth ≥ 10%',
        'Revenue growth ≥ 8%',
        'ROE ≥ 12%',
        'PEG ratio 0–1.5',
        'Debt-to-equity ≤ 1.5',
        'Profit margin ≥ 5% (bonus)'
      ]
    }
  };

  static STRATEGY_ORDER = ['buffett', 'lower_risk', 'balanced_risk'];

  // ==========================================================================
  // Rendering
  // ==========================================================================

  renderShell() {
    return `
      <section class="screener-shell">
        <header class="screener-header">
          <h1>Strategy Screener</h1>
          <p class="muted">
            S&amp;P 500 stocks ranked weekly against three legendary investor strategies.
          </p>
          <div class="screener-meta" id="screener-meta">
            <span class="muted">Loading latest picks…</span>
          </div>
        </header>

        <div id="screener-grid" class="screener-grid">
          <div class="screener-loading">Loading…</div>
        </div>

<h2 class="section-title" style="margin-top:36px">Performance vs S&amp;P 500</h2>
        <div id="screener-performance">
          <div class="screener-placeholder">
            Tracking begins on first weekly snapshot. Performance chart will appear
            here once 2+ weekly snapshots have accumulated.
          </div>
        
        <h2 class="section-title" style="margin-top:36px">Methodology</h2>
        <div class="screener-methodology">
          <p class="muted">
            Fundamentals are pulled weekly from Yahoo Finance via the open-source
            <code>yfinance</code> library. Every S&amp;P 500 stock is evaluated against
            three strategy rule sets. Each strategy assigns a composite score (0–100)
            based on weighted criteria; only stocks passing every required filter are listed.
          </p>
          <p class="muted">
            The screener engine runs locally on my laptop, snapshots are written to
            Supabase Postgres, and this page reads them via the Supabase REST API.
            Auto-refreshes every Sunday at 06:00 local. Top 10 per strategy shown.
          </p>
          <p class="muted">
            <strong>Source code:</strong>
            <a href="https://github.com/shreykv" target="_blank" rel="noopener" style="color:var(--accent)">github.com/shreykv</a>
          </p>
        </div>

        <p class="screener-disclaimer">
          For educational and personal interest only. Not financial advice. Data may be
          delayed, incomplete, or contain errors. Strategy thresholds are interpretations
          of public descriptions and may not match how the named investors actually invest.
        </p>
      </section>
    `;
  }

  renderGrid() {
    const grid = document.getElementById('screener-grid');
    const metaEl = document.getElementById('screener-meta');
    if (!grid) return;

    if (this.error) {
      grid.innerHTML = `<div class="screener-error">⚠️ ${this.error}</div>`;
      metaEl.innerHTML = '<span class="muted">Unable to fetch latest snapshot.</span>';
      return;
    }

    const picks = this.latest || [];
    if (picks.length === 0) {
      grid.innerHTML = `
        <div class="screener-empty">
          No snapshot available yet — the first weekly refresh hasn't run.
          Check back after Sunday's update.
        </div>
      `;
      metaEl.innerHTML = '<span class="muted">No data yet</span>';
      return;
    }

    // Group by strategy
    const byStrategy = {};
    for (const p of picks) {
      (byStrategy[p.strategyKey] ||= []).push(p);
    }

    // Meta line — last update from any pick (all share snapshot timestamp)
    const ts = picks[0].snapshotCreatedAt;
    const dt = new Date(ts);
    metaEl.innerHTML = `
      <span><strong>Last update:</strong> ${this.formatDate(dt)}</span>
      <span class="muted">·</span>
      <span><strong>Universe:</strong> S&amp;P 500</span>
      <span class="muted">·</span>
      <span><strong>Cadence:</strong> Weekly</span>
    `;

    grid.innerHTML = Screener.STRATEGY_ORDER.map(key => this.renderCard(key, byStrategy[key] || [])).join('');
  }

  renderCard(key, picks) {
    const info = Screener.STRATEGY_INFO[key];
    if (!info) return '';

    const rows = picks.length
      ? picks.map(p => `
          <li class="screener-pick-row">
            <span class="screener-rank">${p.rank}</span>
            <span class="screener-pick-info">
              <span class="screener-ticker">${this.escape(p.ticker)}</span>
              <span class="screener-name">${this.escape(p.name || '')}</span>
            </span>
            <span class="screener-score">${p.score != null ? p.score.toFixed(1) : '—'}</span>
          </li>
        `).join('')
      : `<li class="screener-pick-row"><span></span><span class="screener-name muted">No stocks currently pass.</span><span></span></li>`;

    const criteriaHtml = info.criteria.map(c => `<li>${c}</li>`).join('');

    return `
      <section class="screener-card" style="border-left-color:${info.color}">
        <header>
          <h2>${info.name}</h2>
          <p class="muted">${info.subtitle}</p>
        </header>
        <p class="screener-card-summary">${info.summary}</p>
        <details class="screener-criteria">
          <summary>View criteria</summary>
          <ul>${criteriaHtml}</ul>
        </details>
        <ul class="screener-pick-list">${rows}</ul>
      </section>
    `;
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  formatDate(d) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  escape(str) {
    // Tiny defensive escape — picks come from a controlled source, but
    // never trust string-into-HTML even for that.
    return String(str ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
}

// Export module instance (matches the gymLog / tournament / counter pattern)
const screener = new Screener();
