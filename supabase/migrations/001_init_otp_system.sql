-- ============================================================
-- Lovable Tool OTP System - Database Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ADMIN USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'admin' NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_admin_users_email ON admin_users(email);
CREATE INDEX idx_admin_users_is_active ON admin_users(is_active);

-- ============================================================
-- 2. USER ACCOUNTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  device_id VARCHAR(255),
  browser_fingerprint VARCHAR(512),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_user_accounts_email ON user_accounts(email);
CREATE INDEX idx_user_accounts_username ON user_accounts(username);
CREATE INDEX idx_user_accounts_device_id ON user_accounts(device_id);
CREATE INDEX idx_user_accounts_is_active ON user_accounts(is_active);

-- ============================================================
-- 3. OTP CODES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL,
  otp_code VARCHAR(20) UNIQUE NOT NULL,
  otp_format VARCHAR(50) DEFAULT 'alphanumeric' NOT NULL, -- 'numeric', 'alphanumeric', 'mixed'
  otp_length INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  is_used BOOLEAN DEFAULT false,
  is_expired BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  max_usage INTEGER DEFAULT 1,
  created_by_admin VARCHAR(255),
  notes TEXT
);

CREATE INDEX idx_otp_codes_otp_code ON otp_codes(otp_code);
CREATE INDEX idx_otp_codes_admin_id ON otp_codes(admin_id);
CREATE INDEX idx_otp_codes_user_id ON otp_codes(user_id);
CREATE INDEX idx_otp_codes_is_used ON otp_codes(is_used);
CREATE INDEX idx_otp_codes_is_expired ON otp_codes(is_expired);
CREATE INDEX idx_otp_codes_expires_at ON otp_codes(expires_at);

-- ============================================================
-- 4. OTP SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  otp_id UUID NOT NULL REFERENCES otp_codes(id) ON DELETE CASCADE,
  session_token VARCHAR(512) UNIQUE NOT NULL,
  session_hash VARCHAR(512) NOT NULL,
  device_id VARCHAR(255),
  browser_fingerprint VARCHAR(512),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  verified_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_otp_sessions_user_id ON otp_sessions(user_id);
CREATE INDEX idx_otp_sessions_otp_id ON otp_sessions(otp_id);
CREATE INDEX idx_otp_sessions_session_token ON otp_sessions(session_token);
CREATE INDEX idx_otp_sessions_is_active ON otp_sessions(is_active);
CREATE INDEX idx_otp_sessions_expires_at ON otp_sessions(expires_at);

-- ============================================================
-- 5. ACTIVITY LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action_type VARCHAR(100) NOT NULL, -- 'otp_generated', 'otp_verified', 'otp_expired', 'button_click', etc.
  action_status VARCHAR(50) DEFAULT 'success', -- 'success', 'failed', 'expired'
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_admin_id ON activity_logs(admin_id);
CREATE INDEX idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- ============================================================
-- 6. SESSION TOKENS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS session_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  token VARCHAR(512) UNIQUE NOT NULL,
  token_hash VARCHAR(512) NOT NULL,
  device_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  is_valid BOOLEAN DEFAULT true
);

CREATE INDEX idx_session_tokens_user_id ON session_tokens(user_id);
CREATE INDEX idx_session_tokens_token ON session_tokens(token);
CREATE INDEX idx_session_tokens_is_valid ON session_tokens(is_valid);
CREATE INDEX idx_session_tokens_expires_at ON session_tokens(expires_at);

-- ============================================================
-- 7. SECURITY EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(100) NOT NULL, -- 'invalid_otp', 'brute_force', 'suspicious_login', etc.
  severity VARCHAR(50) DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
  user_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);

-- ============================================================
-- 8. ADMIN AUDIT LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  action VARCHAR(255) NOT NULL,
  target_user_id UUID REFERENCES user_accounts(id) ON DELETE SET NULL,
  target_otp_id UUID REFERENCES otp_codes(id) ON DELETE SET NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);

-- ============================================================
-- UPDATE TIMESTAMP TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_admin_users_update
BEFORE UPDATE ON admin_users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_user_accounts_update
BEFORE UPDATE ON user_accounts
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- ============================================================
-- AUTO-EXPIRE OTP CODES TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION auto_expire_otps()
RETURNS void AS $$
BEGIN
  UPDATE otp_codes
  SET is_expired = true
  WHERE expires_at < NOW() AND is_expired = false AND is_used = false;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- REVOKE EXPIRED SESSIONS TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION revoke_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE otp_sessions
  SET is_active = false
  WHERE expires_at < NOW() AND is_active = true;
  
  UPDATE session_tokens
  SET is_valid = false
  WHERE expires_at < NOW() AND is_valid = true;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Admin users can see all data
CREATE POLICY "admin_all_access" ON admin_users
  FOR ALL USING (true) WITH CHECK (true);

-- Users can only see their own data
CREATE POLICY "users_own_data" ON user_accounts
  FOR SELECT USING (true)
  WITH CHECK (true);

-- OTP codes visible to admins and relevant users
CREATE POLICY "otp_admin_access" ON otp_codes
  FOR ALL USING (true) WITH CHECK (true);

-- Sessions visible to users and admins
CREATE POLICY "sessions_user_access" ON otp_sessions
  FOR SELECT USING (true)
  WITH CHECK (true);

-- Activity logs accessible to admins
CREATE POLICY "activity_logs_access" ON activity_logs
  FOR SELECT USING (true)
  WITH CHECK (true);

COMMIT;
