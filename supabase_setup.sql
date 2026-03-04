-- ============================================================
-- FPL Draft Dashboard — Supabase Table Setup
-- Run this in Supabase SQL Editor (one-time setup)
-- ============================================================

CREATE TABLE IF NOT EXISTS fpl_current_squads (
  id         BIGSERIAL PRIMARY KEY,
  manager_name TEXT NOT NULL,
  team_name    TEXT NOT NULL,
  player_id    INT  NOT NULL,
  player_web_name TEXT,
  player_position TEXT,
  player_team     TEXT,
  total_points    INT DEFAULT 0,
  UNIQUE(manager_name, player_id)
);

CREATE TABLE IF NOT EXISTS fpl_standings (
  id           BIGSERIAL PRIMARY KEY,
  gameweek     INT  NOT NULL,
  manager_name TEXT NOT NULL,
  team_name    TEXT NOT NULL,
  gw_points    INT  DEFAULT 0,
  total_points INT  DEFAULT 0,
  UNIQUE(gameweek, manager_name)
);

CREATE TABLE IF NOT EXISTS fpl_starting_lineups (
  id              BIGSERIAL PRIMARY KEY,
  gameweek        INT  NOT NULL,
  manager_name    TEXT NOT NULL,
  team_name       TEXT NOT NULL,
  player_id       INT,
  player_web_name TEXT,
  player_position TEXT,
  player_team     TEXT,
  lineup_position INT,
  is_starting_11  BOOLEAN DEFAULT false,
  is_bench        BOOLEAN DEFAULT false,
  gw_points       INT DEFAULT 0,
  UNIQUE(gameweek, manager_name, player_id)
);

CREATE TABLE IF NOT EXISTS trade_block (
  id              BIGSERIAL PRIMARY KEY,
  team_name       TEXT NOT NULL,
  manager_name    TEXT NOT NULL,
  player_id       INT  NOT NULL,
  player_web_name TEXT NOT NULL,
  player_position TEXT,
  player_team     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_name, player_id)
);

CREATE TABLE IF NOT EXISTS trade_proposals (
  id                 BIGSERIAL PRIMARY KEY,
  proposing_team     TEXT  NOT NULL,
  receiving_team     TEXT  NOT NULL,
  offering_players   JSONB NOT NULL DEFAULT '[]',
  requesting_players JSONB NOT NULL DEFAULT '[]',
  status             TEXT  DEFAULT 'open',
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fpl_draft_picks (
  id              BIGSERIAL PRIMARY KEY,
  pick_number     INT  NOT NULL,
  round           INT,
  pick_in_round   INT,
  manager_name    TEXT,
  team_name       TEXT,
  player_id       INT,
  player_web_name TEXT,
  player_position TEXT,
  player_team     TEXT,
  total_points    INT DEFAULT 0,
  UNIQUE(pick_number)
);

-- ============================================================
-- Row Level Security — permissive for private league use
-- ============================================================
ALTER TABLE fpl_current_squads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fpl_standings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fpl_starting_lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_block          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_proposals      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fpl_draft_picks      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_all" ON fpl_current_squads   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON fpl_standings        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON fpl_starting_lineups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON trade_block          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON trade_proposals      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON fpl_draft_picks      FOR ALL USING (true) WITH CHECK (true);
