-- =============================================================================
-- 8. STOCK SCREENER TABLES (public read-only)
-- =============================================================================
-- Unlike the user-owned mini-site tables above, screener data is pushed from
-- a separate Python tool running on Shrey's laptop, and is publicly viewable
-- by all portfolio site visitors. So:
--   - no user_id column
--   - public-read RLS (USING (true)) for SELECT
--   - no INSERT/UPDATE/DELETE policies for anon (writes only via service_role)
-- =============================================================================

CREATE TABLE IF NOT EXISTS screener_snapshots (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ticker_count INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_screener_snapshots_created
  ON screener_snapshots (created_at DESC);

-- Denormalized picks: fundamentals inlined so the site renders a pick card
-- from a single row without joining the full snapshot data.
CREATE TABLE IF NOT EXISTS screener_picks (
  snapshot_id BIGINT NOT NULL REFERENCES screener_snapshots(id) ON DELETE CASCADE,
  strategy_key TEXT NOT NULL,
  strategy_name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score REAL,
  name TEXT,
  sector TEXT,
  industry TEXT,
  price REAL,
  market_cap NUMERIC,
  pe_ratio REAL,
  peg_ratio REAL,
  roe REAL,
  profit_margin REAL,
  revenue_growth REAL,
  earnings_growth REAL,
  debt_to_equity REAL,
  beta REAL,
  dividend_yield REAL,
  PRIMARY KEY (snapshot_id, strategy_key, ticker)
);

CREATE INDEX IF NOT EXISTS idx_screener_picks_strategy
  ON screener_picks (strategy_key, snapshot_id);

-- Daily close prices for picked tickers + SPY benchmark. Accumulates over
-- time for the future performance-vs-SPY chart.
CREATE TABLE IF NOT EXISTS screener_prices (
  ticker TEXT NOT NULL,
  date DATE NOT NULL,
  close REAL NOT NULL,
  volume NUMERIC,
  PRIMARY KEY (ticker, date)
);

CREATE INDEX IF NOT EXISTS idx_screener_prices_ticker_date
  ON screener_prices (ticker, date DESC);

-- View: always returns picks from the most recent snapshot.
-- The site queries this so it doesn't need to know snapshot IDs.
CREATE OR REPLACE VIEW screener_latest_picks AS
SELECT
  p.*,
  s.created_at AS snapshot_created_at
FROM screener_picks p
JOIN screener_snapshots s ON s.id = p.snapshot_id
WHERE s.id = (SELECT id FROM screener_snapshots ORDER BY created_at DESC LIMIT 1)
ORDER BY p.strategy_key, p.rank;

-- =============================================================================
-- SCREENER RLS POLICIES (public-read, no public-write)
-- =============================================================================
ALTER TABLE screener_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE screener_picks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE screener_prices    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read screener_snapshots" ON screener_snapshots;
CREATE POLICY "Public read screener_snapshots"
  ON screener_snapshots FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public read screener_picks" ON screener_picks;
CREATE POLICY "Public read screener_picks"
  ON screener_picks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public read screener_prices" ON screener_prices;
CREATE POLICY "Public read screener_prices"
  ON screener_prices FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies for anon role.
-- Writes happen only via the Python publisher using the service_role key,
-- which bypasses RLS.
