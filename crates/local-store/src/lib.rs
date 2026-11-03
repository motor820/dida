use rusqlite::{Connection, OptionalExtension};

pub fn load(conn: &Connection) -> rusqlite::Result<Option<String>> {
    conn.execute_batch("CREATE TABLE IF NOT EXISTS sync_local_state (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL CHECK(json_valid(value)));")?;
    conn.query_row("SELECT value FROM sync_local_state WHERE id=1", [], |r| {
        r.get(0)
    })
    .optional()
}

pub fn save(conn: &mut Connection, value: &str) -> Result<(), String> {
    let parsed: serde_json::Value =
        serde_json::from_str(value).map_err(|_| "Invalid local state")?;
    if parsed["schema"].as_u64() != Some(1) {
        return Err("Unsupported local state version".into());
    }
    load(conn).map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("INSERT INTO sync_local_state(id,value) VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET value=excluded.value", [value]).map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pending_operations_and_cursor_survive_reopen() {
        let path = std::env::temp_dir().join(format!("dida-local-{}.db", std::process::id()));
        let value = r#"{"schema":1,"cursor":42,"outbox":[{"id":"offline-edit"}],"records":{"task:1":{"title":"离线任务"}}}"#;
        {
            let mut c = Connection::open(&path).unwrap();
            save(&mut c, value).unwrap();
        }
        {
            let c = Connection::open(&path).unwrap();
            assert_eq!(load(&c).unwrap().unwrap(), value);
        }
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn invalid_write_does_not_replace_saved_state() {
        let mut c = Connection::open_in_memory().unwrap();
        save(&mut c, r#"{"schema":1,"outbox":[1]}"#).unwrap();
        assert!(save(&mut c, "broken").is_err());
        assert!(load(&c).unwrap().unwrap().contains("outbox"));
    }
}

#[cfg(test)]
#[path = "../../../src-tauri/src/db/connection.rs"]
mod legacy_connection;
#[cfg(test)]
#[path = "../../../src-tauri/src/models/mod.rs"]
pub mod models;
#[cfg(test)]
mod startup_regression {
    use super::*;
    #[test]
    fn actual_database_initialization_does_not_cascade_delete_existing_tasks() {
        let path = std::env::temp_dir().join(format!("dida-restart-{}.db", std::process::id()));
        {
            let db = legacy_connection::Database::new(path.clone()).unwrap();
            let c = db.conn.lock().unwrap();
            c.execute("INSERT INTO tasks(id,title,list_id,created_at,updated_at) VALUES('existing','existing task','smart_inbox',1,1)",[]).unwrap();
        }
        {
            let db = legacy_connection::Database::new(path.clone()).unwrap();
            let c = db.conn.lock().unwrap();
            assert_eq!(
                c.query_row("SELECT count(*) FROM tasks WHERE id='existing'", [], |r| {
                    r.get::<_, i64>(0)
                })
                .unwrap(),
                1
            );
        }
        std::fs::remove_file(path).unwrap();
    }
}
