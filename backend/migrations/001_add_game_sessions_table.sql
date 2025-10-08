-- Migration: Add game_sessions table for AuthServer
-- Description: Creates table to track temporary game session tokens for Minecraft authentication
-- Author: Copilot
-- Date: 2025-01-16

-- Create game_sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    access_token VARCHAR(512) NOT NULL UNIQUE,
    client_token VARCHAR(512),
    profile_name VARCHAR(16) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_game_sessions_user
        FOREIGN KEY (user_id) 
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_access_token ON game_sessions(access_token);
CREATE INDEX IF NOT EXISTS idx_game_sessions_expires_at ON game_sessions(expires_at);

-- Add comments for documentation
COMMENT ON TABLE game_sessions IS 'Stores temporary game session tokens for Minecraft authentication via authlib-injector';
COMMENT ON COLUMN game_sessions.id IS 'Unique session identifier';
COMMENT ON COLUMN game_sessions.user_id IS 'Reference to the ModpackStore user';
COMMENT ON COLUMN game_sessions.access_token IS 'Temporary game access token (20 min TTL)';
COMMENT ON COLUMN game_sessions.client_token IS 'Optional client token for session tracking';
COMMENT ON COLUMN game_sessions.profile_name IS 'Minecraft username (3-16 chars, alphanumeric + underscore)';
COMMENT ON COLUMN game_sessions.expires_at IS 'Session expiration timestamp';
COMMENT ON COLUMN game_sessions.last_activity_at IS 'Last session activity for automatic expiration';

-- Create function to cleanup expired sessions (optional, for periodic cleanup)
CREATE OR REPLACE FUNCTION cleanup_expired_game_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM game_sessions
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_game_sessions() IS 'Removes expired game sessions and returns count of deleted rows';

-- Optional: Create a scheduled job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-game-sessions', '*/5 * * * *', 'SELECT cleanup_expired_game_sessions();');
