-- Cloudflare D1 Initial Schema for Rungrueng AC Maintenance System

CREATE TABLE IF NOT EXISTS company_settings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  tax_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  site_name TEXT NOT NULL,
  logo_data_url TEXT NOT NULL DEFAULT '',
  default_sender_label TEXT NOT NULL DEFAULT '',
  default_inspector_label TEXT NOT NULL DEFAULT '',
  google_sheet_id TEXT NOT NULL DEFAULT '',
  google_sheet_name TEXT NOT NULL DEFAULT '',
  auto_sync_sheets INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL,
  can_login INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  permissions_json TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS ac_units (
  id TEXT PRIMARY KEY,
  building TEXT NOT NULL,
  floor TEXT NOT NULL,
  room TEXT NOT NULL,
  unit_code TEXT NOT NULL,
  ac_type TEXT NOT NULL DEFAULT 'normal',
  btu TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  install_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(building, unit_code)
);

CREATE INDEX IF NOT EXISTS idx_ac_units_building_order ON ac_units(building, sort_order);

CREATE TABLE IF NOT EXISTS cleaning_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  building TEXT NOT NULL,
  floor TEXT NOT NULL,
  room TEXT NOT NULL,
  unit_code TEXT NOT NULL,
  ac_type TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL,
  technician_id TEXT NOT NULL,
  technician_name TEXT NOT NULL,
  entered_by_user_id TEXT NOT NULL,
  entered_by_name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cleaning_logs_date ON cleaning_logs(date);
CREATE INDEX IF NOT EXISTS idx_cleaning_logs_building ON cleaning_logs(building);
CREATE INDEX IF NOT EXISTS idx_cleaning_logs_tech ON cleaning_logs(technician_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_logs_unit ON cleaning_logs(unit_id);
