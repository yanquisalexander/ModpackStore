use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Wry};
use uuid::Uuid;

// --- TaskStatus y TaskInfo permanecen iguales ---

#[derive(Clone, Serialize, Deserialize, Debug)]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct TaskInfo {
    pub id: String,
    pub label: String,
    pub status: TaskStatus,
    pub progress: f32,
    pub message: String,
    pub data: Option<serde_json::Value>,
    pub created_at: String,
}

// --- Importa tu variable estática ---
use crate::GLOBAL_APP_HANDLE;

lazy_static! {
    static ref TASKS: Mutex<HashMap<String, TaskInfo>> = Mutex::new(HashMap::new());
}

// Funciones del singleton
pub fn add_task(label: &str, data: Option<serde_json::Value>) -> String {
    let id = Uuid::new_v4().to_string();
    let task = TaskInfo {
        id: id.clone(),
        label: label.to_string(),
        status: TaskStatus::Pending,
        progress: 0.0,
        message: "En espera...".into(),
        data,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    println!("Task created: {}", task.id);

    TASKS.lock().unwrap().insert(id.clone(), task.clone());

    // Emitir evento usando el AppHandle global
    println!(
        "Attempting to emit task-created event for task: {}",
        task.id
    );
    if let Ok(guard) = GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            if let Err(e) = app_handle.emit("task-created", task.clone()) {
                eprintln!("Failed to emit task-created event: {}", e);
            } else {
                println!("Successfully emitted task-created event.");
            }
        } else {
            eprintln!("Error: GLOBAL_APP_HANDLE is None when trying to emit task-created.");
        }
    } else {
        eprintln!("Error: Could not lock GLOBAL_APP_HANDLE mutex for task-created.");
    }

    id
}

pub fn update_task(
    id: &str,
    status: TaskStatus,
    progress: f32,
    message: &str,
    data: Option<serde_json::Value>,
) {
    let mut updated_task_clone = None;

    {
        let mut tasks = TASKS.lock().unwrap();
        if let Some(task) = tasks.get_mut(id) {
            task.status = status;
            task.progress = progress;
            task.message = message.to_string();
            task.data = data;
            updated_task_clone = Some(task.clone());
        }
    }

    if let Some(task_to_emit) = updated_task_clone {
        println!(
            "Attempting to emit task-updated event for task: {}",
            task_to_emit.id
        );
        if let Ok(guard) = GLOBAL_APP_HANDLE.lock() {
            if let Some(app_handle) = guard.as_ref() {
                if let Err(e) = app_handle.emit("task-updated", task_to_emit) {
                    eprintln!("Failed to emit task-updated event: {}", e);
                } else {
                    println!("Successfully emitted task-updated event.");
                }
            } else {
                eprintln!("Error: GLOBAL_APP_HANDLE is None when trying to emit task-updated.");
            }
        } else {
            eprintln!("Error: Could not lock GLOBAL_APP_HANDLE mutex for task-updated.");
        }
    }
}

pub fn get_all_tasks() -> Vec<TaskInfo> {
    TASKS.lock().unwrap().values().cloned().collect()
}

pub fn remove_task(id: &str) {
    TASKS.lock().unwrap().remove(id);

    println!("Task removed: {}", id);
    if let Ok(guard) = GLOBAL_APP_HANDLE.lock() {
        if let Some(app_handle) = guard.as_ref() {
            if let Err(e) = app_handle.emit("task-removed", id) {
                eprintln!("Failed to emit task-removed event: {}", e);
            } else {
                println!("Successfully emitted task-removed event.");
            }
        } else {
            eprintln!("Error: GLOBAL_APP_HANDLE is None when trying to emit task-removed.");
        }
    } else {
        eprintln!("Error: Could not lock GLOBAL_APP_HANDLE mutex for task-removed.");
    }
}
