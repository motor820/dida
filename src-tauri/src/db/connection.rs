use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub struct Database {
    pub conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn new(db_path: PathBuf) -> Result<Self> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
            }
            let file = std::fs::OpenOptions::new().create(true).append(true).mode(0o600).open(&db_path).map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
            file.set_permissions(std::fs::Permissions::from_mode(0o600)).map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        }
        let conn = Connection::open(db_path)?;
        // 启用外键约束
        conn.execute("PRAGMA foreign_keys = ON", [])?;
        let db = Database {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // 创建任务表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                list_id TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                priority INTEGER NOT NULL DEFAULT 0,
                due_date INTEGER,
                reminder TEXT,
                parent_id TEXT,
                order_num INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                completed_at INTEGER,
                repeat_rule TEXT,
                FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // 确保 is_deleted 列存在 (简单迁移)
        let _ = conn.execute(
            "ALTER TABLE tasks ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0",
            [],
        );

        // 确保 repeat_rule 列存在
        let _ = conn.execute("ALTER TABLE tasks ADD COLUMN repeat_rule TEXT", []);

        // 创建清单表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS lists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                icon TEXT NOT NULL,
                color TEXT NOT NULL,
                is_smart INTEGER NOT NULL DEFAULT 0,
                order_num INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            )",
            [],
        )?;

        // 确保 is_smart 列存在 (简单迁移)
        let _ = conn.execute(
            "ALTER TABLE lists ADD COLUMN is_smart INTEGER NOT NULL DEFAULT 0",
            [],
        );

        // 强制修复：如果存在 order_num 为 0 的多个智能清单，可能导致排序混乱或丢失
        // 我们可以根据 id 重新设置 order_num
        let _ = conn.execute("UPDATE lists SET order_num = 0 WHERE id = 'smart_all'", []);
        let _ = conn.execute(
            "UPDATE lists SET order_num = 1 WHERE id = 'smart_today'",
            [],
        );
        let _ = conn.execute("UPDATE lists SET order_num = 2 WHERE id = 'smart_week'", []);
        let _ = conn.execute(
            "UPDATE lists SET order_num = 3 WHERE id = 'smart_inbox'",
            [],
        );
        let _ = conn.execute(
            "UPDATE lists SET order_num = 4 WHERE id = 'smart_completed'",
            [],
        );
        let _ = conn.execute(
            "UPDATE lists SET order_num = 5 WHERE id = 'smart_trash'",
            [],
        );

        // 补齐系统清单时保留已有行，避免替换父记录触发外键级联删除。
        conn.execute(
            "INSERT OR IGNORE INTO lists (id, name, icon, color, is_smart, order_num, created_at)
             VALUES ('smart_trash', '垃圾桶', '🗑️', '#3B82F6', 1, 5, ?1)",
            rusqlite::params![chrono::Utc::now().timestamp()],
        )?;

        // 创建标签表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS tags (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                color TEXT NOT NULL,
                parent_id TEXT,
                is_pinned INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (parent_id) REFERENCES tags(id) ON DELETE SET NULL
            )",
            [],
        )?;

        // 确保 parent_id 列存在 (简单迁移)
        let _ = conn.execute("ALTER TABLE tags ADD COLUMN parent_id TEXT", []);
        // 确保 is_pinned 列存在 (简单迁移)
        let _ = conn.execute(
            "ALTER TABLE tags ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0",
            [],
        );

        // 创建任务标签关联表
        conn.execute(
            "CREATE TABLE IF NOT EXISTS task_tags (
                task_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY (task_id, tag_id),
                FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            )",
            [],
        )?;

        // 创建索引
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed)",
            [],
        )?;

        // 初始化智能清单
        self.init_smart_lists(&conn)?;

        Ok(())
    }

    fn init_smart_lists(&self, conn: &Connection) -> Result<()> {
        use crate::models::{List, SmartListType};

        let smart_types = vec![
            SmartListType::All,
            SmartListType::Today,
            SmartListType::Week,
            SmartListType::Inbox,
            SmartListType::Completed,
            SmartListType::Trash,
        ];

        let now = chrono::Utc::now().timestamp();

        for (index, list_type) in smart_types.into_iter().enumerate() {
            let list = List::new_smart(list_type);
            conn.execute(
                "INSERT OR IGNORE INTO lists (id, name, icon, color, is_smart, order_num, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![list.id, list.name, list.icon, list.color, 1, index as i32, now],
            )?;
        }

        Ok(())
    }
}
