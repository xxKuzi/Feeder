// src-tauri/src/sql.rs

use std::result::Result;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::{OnceCell, Mutex}; // Use tokio's async Mutex
use sqlx::{sqlite::SqliteQueryResult, Sqlite, SqlitePool, migrate::MigrateDatabase};
use sqlx::FromRow;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fmt;

static DB_URL: once_cell::sync::OnceCell<String> = once_cell::sync::OnceCell::new();

pub fn get_db_url() -> String {
    DB_URL.get().cloned().unwrap_or_else(|| String::from("sqlite://data.db"))
}

// Database connection pool
static DB_POOL: Lazy<OnceCell<Arc<Mutex<SqlitePool>>>> = Lazy::new(OnceCell::new);

static SESSION_USER_SELECTED: AtomicBool = AtomicBool::new(false);

// Initialize the database pool asynchronously
async fn init_db_pool() -> Arc<Mutex<SqlitePool>> {
    let url = get_db_url();
    let pool = SqlitePool::connect(&url).await.unwrap();
    Arc::new(Mutex::new(pool))
}

// Retrieve or initialize the database pool
pub async fn get_db_pool() -> Arc<Mutex<SqlitePool>> {
    DB_POOL.get_or_init(init_db_pool).await.clone()
}

// Schema creation function
async fn create_schema() -> Result<SqliteQueryResult, sqlx::Error> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await; // Lock the async mutex

    sqlx::query("PRAGMA journal_mode = DELETE;")
    .execute(&*pool)
    .await?;

    let qry = "
    PRAGMA foreign_keys = ON;
     
    CREATE TABLE IF NOT EXISTS users
    (
        user_id         INTEGER PRIMARY KEY,
        name            TEXT NOT NULL,
        number          INTEGER,
        archived        INTEGER DEFAULT 0,
        created_at      DATETIME DEFAULT (datetime('now', 'localtime'))        
    );  

    CREATE TABLE IF NOT EXISTS records
    (
        records_id      INTEGER PRIMARY KEY NOT NULL,
        name            TEXT NOT NULL,
        category        INTEGER NOT NULL,
        made            INTEGER NOT NULL,
        taken           INTEGER NOT NULL,
        user_id         INTEGER,
        created_at      DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES users (user_id) ON UPDATE CASCADE ON DELETE CASCADE 
    );     
    
    CREATE TABLE IF NOT EXISTS data
    (
        data_id         INTEGER PRIMARY KEY NOT NULL,
        user_id         INTEGER,
        angle           INTEGER DEFAULT 0,
        last_calibration DATETIME DEFAULT (datetime('now', 'localtime')),   
        calibration_state BOOL 
    );     

    CREATE TABLE IF NOT EXISTS modes
    (
        mode_id         INTEGER PRIMARY KEY,
        name            TEXT,
        image           TEXT,
        category        INTEGER DEFAULT 0,  
        predefined      BOOL DEFAULT false,
        repetition      INTEGER DEFAULT 10,
        angles          TEXT DEFAULT '[60,90,120]',
        distances       TEXT DEFAULT '[5000,6000,3000]',
        intervals       TEXT DEFAULT '[5,5,6]'
        
    );    

    INSERT INTO users (user_id, name, number)    VALUES (1, 'Default', 69);
    INSERT INTO data (user_id)                VALUES (1);
    INSERT INTO modes (mode_id, category, name, predefined, angles, intervals, distances)                VALUES (0, 3, 'Free throws', true, '[90]', '[5]', '[5000]');
    INSERT INTO modes (category, name, predefined)                VALUES (1, 'Two Point', true);
    INSERT INTO modes (category, name, predefined, distances, intervals, angles)                VALUES (2, 'Three Point', true, '[6700,6700]', '[4,4]', '[120,150]');
    ";

    sqlx::query(&qry).execute(&*pool).await // Execute the query
}

// Initialize and connect to the database
pub async fn connect_to_database(custom_path: Option<std::path::PathBuf>) {
    if let Some(path) = custom_path {
        let db_url = format!("sqlite://{}", path.to_string_lossy());
        let _ = DB_URL.set(db_url);
    }

    let url = get_db_url();
    if !Sqlite::database_exists(&url).await.unwrap_or(false) {
        Sqlite::create_database(&url).await.unwrap();
        match create_schema().await {
            Ok(_) => println!("Database created successfully"),
            Err(e) => panic!("{}", e),
        }
    } else {
        // Double check if tables exist. If they don't, create schema.
        let pool = get_db_pool().await;
        let pool_guard = pool.lock().await;
        let table_exists = sqlx::query("SELECT 1 FROM users LIMIT 1")
            .execute(&*pool_guard)
            .await;
        
        drop(pool_guard); // Drop the lock before running create_schema or migration
        
        match table_exists {
            Ok(_) => {
                // Run migration for existing databases: add archived column if it doesn't exist
                let pool = get_db_pool().await;
                let pool = pool.lock().await;
                let _ = sqlx::query("ALTER TABLE users ADD COLUMN archived INTEGER DEFAULT 0")
                    .execute(&*pool)
                    .await;
            }
            Err(_) => {
                // Table does not exist, create schema
                match create_schema().await {
                    Ok(_) => println!("Database schema created successfully"),
                    Err(e) => println!("Failed to create schema: {}", e),
                }
            }
        }
    }
}





#[tauri::command]
pub async fn add_user(name: String, number: Option<u32>) -> Result<u32, String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    let qry = "INSERT INTO users (name, number) VALUES (?, ?)";
    let result = sqlx::query(qry)
        .bind(name)
        .bind(number)
        .execute(&*pool)
        .await;

    match result {
        Ok(res) => Ok(res.last_insert_rowid() as u32),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn delete_user(user_id: i32) -> Result<(), String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    // Step 1: Get the count of active users
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE archived = 0")
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    // Step 2: Check if there are at least 2 active users
    if count.0 < 2 {
        return Err("Cannot archive user. At least 2 active users are required.".to_string());
    }

    // Step 3: Proceed to archive the user by setting archived = 1
    sqlx::query("UPDATE users SET archived = 1 WHERE user_id = ?")
        .bind(user_id)
        .execute(&*pool)
        .await
        .map(|_| ()) // Map success to Ok(())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn select_user(user_id: i32, app: tauri::AppHandle) -> Result<(), String> {  
    use tauri::Emitter;
    
    SESSION_USER_SELECTED.store(true, Ordering::SeqCst);

    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    sqlx::query("UPDATE data SET user_id = $1 WHERE data_id = 1")
        .bind(user_id)
        .execute(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    // Load name and number of selected user
    let user_row = sqlx::query_as::<_, User>("SELECT user_id, name, number, created_at FROM users WHERE user_id = ?")
        .bind(user_id)
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    let name = user_row.name;
    let number = user_row.number.unwrap_or(0);

    let payload = serde_json::json!({
        "user_id": user_id,
        "name": name,
        "number": number
    });

    // Emit event to React desktop frontend
    let _ = app.emit("active-user-changed", payload.clone());

    // Send TCP event to the node.js bridge so it can broadcast to FeederPocket
    let _ = crate::tcp::send_event("active_user_changed", payload);

    Ok(())
}

#[tauri::command]
pub async fn save_angle(angle: i32) -> Result<(), String> {  
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    sqlx::query("UPDATE data SET angle = $1 WHERE data_id = 1")
        .bind(angle)
        .execute(&*pool)
        .await
        .map(|_| ()) // Map success to Ok(())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_last_calibration(date: String) -> Result<(), String> {  
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    sqlx::query("UPDATE data SET last_calibration = $1 WHERE data_id = 1")
        .bind(date)
        .execute(&*pool)
        .await
        .map(|_| ()) // Map success to Ok(())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_calibration_state(state: bool) -> Result<(), String> {  
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    sqlx::query("UPDATE data SET calibration_state = $1 WHERE data_id = 1")
        .bind(state)
        .execute(&*pool)
        .await
        .map(|_| ()) // Map success to Ok(())
        .map_err(|e| e.to_string())
}



#[tauri::command]
pub async fn rename_user(user_id: i32, new_name: String, new_number: i32) -> Result<(), String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    sqlx::query("UPDATE users SET name = $1, number = $2 WHERE user_id = $3")
        .bind(new_name)
        .bind(new_number)
        .bind(user_id)
        .execute(&*pool)
        .await
        .map(|_| ()) // Map success to Ok(())
        .map_err(|e| e.to_string())
}


#[derive(Serialize, Deserialize, Debug, FromRow)]
pub struct User {
    user_id: u32,
    name: String,
    number: Option<u32>,
    created_at: String, 
}

#[tauri::command]
pub async fn load_users() -> Result<Vec<User>, String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    let qry = "SELECT user_id, name, number, created_at FROM users WHERE archived = 0";
    let users = sqlx::query_as::<_, User>(qry)
        .fetch_all(&*pool)
        .await;

    users.map_err(|e| e.to_string())
}



#[derive(Serialize, Deserialize, Debug, FromRow)]
pub struct SavedData {
    user_id: u32,
    name: String,
    number: Option<u32>,
    angle: i32,
    last_calibration: String,
    calibration_state: bool,
}

#[tauri::command]
pub async fn load_current_data() -> Result<Vec<SavedData>, String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    let qry = r#"
    SELECT 
        u.user_id AS user_id, 
        u.name AS name,       
        u.number AS number,
        d.angle AS angle,
        d.last_calibration AS last_calibration,
        d.calibration_state AS calibration_state
    FROM users u 
    INNER JOIN data d ON u.user_id = d.user_id 
    WHERE d.data_id = 1
    "#;

    let mut data = sqlx::query_as::<_, SavedData>(qry)
        .fetch_all(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    if !SESSION_USER_SELECTED.load(Ordering::SeqCst) {
        for row in data.iter_mut() {
            row.user_id = 0;
            row.name = "".to_string();
            row.number = None;
        }
    }

    Ok(data)
}

// Data structures and Tauri commands
#[derive(Serialize, Deserialize)]
pub struct ShotData {
    name: String,
    category: i32,
    made: u32,
    taken: u32,    
    user_id: u32,
}

impl fmt::Display for ShotData {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "ShotData {{ made: {}, taken: {}, user_id: {} }}", self.made, self.taken, self.user_id)
    }
}

#[tauri::command]
pub async fn add_record(data: ShotData) -> Result<(), String> {    
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    let qry = "INSERT INTO records (name, category, made, taken, user_id ) VALUES (?, ?, ?, ?, ?)";
    let result = sqlx::query(&qry)
        .bind(data.name)        
        .bind(data.category)    
        .bind(data.made)
        .bind(data.taken)        
        .bind(data.user_id)
        .execute(&*pool)
        .await;

    result.map(|_| ()).map_err(|e| e.to_string()) // Map success to Ok(())
}


#[derive(Serialize, Deserialize, Debug, FromRow)]
pub struct Record {
    records_id: u32,
    name: String,
    category: i32,
    made: i32,
    taken: i32,
    user_id: u32,
    created_at: String, // Adjust if you prefer a DateTime type
}

#[tauri::command]
pub async fn load_records() -> Result<Vec<Record>, String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    let qry = r#"
    SELECT r.records_id, r.name, r.category, r.made, r.taken, r.user_id, r.created_at 
    FROM records r 
    INNER JOIN users u ON r.user_id = u.user_id 
    WHERE u.archived = 0
    "#;
    let users = sqlx::query_as::<_, Record>(qry)
        .fetch_all(&*pool)
        .await;

    users.map_err(|e| e.to_string())
}



/*  --- Library ---  */
#[derive(Serialize, Deserialize, Debug, FromRow)]
pub struct Mode {
    mode_id: i32,
    name: String,
    image: String,
    category: i32,
    predefined: bool,
    repetition: i32,
    angles: String,
    distances: String,
    intervals: String,
}



#[tauri::command]
pub async fn add_mode(data: Mode) -> Result<(), String> {    
    let pool = get_db_pool().await;
    let pool = pool.lock().await;
    
    let qry = "INSERT INTO modes (name, image, category, predefined, repetition, angles, distances, intervals) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    let result = sqlx::query(&qry)        
        .bind(data.name)
        .bind(data.image)  
        .bind(data.category)
        .bind(data.predefined)
        .bind(data.repetition)
        .bind(data.angles)
        .bind(data.distances)
        .bind(data.intervals)       
        .execute(&*pool)
        .await; 

    result.map(|_| ()).map_err(|e| e.to_string()) // Map success to Ok(())
}

#[tauri::command]
pub async fn load_modes() -> Result<Vec<Mode>, String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    let qry = "SELECT mode_id, name, category, predefined, repetition, angles, distances, intervals, image FROM modes";
    let modes = sqlx::query_as::<_, Mode>(qry)
        .fetch_all(&*pool)
        .await;

    modes.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_mode(mode_id: i32) -> Result<(), String>{
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    let qry = "DELETE FROM modes WHERE mode_id = ?";
    let result = sqlx::query(&qry)
        .bind(mode_id)
        .execute(&*pool)
        .await;
 

    result.map(|_| ()).map_err(|e| e.to_string()) 
}


#[tauri::command]
pub async fn update_mode(data: Mode) -> Result<(), String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    let qry = "UPDATE modes SET name = ?, image = ?, category = ?, predefined = ?, repetition = ?, angles = ?, distances = ?, intervals = ? WHERE mode_id = ?";
    let result = sqlx::query(&qry)
        .bind(data.name)
        .bind(data.image)
        .bind(data.category)
        .bind(data.predefined)
        .bind(data.repetition)
        .bind(data.angles)
        .bind(data.distances)
        .bind(data.intervals)
        .bind(data.mode_id)
        .execute(&*pool)
        .await;

    result.map(|_| ()).map_err(|e| e.to_string())
}

#[derive(Serialize, Deserialize, Debug, FromRow)]
pub struct UserAccuracySummary {
        user_id: u32,
        name: String,
        made: i64,
        taken: i64,
        accuracy: f64,
}

#[tauri::command]
pub async fn load_user_accuracy_summary() -> Result<Vec<UserAccuracySummary>, String> {
        let pool = get_db_pool().await;
        let pool = pool.lock().await;

        let qry = r#"
        SELECT
            u.user_id AS user_id,
            u.name AS name,
            COALESCE(SUM(r.made), 0) AS made,
            COALESCE(SUM(r.taken), 0) AS taken,
            CASE
                WHEN COALESCE(SUM(r.taken), 0) = 0 THEN 0.0
                ELSE CAST(COALESCE(SUM(r.made), 0) AS REAL) / CAST(SUM(r.taken) AS REAL)
            END AS accuracy
        FROM users u
        LEFT JOIN records r ON r.user_id = u.user_id
        WHERE u.archived = 0
        GROUP BY u.user_id, u.name
        ORDER BY u.user_id
        "#;

        sqlx::query_as::<_, UserAccuracySummary>(qry)
                .fetch_all(&*pool)
                .await
                .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_archived_users() -> Result<Vec<User>, String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    let qry = "SELECT user_id, name, number, created_at FROM users WHERE archived = 1";
    let users = sqlx::query_as::<_, User>(qry)
        .fetch_all(&*pool)
        .await;

    users.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unarchive_user(user_id: i32) -> Result<(), String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    sqlx::query("UPDATE users SET archived = 0 WHERE user_id = ?")
        .bind(user_id)
        .execute(&*pool)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_user_permanently(user_id: i32) -> Result<(), String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    sqlx::query("DELETE FROM users WHERE user_id = ?")
        .bind(user_id)
        .execute(&*pool)
        .await
        .map(|_| ())
        .map_err(|e| e.to_string())
}




