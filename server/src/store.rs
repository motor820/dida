use argon2::{password_hash::SaltString, Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use rand::RngCore;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

pub fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
pub fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}
fn secret() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex::encode(bytes)
}
fn password_hash(password: &str) -> Result<String, String> {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    let salt = SaltString::encode_b64(&bytes).map_err(|_| "Password hashing failed")?;
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|_| "Password hashing failed".into())
}
#[derive(Clone)]
pub struct Store {
    pub db: Arc<Mutex<Connection>>,
    pub username: String,
}
fn is_false(value: &bool) -> bool {
    !*value
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Field {
    pub value: Value,
    pub stamp: String,
    #[serde(default, skip_serializing_if = "is_false")]
    pub initial: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Record {
    pub kind: String,
    pub id: String,
    pub fields: BTreeMap<String, Field>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Operation {
    pub op_id: String,
    pub kind: String,
    pub id: String,
    pub patch: BTreeMap<String, Value>,
    pub stamp: String,
    #[serde(default, skip_serializing_if = "is_false")]
    pub initialize: bool,
}

fn db_error(_: impl std::fmt::Display) -> String {
    "Database operation failed".into()
}
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
fn validate(op: &Operation, device: &str) -> Result<(), String> {
    if !valid_id(&op.id) || !valid_id(&op.op_id) || !valid_id(device) {
        return Err("Invalid identifier".into());
    }
    let fields: &[&str] = match op.kind.as_str() {
        "task" => &[
            "id",
            "title",
            "description",
            "list_id",
            "completed",
            "priority",
            "due_date",
            "reminder",
            "repeat_rule",
            "tags",
            "parent_id",
            "order",
            "is_deleted",
            "created_at",
            "updated_at",
            "completed_at",
            "__deleted",
        ],
        "list" => &[
            "id",
            "name",
            "icon",
            "color",
            "is_smart",
            "order",
            "created_at",
            "__deleted",
        ],
        "tag" => &[
            "id",
            "name",
            "color",
            "parent_id",
            "is_pinned",
            "created_at",
            "__deleted",
        ],
        _ => return Err("Invalid record type".into()),
    };
    if op.patch.is_empty() || op.patch.keys().any(|k| !fields.contains(&k.as_str())) {
        return Err("Invalid patch fields".into());
    }
    let parts: Vec<_> = op.stamp.splitn(3, '-').collect();
    if parts.len() != 3
        || parts[0].len() != 13
        || parts[1].len() != 6
        || parts[2] != device
        || !parts[1].bytes().all(|b| b.is_ascii_digit())
    {
        return Err("Invalid operation clock".into());
    }
    let time = parts[0]
        .parse::<i64>()
        .map_err(|_| "Invalid operation time")?;
    if time > now() + 300_000 || time < 946_684_800_000 {
        return Err("Device clock needs calibration".into());
    }
    for (key, value) in &op.patch {
        match key.as_str() {
            "id" if value.as_str() != Some(op.id.as_str()) => {
                return Err("Record ID mismatch".into())
            }
            "title" | "name" | "icon" | "color" | "description" => {
                let text = value.as_str().ok_or("Invalid text field")?;
                let max = if key == "description" { 262144 } else { 4096 };
                if text.len() > max {
                    return Err("Text field too long".into());
                }
            }
            "completed" | "is_deleted" | "is_smart" | "is_pinned" | "__deleted" => {
                if !value.is_boolean() {
                    return Err("Invalid boolean field".into());
                }
            }
            "list_id" | "parent_id" => {
                if !value.is_null() && !value.as_str().is_some_and(valid_id) {
                    return Err("Invalid reference".into());
                }
            }
            "tags" => {
                if !value.as_array().is_some_and(|a| {
                    a.len() <= 250 && a.iter().all(|v| v.as_str().is_some_and(valid_id))
                }) {
                    return Err("Invalid tags".into());
                }
            }
            "priority" => {
                if !value.as_i64().is_some_and(|n| (0..=3).contains(&n)) {
                    return Err("Invalid priority".into());
                }
            }
            "order" | "created_at" | "updated_at" | "due_date" | "completed_at" => {
                if !value.is_null() && !value.is_number() {
                    return Err("Invalid numeric field".into());
                }
            }
            "repeat_rule" => {
                if !value.is_null() && !value.is_object() {
                    return Err("Invalid repeat rule".into());
                }
            }
            "reminder" => {
                if !value.is_null() && !value.is_string() {
                    return Err("Invalid reminder".into());
                }
            }
            _ => {}
        }
    }
    if op.kind == "list" && op.id.starts_with("smart_") {
        return Err("System lists cannot be synchronized".into());
    }
    Ok(())
}

impl Store {
    pub fn open(path: &str, username: String, password: &str) -> Result<Self, String> {
        if password.len() < 12 {
            return Err("Initial password must contain at least 12 characters".into());
        }
        let conn = Connection::open(path).map_err(db_error)?;
        conn.busy_timeout(std::time::Duration::from_secs(10))
            .map_err(db_error)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
        CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS account(id INTEGER PRIMARY KEY CHECK(id=1), password_hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,name TEXT NOT NULL,created INTEGER NOT NULL,expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS records(kind TEXT NOT NULL,id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(kind,id));
        CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY);
        CREATE TABLE IF NOT EXISTS changes(seq INTEGER PRIMARY KEY AUTOINCREMENT,data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS auth_attempts(ip TEXT PRIMARY KEY,count INTEGER NOT NULL,started INTEGER NOT NULL);").map_err(db_error)?;
        conn.execute(
            "INSERT OR IGNORE INTO metadata(key,value) VALUES('epoch',?1)",
            [secret()],
        )
        .map_err(db_error)?;
        let exists: bool = conn
            .query_row("SELECT EXISTS(SELECT 1 FROM account)", [], |r| r.get(0))
            .map_err(db_error)?;
        if !exists {
            conn.execute(
                "INSERT INTO account VALUES(1,?1)",
                [password_hash(password)?],
            )
            .map_err(db_error)?;
        }
        Ok(Self {
            db: Arc::new(Mutex::new(conn)),
            username,
        })
    }
    pub fn epoch(&self) -> Result<String, String> {
        self.db
            .lock()
            .map_err(db_error)?
            .query_row("SELECT value FROM metadata WHERE key='epoch'", [], |r| {
                r.get(0)
            })
            .map_err(db_error)
    }
    pub fn login(
        &self,
        username: &str,
        password: &str,
        name: &str,
        ip: &str,
    ) -> Result<String, String> {
        if username.len() > 128 || password.len() > 1024 || name.len() > 200 {
            return Err("Invalid credentials".into());
        }
        let (hash, limited) = {
            let c = self.db.lock().map_err(db_error)?;
            let attempt: Option<(i64, i64)> = c
                .query_row(
                    "SELECT count,started FROM auth_attempts WHERE ip=?1",
                    [ip],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .optional()
                .map_err(db_error)?;
            let limited =
                attempt.is_some_and(|(count, start)| count >= 10 && now() - start < 900_000);
            let hash: String = c
                .query_row("SELECT password_hash FROM account WHERE id=1", [], |r| {
                    r.get(0)
                })
                .map_err(db_error)?;
            (hash, limited)
        };
        if limited {
            return Err("Too many login attempts; retry later".into());
        }
        let ok = PasswordHash::new(&hash).ok().is_some_and(|h| {
            Argon2::default()
                .verify_password(password.as_bytes(), &h)
                .is_ok()
        }) && username == self.username;
        let c = self.db.lock().map_err(db_error)?;
        if !ok {
            c.execute("INSERT INTO auth_attempts(ip,count,started) VALUES(?1,1,?2) ON CONFLICT(ip) DO UPDATE SET count=CASE WHEN ?2-started>900000 THEN 1 ELSE count+1 END,started=CASE WHEN ?2-started>900000 THEN ?2 ELSE started END",params![ip,now()]).map_err(db_error)?;
            return Err("Invalid username or password".into());
        }
        c.execute("DELETE FROM auth_attempts WHERE ip=?1", [ip])
            .map_err(db_error)?;
        c.execute("DELETE FROM sessions WHERE expires<?1", [now()])
            .map_err(db_error)?;
        let token = secret();
        c.execute(
            "INSERT INTO sessions VALUES(?1,?2,?3,?4)",
            params![hash_token(&token), name, now(), now() + 30 * 86400000i64],
        )
        .map_err(db_error)?;
        Ok(token)
    }
    pub fn authorized(&self, token: &str) -> bool {
        if token.len() != 64 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
            return false;
        }
        self.db
            .lock()
            .ok()
            .and_then(|c| {
                c.query_row(
                    "SELECT EXISTS(SELECT 1 FROM sessions WHERE hash=?1 AND expires>?2)",
                    params![hash_token(token), now()],
                    |r| r.get::<_, bool>(0),
                )
                .ok()
            })
            .unwrap_or(false)
    }
    pub fn logout(&self, token: &str) -> Result<(), String> {
        self.db
            .lock()
            .map_err(db_error)?
            .execute("DELETE FROM sessions WHERE hash=?1", [hash_token(token)])
            .map_err(db_error)?;
        Ok(())
    }
    pub fn change_password(&self, current: &str, next: &str) -> Result<(), String> {
        if !(12..=1024).contains(&next.len()) {
            return Err("New password must contain 12–1024 characters".into());
        }
        let hash: String = self
            .db
            .lock()
            .map_err(db_error)?
            .query_row("SELECT password_hash FROM account", [], |r| r.get(0))
            .map_err(db_error)?;
        let valid = PasswordHash::new(&hash).ok().is_some_and(|h| {
            Argon2::default()
                .verify_password(current.as_bytes(), &h)
                .is_ok()
        });
        if !valid {
            return Err("Current password is incorrect".into());
        }
        let updated = password_hash(next)?;
        let mut c = self.db.lock().map_err(db_error)?;
        let tx = c.transaction().map_err(db_error)?;
        tx.execute("UPDATE account SET password_hash=?1 WHERE id=1", [updated])
            .map_err(db_error)?;
        tx.execute("DELETE FROM sessions", []).map_err(db_error)?;
        tx.commit().map_err(db_error)
    }
    pub fn devices(&self, current: &str) -> Result<Value, String> {
        let c = self.db.lock().map_err(db_error)?;
        let mut stmt=c.prepare("SELECT hash,name,created,expires FROM sessions WHERE expires>?1 ORDER BY created DESC").map_err(db_error)?;
        let rows=stmt.query_map([now()],|r|Ok(json!({"id":r.get::<_,String>(0)?,"name":r.get::<_,String>(1)?,"created":r.get::<_,i64>(2)?,"expires":r.get::<_,i64>(3)?,"current":r.get::<_,String>(0)?==hash_token(current)}))).map_err(db_error)?;
        let list = rows
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(db_error)?;
        Ok(json!(list))
    }
    pub fn revoke(&self, id: &str) -> Result<(), String> {
        self.db
            .lock()
            .map_err(db_error)?
            .execute("DELETE FROM sessions WHERE hash=?1", [id])
            .map_err(db_error)?;
        Ok(())
    }
    pub fn push(&self, device: &str, operations: &[Operation]) -> Result<Value, String> {
        if operations.len() > 100 {
            return Err("Too many operations".into());
        }
        for op in operations {
            validate(op, device)?;
        }
        let mut c = self.db.lock().map_err(db_error)?;
        let tx = c.transaction().map_err(db_error)?;
        let mut ack = Vec::new();
        for op in operations {
            let seen: bool = tx
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM operations WHERE id=?1)",
                    [&op.op_id],
                    |r| r.get(0),
                )
                .map_err(db_error)?;
            ack.push(&op.op_id);
            if seen {
                continue;
            }
            let existing: Option<String> = tx
                .query_row(
                    "SELECT data FROM records WHERE kind=?1 AND id=?2",
                    params![op.kind, op.id],
                    |r| r.get(0),
                )
                .optional()
                .map_err(db_error)?;
            let mut record: Record = existing
                .as_deref()
                .map(serde_json::from_str)
                .transpose()
                .map_err(db_error)?
                .unwrap_or(Record {
                    kind: op.kind.clone(),
                    id: op.id.clone(),
                    fields: BTreeMap::new(),
                });
            if !record
                .fields
                .get("__deleted")
                .is_some_and(|f| f.value == json!(true))
            {
                for (key, value) in &op.patch {
                    if record.fields.get(key).is_none_or(|old| {
                        (old.initial && !op.initialize)
                            || (old.initial == op.initialize && op.stamp > old.stamp)
                    }) {
                        record.fields.insert(
                            key.clone(),
                            Field {
                                value: value.clone(),
                                stamp: op.stamp.clone(),
                                initial: op.initialize,
                            },
                        );
                    }
                }
                let data = serde_json::to_string(&record).map_err(db_error)?;
                tx.execute("INSERT INTO records VALUES(?1,?2,?3) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",params![op.kind,op.id,data]).map_err(db_error)?;
                tx.execute("INSERT INTO changes(data) VALUES(?1)", [data])
                    .map_err(db_error)?;
            }
            tx.execute("INSERT INTO operations VALUES(?1)", [&op.op_id])
                .map_err(db_error)?;
        }
        tx.commit().map_err(db_error)?;
        Ok(json!({"ack":ack,"time":now()}))
    }
    pub fn pull(&self, after: i64, until: Option<i64>) -> Result<Value, String> {
        if after < 0 {
            return Err("Invalid cursor".into());
        }
        let c = self.db.lock().map_err(db_error)?;
        let max: i64 = c
            .query_row("SELECT COALESCE(MAX(seq),0) FROM changes", [], |r| r.get(0))
            .map_err(db_error)?;
        let until = until.unwrap_or(max).min(max);
        let mut stmt = c
            .prepare("SELECT seq,data FROM changes WHERE seq>?1 AND seq<=?2 ORDER BY seq LIMIT 500")
            .map_err(db_error)?;
        let rows = stmt
            .query_map(params![after, until], |r| {
                Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?))
            })
            .map_err(db_error)?;
        let mut cursor = after;
        let mut response_bytes = 0usize;
        let mut records = Vec::<Value>::new();
        for r in rows {
            let (seq, data) = r.map_err(db_error)?;
            if response_bytes + data.len() > 2 * 1024 * 1024 && !records.is_empty() {
                break;
            }
            response_bytes += data.len();
            cursor = seq;
            records.push(serde_json::from_str(&data).map_err(db_error)?);
        }
        Ok(
            json!({"records":records,"cursor":cursor,"until":until,"has_more":cursor<until,"time":now()}),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn store() -> Store {
        Store::open(":memory:", "motor".into(), "a-test-password-123").unwrap()
    }
    fn op(id: &str, t: i64, patch: Value) -> Operation {
        Operation {
            op_id: id.into(),
            kind: "task".into(),
            id: "task-1".into(),
            stamp: format!("{t:013}-000000-device-1"),
            initialize: false,
            patch: serde_json::from_value(patch).unwrap(),
        }
    }
    #[test]
    fn older_offline_write_cannot_overwrite_newer_field_and_retries_are_idempotent() {
        let s = store();
        let t = now();
        let newer = op("newer", t, json!({"title":"new"}));
        s.push("device-1", &[newer.clone()]).unwrap();
        s.push(
            "device-1",
            &[op(
                "older",
                t - 1000,
                json!({"title":"old","description":"independent"}),
            )],
        )
        .unwrap();
        s.push("device-1", &[newer]).unwrap();
        let p = s.pull(0, None).unwrap();
        assert_eq!(p["records"].as_array().unwrap().len(), 2);
        assert_eq!(p["records"][1]["fields"]["title"]["value"], "new");
        assert_eq!(
            p["records"][1]["fields"]["description"]["value"],
            "independent"
        );
    }
    #[test]
    fn tombstone_prevents_resurrection() {
        let s = store();
        let t = now();
        s.push("device-1", &[op("delete", t, json!({"__deleted":true}))])
            .unwrap();
        s.push("device-1", &[op("stale", t + 1, json!({"title":"revive"}))])
            .unwrap();
        assert_eq!(
            s.pull(0, None).unwrap()["records"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
    }
    #[test]
    fn malicious_patch_rolls_back_entire_batch() {
        let s = store();
        let t = now();
        assert!(s
            .push(
                "device-1",
                &[
                    op("good", t, json!({"title":"x"})),
                    op("bad", t, json!({"__proto__":{}}))
                ]
            )
            .is_err());
        assert_eq!(s.pull(0, None).unwrap()["cursor"], 0);
    }
    #[test]
    fn repeat_initializers_never_reset_real_edits_in_either_arrival_order() {
        for initializer_first in [true, false] {
            let s = store();
            let t = now();
            let mut initial = op(
                "initialize",
                t + 1000,
                json!({"title":"copied title","completed":false,"is_deleted":false,"due_date":42}),
            );
            initial.initialize = true;
            let edit = op(
                "edit",
                t,
                json!({"title":"edited title","completed":true,"is_deleted":true}),
            );
            let operations = if initializer_first {
                vec![initial.clone(), edit]
            } else {
                vec![edit, initial.clone()]
            };
            s.push("device-1", &operations).unwrap();
            s.push("device-1", &[initial]).unwrap();
            let pull = s.pull(0, None).unwrap();
            let records = pull["records"].as_array().unwrap();
            let last = records.last().unwrap();
            assert_eq!(last["fields"]["title"]["value"], "edited title");
            assert_eq!(last["fields"]["completed"]["value"], true);
            assert_eq!(last["fields"]["is_deleted"]["value"], true);
            assert_eq!(last["fields"]["due_date"]["value"], 42);
            assert_eq!(last["fields"]["due_date"]["initial"], true);
            assert!(last["fields"]["title"].get("initial").is_none());
        }
    }

    #[test]
    fn repeat_initializer_cannot_resurrect_a_permanently_deleted_occurrence() {
        let s = store();
        let t = now();
        s.push("device-1", &[op("delete", t, json!({"__deleted":true}))])
            .unwrap();
        let mut initial = op(
            "initialize",
            t + 1000,
            json!({"title":"old copy","completed":false}),
        );
        initial.initialize = true;
        s.push("device-1", &[initial]).unwrap();
        let pull = s.pull(0, None).unwrap();
        assert_eq!(pull["records"].as_array().unwrap().len(), 1);
        assert_eq!(pull["records"][0]["fields"]["__deleted"]["value"], true);
    }

    #[test]
    fn password_change_revokes_all_devices() {
        let s = store();
        let a = s
            .login("motor", "a-test-password-123", "Mac", "127.0.0.1")
            .unwrap();
        let b = s
            .login("motor", "a-test-password-123", "Web", "127.0.0.1")
            .unwrap();
        assert!(s.authorized(&a));
        s.change_password("a-test-password-123", "replacement-password-123")
            .unwrap();
        assert!(!s.authorized(&a));
        assert!(!s.authorized(&b));
    }
}
