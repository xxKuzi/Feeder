// src-tauri/src/sql.rs

use std::result::Result;
use std::sync::Arc;
use tokio::sync::{OnceCell, Mutex}; // Use tokio's async Mutex
use sqlx::{sqlite::SqliteQueryResult, Sqlite, SqlitePool, migrate::MigrateDatabase};
use sqlx::FromRow;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fmt;

// Database URL
static DB_URL: Lazy<String> = Lazy::new(|| String::from("sqlite://data.db"));

// Database connection pool
static DB_POOL: Lazy<OnceCell<Arc<Mutex<SqlitePool>>>> = Lazy::new(OnceCell::new);

// Initialize the database pool asynchronously
async fn init_db_pool() -> Arc<Mutex<SqlitePool>> {
    let pool = SqlitePool::connect(&*DB_URL).await.unwrap();
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
        created_at      DATETIME DEFAULT (datetime('now', 'localtime'))        
    );  

    CREATE TABLE IF NOT EXISTS records
    (
        records_id      INTEGER PRIMARY KEY NOT NULL,
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
        updated_at      DATETIME DEFAULT (datetime('now', 'localtime'))
    );     

    CREATE TABLE IF NOT EXISTS modes
    (
        mode_id         INTEGER PRIMARY KEY,
        name            TEXT,
        category        INTEGER DEFAULT 0,  
        time            INTEGER DEFAULT 30,  
        motor_speed     INTEGER DEFAULT 30,
        angles          TEXT DEFAULT '30,90,150',
        interval        INTEGER DEFAULT 5,
        predefined      BOOL DEFAULT false
    );     

    INSERT INTO users (user_id, name, number)    VALUES (1, 'Default', 69);
    INSERT INTO data (user_id)                VALUES (1);
    INSERT INTO modes (mode_id, category, name, predefined)                VALUES (0, 0, 'DEFAULT random New', true);
    INSERT INTO modes (category, name, predefined)                VALUES (1, 'DEFAULT Two Point', true);
    INSERT INTO modes (category, name, predefined)                VALUES (2, 'DEFAULT Three Point', true);
    ";

    sqlx::query(&qry).execute(&*pool).await // Execute the query
}

// Initialize and connect to the database
pub async fn connect_to_database() {
    if !Sqlite::database_exists(&*DB_URL).await.unwrap_or(false) {
        Sqlite::create_database(&*DB_URL).await.unwrap();
        match create_schema().await {
            Ok(_) => println!("Database created successfully"),
            Err(e) => panic!("{}", e),
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

        // Step 1: Get the count of users
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users")
        .fetch_one(&*pool)
        .await
        .map_err(|e| e.to_string())?;

    // Step 2: Check if there are at least 2 users
    if count.0 < 2 {
        return Err("Cannot delete user. At least 2 users are required.".to_string());
    }

    // Step 3: Proceed to delete the user if the count condition is met
    sqlx::query("DELETE FROM users WHERE user_id = ?")
        .bind(user_id)
        .execute(&*pool)
        .await
        .map(|_| ()) // Map success to Ok(())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn select_user(user_id: i32) -> Result<(), String> {  
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    sqlx::query("UPDATE data SET user_id = $1 WHERE data_id = 1")
        .bind(user_id)
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
    created_at: String, // Adjust if you prefer a DateTime type
}

#[tauri::command]
pub async fn load_users() -> Result<Vec<User>, String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    let qry = "SELECT user_id, name, number, created_at FROM users";
    let users = sqlx::query_as::<_, User>(qry)
        .fetch_all(&*pool)
        .await;

    

    users.map_err(|e| e.to_string())
}



#[derive(Serialize, Deserialize, Debug, FromRow)]
pub struct CurrentUser {
    user_id: u32,
    name: String,
    number: u32
}

#[tauri::command]
pub async fn load_current_data() -> Result<Vec<CurrentUser>, String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    let qry = r#"
    SELECT 
        u.user_id AS user_id, 
        u.name AS name,       
        u.number AS number
    FROM users u 
    INNER JOIN data d ON u.user_id = d.user_id 
    WHERE d.data_id = 1
    "#;

      // Directly return the result of the query with error mapping
      sqlx::query_as::<_, CurrentUser>(qry)
      .fetch_all(&*pool)
      .await
      .map_err(|e| e.to_string()) // Map errors to String
}

// Data structures and Tauri commands
#[derive(Serialize, Deserialize)]
pub struct ShotData {
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

    let qry = "INSERT INTO records (made, taken, user_id) VALUES (?, ?, ?)";
    let result = sqlx::query(&qry)
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
    made: i32,
    taken: i32,
    user_id: u32,
    created_at: String, // Adjust if you prefer a DateTime type
}

#[tauri::command]
pub async fn load_records() -> Result<Vec<Record>, String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    let qry = "SELECT records_id, made, taken, user_id, created_at FROM records";
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
    category: i32,
    time: i32,    
    motor_speed: i32,
    angles: String,
    interval: i32,
    predefined: bool,
}



#[tauri::command]
pub async fn add_mode(data: Mode) -> Result<(), String> {    
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    let angles = serde_json::to_string(&data.angles).map_err(|e| e.to_string())?;

    let qry = "INSERT INTO modes (name, category, time, motor_speed, angles, interval, predefined) VALUES (?, ?, ?, ?, ?, ?, ?)";
    let result = sqlx::query(&qry)        
        .bind(data.name)
        .bind(data.category)
        .bind(data.time)
        .bind(data.motor_speed)
        .bind(data.angles)
        .bind(data.interval)        
        .bind(data.predefined)       
        .execute(&*pool)
        .await; 

    result.map(|_| ()).map_err(|e| e.to_string()) // Map success to Ok(())
}

#[tauri::command]
pub async fn load_modes() -> Result<Vec<Mode>, String> {
    let pool = get_db_pool().await;
    let pool = pool.lock().await;

    let qry = "SELECT mode_id, name, category, time, motor_speed, angles, interval, predefined FROM modes";
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


