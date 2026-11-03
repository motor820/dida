use crate::store::{now, Operation, Store};
use axum::{
    body::Body,
    extract::{DefaultBodyLimit, Path, Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use tower_http::services::{ServeDir, ServeFile};

#[derive(Clone)]
struct App {
    store: Store,
    origin: String,
    login_slots: Arc<tokio::sync::Semaphore>,
}
type Error = (StatusCode, Json<Value>);
fn error(status: StatusCode, message: impl Into<String>) -> Error {
    (status, Json(json!({"error":message.into(),"time":now()})))
}
fn token(headers: &HeaderMap) -> String {
    if let Some(token) = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
    {
        return token.into();
    }
    headers
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| {
            s.split(';')
                .find_map(|p| p.trim().strip_prefix("__Host-dida_session="))
        })
        .unwrap_or("")
        .into()
}
fn authenticated(app: &App, h: &HeaderMap) -> Result<String, Error> {
    let t = token(h);
    if !app.store.authorized(&t) {
        return Err(error(StatusCode::UNAUTHORIZED, "Please sign in"));
    }
    Ok(t)
}
fn origin(app: &App, h: &HeaderMap) -> Result<(), Error> {
    if let Some(o) = h.get(header::ORIGIN) {
        if o.to_str().unwrap_or("") != app.origin {
            return Err(error(StatusCode::FORBIDDEN, "Origin not allowed"));
        }
    } else if h.contains_key(header::COOKIE) {
        return Err(error(StatusCode::FORBIDDEN, "Origin required"));
    }
    Ok(())
}
fn cookie(token: &str, max_age: i64) -> HeaderValue {
    HeaderValue::from_str(&format!(
        "__Host-dida_session={token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age={max_age}"
    ))
    .expect("generated cookie is ASCII")
}
async fn security_headers(mut request: axum::http::Request<Body>, next: Next) -> Response {
    request.extensions_mut().insert(());
    let mut r = next.run(request).await;
    for (k,v) in [("x-content-type-options","nosniff"),("x-frame-options","DENY"),("referrer-policy","no-referrer"),("cache-control","no-store"),("content-security-policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")]{r.headers_mut().insert(k,HeaderValue::from_static(v));}
    r
}
pub fn router(store: Store, origin: String, assets: String) -> Router {
    let fallback = ServeFile::new(format!("{assets}/index.html"));
    let state = App {
        store,
        origin: origin.trim_end_matches('/').into(),
        login_slots: Arc::new(tokio::sync::Semaphore::new(4)),
    };
    Router::new()
        .route(
            "/healthz",
            get(|| async { Json(json!({"status":"ok","version":"0.2.0"})) }),
        )
        .route("/api/v1/auth/login", post(login))
        .route("/api/v1/auth/session", get(session))
        .route("/api/v1/auth/logout", post(logout))
        .route("/api/v1/auth/password", post(password))
        .route("/api/v1/sync/push", post(push))
        .route("/api/v1/sync/pull", get(pull))
        .route("/api/v1/devices", get(devices))
        .route("/api/v1/devices/{id}", delete(revoke))
        .route(
            "/api/v1/{*path}",
            get(|| async { StatusCode::NOT_FOUND }).post(|| async { StatusCode::NOT_FOUND }),
        )
        .fallback_service(ServeDir::new(assets).not_found_service(fallback))
        .layer(DefaultBodyLimit::max(2 * 1024 * 1024))
        .layer(middleware::from_fn(security_headers))
        .with_state(state)
}
#[derive(Deserialize)]
struct Login {
    username: String,
    password: String,
    #[serde(default)]
    device_name: String,
}
async fn login(
    State(app): State<App>,
    h: HeaderMap,
    Json(input): Json<Login>,
) -> Result<Response, Error> {
    origin(&app, &h)?;
    let _slot = app
        .login_slots
        .clone()
        .try_acquire_owned()
        .map_err(|_| error(StatusCode::TOO_MANY_REQUESTS, "Retry shortly"))?;
    let store = app.store.clone();
    let ip = h
        .get("x-real-ip")
        .and_then(|x| x.to_str().ok())
        .unwrap_or("local")
        .to_string();
    let name = if input.device_name.is_empty() {
        "Browser".into()
    } else {
        input.device_name
    };
    let t = tokio::task::spawn_blocking(move || {
        store.login(&input.username, &input.password, &name, &ip)
    })
    .await
    .map_err(|_| error(StatusCode::INTERNAL_SERVER_ERROR, "Login unavailable"))?
    .map_err(|e| {
        error(
            if e.starts_with("Too many") {
                StatusCode::TOO_MANY_REQUESTS
            } else {
                StatusCode::UNAUTHORIZED
            },
            e,
        )
    })?;
    let native = h.get("x-dida-client").is_some_and(|v| v == "native");
    let mut r = Json(
        json!({"username":app.store.username,"epoch":app.store.epoch().map_err(|e|error(StatusCode::INTERNAL_SERVER_ERROR,e))?,"time":now(),"token":if native{Some(&t)}else{None}}),
    )
    .into_response();
    if !native {
        r.headers_mut()
            .insert(header::SET_COOKIE, cookie(&t, 30 * 86400));
    }
    Ok(r)
}
async fn session(State(app): State<App>, h: HeaderMap) -> Result<Json<Value>, Error> {
    authenticated(&app, &h)?;
    Ok(Json(
        json!({"username":app.store.username,"epoch":app.store.epoch().map_err(|e|error(StatusCode::INTERNAL_SERVER_ERROR,e))?,"time":now()}),
    ))
}
async fn logout(State(app): State<App>, h: HeaderMap) -> Result<Response, Error> {
    origin(&app, &h)?;
    let t = authenticated(&app, &h)?;
    app.store
        .logout(&t)
        .map_err(|e| error(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    let mut r = Json(json!({"ok":true})).into_response();
    r.headers_mut().insert(header::SET_COOKIE, cookie("", 0));
    Ok(r)
}
#[derive(Deserialize)]
struct Password {
    current_password: String,
    new_password: String,
}
async fn password(
    State(app): State<App>,
    h: HeaderMap,
    Json(input): Json<Password>,
) -> Result<Json<Value>, Error> {
    origin(&app, &h)?;
    authenticated(&app, &h)?;
    let _slot = app
        .login_slots
        .clone()
        .try_acquire_owned()
        .map_err(|_| error(StatusCode::TOO_MANY_REQUESTS, "Retry shortly"))?;
    if input.current_password.len() > 1024 {
        return Err(error(StatusCode::BAD_REQUEST, "Invalid password length"));
    }
    let store = app.store.clone();
    tokio::task::spawn_blocking(move || {
        store.change_password(&input.current_password, &input.new_password)
    })
    .await
    .map_err(|_| {
        error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Password change unavailable",
        )
    })?
    .map_err(|e| error(StatusCode::BAD_REQUEST, e))?;
    Ok(Json(json!({"ok":true})))
}
#[derive(Deserialize)]
struct Push {
    device_id: String,
    operations: Vec<Operation>,
}
async fn push(
    State(app): State<App>,
    h: HeaderMap,
    Json(input): Json<Push>,
) -> Result<Json<Value>, Error> {
    origin(&app, &h)?;
    authenticated(&app, &h)?;
    Ok(Json(
        app.store
            .push(&input.device_id, &input.operations)
            .map_err(|e| error(StatusCode::BAD_REQUEST, e))?,
    ))
}
#[derive(Deserialize)]
struct Pull {
    #[serde(default)]
    after: i64,
    until: Option<i64>,
}
async fn pull(
    State(app): State<App>,
    h: HeaderMap,
    Query(q): Query<Pull>,
) -> Result<Json<Value>, Error> {
    authenticated(&app, &h)?;
    Ok(Json(
        app.store
            .pull(q.after, q.until)
            .map_err(|e| error(StatusCode::BAD_REQUEST, e))?,
    ))
}
async fn devices(State(app): State<App>, h: HeaderMap) -> Result<Json<Value>, Error> {
    let t = authenticated(&app, &h)?;
    Ok(Json(app.store.devices(&t).map_err(|e| {
        error(StatusCode::INTERNAL_SERVER_ERROR, e)
    })?))
}
async fn revoke(
    State(app): State<App>,
    h: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<Value>, Error> {
    origin(&app, &h)?;
    authenticated(&app, &h)?;
    app.store
        .revoke(&id)
        .map_err(|e| error(StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(json!({"ok":true})))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Request;
    use tower::ServiceExt;
    #[tokio::test]
    async fn anonymous_api_and_foreign_origin_are_rejected() {
        let s = Store::open(":memory:", "motor".into(), "long-test-password").unwrap();
        let app = router(
            s,
            "https://dida.aiking.net:888".into(),
            "/tmp/no-assets".into(),
        );
        let r = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/v1/sync/pull")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(r.status(), 401);
        let r = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/auth/login")
                    .header("content-type", "application/json")
                    .header("origin", "https://evil.example")
                    .body(Body::from(
                        r#"{"username":"motor","password":"long-test-password"}"#,
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(r.status(), 403);
    }
}
