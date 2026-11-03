use crate::state::AppState;
use serde_json::{json, Value};
use tauri::State;

const API: &str = "https://dida.aiking.net:888";
fn credential() -> Result<keyring::Entry, String> {
    keyring::Entry::new("net.aiking.dida.sync", "session").map_err(|_| "无法访问系统钥匙串".into())
}
#[tauri::command]
pub fn sync_local_load(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let c = state.db.conn.lock().map_err(|_| "本地数据库繁忙")?;
    dida_local_store::load(&c).map_err(|_| "无法读取本地数据库".into())
}
#[tauri::command]
pub fn sync_local_save(value: String, state: State<'_, AppState>) -> Result<(), String> {
    if value.len() > 64 * 1024 * 1024 {
        return Err("本地数据超过大小限制".into());
    }
    let mut c = state.db.conn.lock().map_err(|_| "本地数据库繁忙")?;
    dida_local_store::save(&mut c, &value)
}
#[tauri::command]
pub fn sync_has_session() -> bool {
    credential()
        .and_then(|c| c.get_password().map_err(|_| "未登录".into()))
        .is_ok()
}
#[tauri::command]
pub async fn sync_request(
    method: String,
    path: String,
    body: Option<Value>,
) -> Result<Value, String> {
    if !path.starts_with("/api/v1/")
        || path.contains("..")
        || path.contains('#')
        || path.contains('\\')
        || !matches!(method.as_str(), "GET" | "POST" | "DELETE")
    {
        return Err("不允许的请求".into());
    }
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|_| "无法建立安全连接")?;
    let method = reqwest::Method::from_bytes(method.as_bytes()).map_err(|_| "不允许的请求方法")?;
    let mut req = client
        .request(method, format!("{API}{path}"))
        .header("X-Dida-Client", "native");
    if let Ok(token) = credential()?.get_password() {
        req = req.bearer_auth(token)
    }
    if let Some(value) = body {
        req = req.json(&value)
    }
    let response = req
        .send()
        .await
        .map_err(|_| "无法连接同步服务，可继续离线使用")?;
    let status = response.status().as_u16();
    let mut data: Value = response.json().await.map_err(|_| "同步服务响应无效")?;
    if (200..300).contains(&status) && path == "/api/v1/auth/login" {
        if let Some(token) = data.get("token").and_then(Value::as_str) {
            credential()?
                .set_password(token)
                .map_err(|_| "无法将会话保存到系统钥匙串")?;
        }
        if let Some(obj) = data.as_object_mut() {
            obj.remove("token");
        }
    }
    if (200..300).contains(&status)
        && (path == "/api/v1/auth/logout" || path == "/api/v1/auth/password")
    {
        let _ = credential()?.delete_credential();
    }
    Ok(json!({"status":status,"data":data}))
}
#[tauri::command]
pub fn sync_forget_session() -> Result<(), String> {
    let _ = credential()?.delete_credential();
    Ok(())
}
