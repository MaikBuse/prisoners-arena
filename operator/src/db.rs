use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;

pub fn open(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS closed_tournaments (
            program_id    TEXT NOT NULL,
            tournament_id INTEGER NOT NULL,
            closed_at     INTEGER NOT NULL,
            PRIMARY KEY (program_id, tournament_id)
        );",
    )?;
    Ok(conn)
}

pub fn is_closed(conn: &Connection, program_id: &str, tournament_id: u32) -> bool {
    conn.query_row(
        "SELECT 1 FROM closed_tournaments WHERE program_id = ?1 AND tournament_id = ?2",
        rusqlite::params![program_id, tournament_id as i64],
        |_| Ok(()),
    )
    .is_ok()
}

pub fn mark_closed(conn: &Connection, program_id: &str, tournament_id: u32) -> Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs();
    conn.execute(
        "INSERT OR IGNORE INTO closed_tournaments (program_id, tournament_id, closed_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![program_id, tournament_id as i64, now as i64],
    )?;
    Ok(())
}
