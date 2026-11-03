mod store;
mod web;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let data = std::env::var("DIDA_DATA_DIR").unwrap_or_else(|_| "./data".into());
    std::fs::create_dir_all(&data)?;
    let database = format!("{data}/dida.sqlite3");
    #[cfg(unix)]
    {
        use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
        std::fs::set_permissions(&data, std::fs::Permissions::from_mode(0o700))?;
        std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .mode(0o600)
            .open(&database)?;
        std::fs::set_permissions(&database, std::fs::Permissions::from_mode(0o600))?;
    }

    if std::env::args().nth(1).as_deref() == Some("backup") {
        let dest = std::env::args()
            .nth(2)
            .ok_or("backup destination required")?;
        let c = rusqlite::Connection::open(&database)?;
        c.backup(
            rusqlite::DatabaseName::Main,
            std::path::Path::new(&dest),
            None,
        )?;
        return Ok(());
    }
    if std::env::args().nth(1).as_deref() == Some("restore") {
        let source = std::env::args()
            .nth(2)
            .ok_or("restore source required; stop the service first")?;
        let source_conn = rusqlite::Connection::open_with_flags(
            source,
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
        )?;
        let healthy: String = source_conn.query_row("PRAGMA integrity_check", [], |r| r.get(0))?;
        if healthy != "ok" {
            return Err("Invalid backup".into());
        }
        source_conn.prepare("SELECT password_hash FROM account WHERE id=1")?;
        source_conn.prepare("SELECT data FROM records LIMIT 0")?;
        source_conn.prepare("SELECT seq FROM changes LIMIT 0")?;
        source_conn.backup(
            rusqlite::DatabaseName::Main,
            std::path::Path::new(&database),
            None,
        )?;
        let mut restored = rusqlite::Connection::open(&database)?;
        let tx = restored.transaction()?;
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);",
        )?;
        use rand::RngCore;
        let mut bytes = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut bytes);
        tx.execute("INSERT INTO metadata(key,value) VALUES('epoch',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[hex::encode(bytes)])?;
        tx.execute("DELETE FROM sessions", [])?;
        tx.commit()?;
        println!("Backup restored; devices must sign in and bootstrap again");
        return Ok(());
    }
    let password_path = std::env::var("DIDA_PASSWORD_FILE")?;
    let password = std::fs::read_to_string(password_path)?;
    let state = store::Store::open(
        &database,
        std::env::var("DIDA_USERNAME").unwrap_or_else(|_| "motor".into()),
        password.trim(),
    )?;
    let public_url =
        std::env::var("DIDA_PUBLIC_URL").unwrap_or_else(|_| "https://dida.aiking.net:888".into());
    let assets = std::env::var("DIDA_WEB_DIR").unwrap_or_else(|_| "../dist".into());
    let app = web::router(state, public_url, assets);
    let bind = std::env::var("DIDA_BIND").unwrap_or_else(|_| "127.0.0.1:1430".into());
    let listener = tokio::net::TcpListener::bind(&bind).await?;
    println!("Dida API listening on {bind}");
    axum::serve(listener, app).await?;
    Ok(())
}
