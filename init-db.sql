-- Create discourse database and user
CREATE DATABASE discourse_db;
CREATE USER discourse_user WITH ENCRYPTED PASSWORD 'discourse_password_2024';
GRANT ALL PRIVILEGES ON DATABASE discourse_db TO discourse_user;

-- Switch to discourse database to set up SSO tables
\c discourse_db;

-- Grant additional permissions needed by Discourse
GRANT CREATE ON SCHEMA public TO discourse_user;
GRANT USAGE ON SCHEMA public TO discourse_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO discourse_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO discourse_user;

-- Switch back to main database for shared authentication tables
\c price_db;

-- Create shared authentication tables for SSO integration
CREATE TABLE IF NOT EXISTS shared_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    discourse_user_id INTEGER,
    role VARCHAR(50) DEFAULT 'user',
    bio TEXT,
    location VARCHAR(255),
    website VARCHAR(255),
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create shared sessions table for cross-application authentication
CREATE TABLE IF NOT EXISTS shared_sessions (
    sid VARCHAR(255) PRIMARY KEY,
    session_data TEXT,
    expires TIMESTAMP,
    user_id INTEGER REFERENCES shared_users(id) ON DELETE CASCADE
);

-- Create SSO tokens table for secure authentication flow
CREATE TABLE IF NOT EXISTS sso_tokens (
    id SERIAL PRIMARY KEY,
    token VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES shared_users(id) ON DELETE CASCADE,
    nonce VARCHAR(255) NOT NULL,
    return_url VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes')
);

-- Create discourse user mapping for synchronization
CREATE TABLE IF NOT EXISTS discourse_user_mapping (
    id SERIAL PRIMARY KEY,
    price_app_user_id INTEGER REFERENCES shared_users(id) ON DELETE CASCADE,
    discourse_user_id INTEGER NOT NULL,
    discourse_username VARCHAR(255) NOT NULL,
    last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(price_app_user_id),
    UNIQUE(discourse_user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shared_sessions_user_id ON shared_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_sessions_expires ON shared_sessions(expires);
CREATE INDEX IF NOT EXISTS idx_sso_tokens_token ON sso_tokens(token);
CREATE INDEX IF NOT EXISTS idx_sso_tokens_expires ON sso_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_discourse_mapping_price_user ON discourse_user_mapping(price_app_user_id);
CREATE INDEX IF NOT EXISTS idx_discourse_mapping_discourse_user ON discourse_user_mapping(discourse_user_id);

-- Insert default admin user
-- SECURITY: Default admin account with a strong randomly generated password
-- IMPORTANT: Change this password immediately after first login!
-- The default password will be logged during database initialization
-- Run this SQL separately with a secure password:
-- INSERT INTO shared_users (username, email, password_hash, role)
-- VALUES ('admin', 'admin@pricecompare.com', 'YOUR_BCRYPT_HASH_HERE', 'admin')
-- ON CONFLICT (email) DO NOTHING;

-- Removed hardcoded default admin credentials for security
-- First user to register will automatically become admin (see routes.ts line 82-89)

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for shared_users table
CREATE TRIGGER update_shared_users_updated_at BEFORE UPDATE ON shared_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;