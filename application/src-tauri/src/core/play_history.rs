use chrono::Utc;
use dirs::config_dir;
use once_cell::sync::Lazy;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecentInstance {
    pub instance_id: String,
    pub last_played_at: i64,
    pub play_count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaySession {
    pub id: Option<i64>,
    pub instance_id: String,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub duration: Option<i64>,
    pub version: Option<String>,
}

pub struct PlayHistoryManager {
    db_path: PathBuf,
    conn: Mutex<Connection>,
}

static MANAGER: Lazy<PlayHistoryManager> = Lazy::new(|| {
    let config_path = config_dir()
        .expect("Failed to get config directory")
        .join("dev.alexitoo.modpackstore");

    if !config_path.exists() {
        fs::create_dir_all(&config_path).expect("Failed to create config directory");
    }

    let db_path = config_path.join("play_history.db");
    let conn = Connection::open(&db_path).expect("Failed to open database");

    // Initialize tables
    conn.execute(
        "CREATE TABLE IF NOT EXISTS recent_instances (
            instance_id TEXT PRIMARY KEY,
            last_played_at INTEGER NOT NULL,
            play_count INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )
    .expect("Failed to create recent_instances table");

    conn.execute(
        "CREATE TABLE IF NOT EXISTS play_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            instance_id TEXT NOT NULL,
            started_at INTEGER NOT NULL,
            ended_at INTEGER,
            duration INTEGER,
            version TEXT
        )",
        [],
    )
    .expect("Failed to create play_sessions table");

    PlayHistoryManager {
        db_path,
        conn: Mutex::new(conn),
    }
});

impl PlayHistoryManager {
    pub fn get_instance() -> &'static Self {
        &MANAGER
    }

    pub fn record_session_start(&self, instance_id: &str, version: Option<String>) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp();

        // Update recent instances
        conn.execute(
            "INSERT INTO recent_instances (instance_id, last_played_at, play_count)
             VALUES (?1, ?2, 1)
             ON CONFLICT(instance_id) DO UPDATE SET
             last_played_at = excluded.last_played_at,
             play_count = play_count + 1",
            params![instance_id, now],
        )?;

        // Create new session
        conn.execute(
            "INSERT INTO play_sessions (instance_id, started_at, version)
             VALUES (?1, ?2, ?3)",
            params![instance_id, now, version],
        )?;

        Ok(conn.last_insert_rowid())
    }

    pub fn record_session_end(&self, session_id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp();

        // Get start time to calculate duration
        let started_at: i64 = conn.query_row(
            "SELECT started_at FROM play_sessions WHERE id = ?1",
            params![session_id],
            |row| row.get(0),
        )?;

        let duration = now - started_at;

        conn.execute(
            "UPDATE play_sessions SET ended_at = ?1, duration = ?2 WHERE id = ?3",
            params![now, duration, session_id],
        )?;

        Ok(())
    }

    pub fn get_recent_instances(&self, limit: usize) -> Result<Vec<RecentInstance>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT instance_id, last_played_at, play_count 
             FROM recent_instances 
             ORDER BY last_played_at DESC 
             LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit], |row| {
            Ok(RecentInstance {
                instance_id: row.get(0)?,
                last_played_at: row.get(1)?,
                play_count: row.get(2)?,
            })
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    pub fn get_play_history(&self, limit: usize) -> Result<Vec<PlaySession>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, instance_id, started_at, ended_at, duration, version 
             FROM play_sessions 
             ORDER BY started_at DESC 
             LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit], |row| {
            Ok(PlaySession {
                id: Some(row.get(0)?),
                instance_id: row.get(1)?,
                started_at: row.get(2)?,
                ended_at: row.get(3)?,
                duration: row.get(4)?,
                version: row.get(5)?,
            })
        })?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row?);
        }
        Ok(results)
    }

    pub fn clear_play_history(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM play_sessions", [])?;
        conn.execute("DELETE FROM recent_instances", [])?;
        Ok(())
    }
}

// Tauri Commands

#[tauri::command]
pub async fn get_recent_instances(limit: Option<usize>) -> Result<Vec<RecentInstance>, String> {
    PlayHistoryManager::get_instance()
        .get_recent_instances(limit.unwrap_or(5))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_play_history(limit: Option<usize>) -> Result<Vec<PlaySession>, String> {
    PlayHistoryManager::get_instance()
        .get_play_history(limit.unwrap_or(50))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_play_history() -> Result<(), String> {
    PlayHistoryManager::get_instance()
        .clear_play_history()
        .map_err(|e| e.to_string())
}
