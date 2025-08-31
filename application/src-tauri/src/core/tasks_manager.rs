use lazy_static::lazy_static;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Wry};
use uuid::Uuid;

// --- TaskStatus y TaskInfo permanecen iguales ---

#[derive(Clone, Serialize, Deserialize, Debug, PartialEq)]
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
    static ref TASKS: Arc<Mutex<HashMap<String, TaskInfo>>> = Arc::new(Mutex::new(HashMap::new()));
}

// Helper function for reliable event emission with retry mechanism
fn emit_event_with_retry(
    event_name: &str,
    payload: impl Clone + Serialize + std::fmt::Debug,
    max_retries: u32,
) -> bool {
    for attempt in 0..=max_retries {
        match GLOBAL_APP_HANDLE.lock() {
            Ok(guard) => {
                if let Some(app_handle) = guard.as_ref() {
                    match app_handle.emit(event_name, payload.clone()) {
                        Ok(_) => {
                            debug!(
                                "Successfully emitted {} event on attempt {}",
                                event_name,
                                attempt + 1
                            );
                            return true;
                        }
                        Err(e) => {
                            warn!(
                                "Failed to emit {} event on attempt {}: {}",
                                event_name,
                                attempt + 1,
                                e
                            );
                        }
                    }
                } else {
                    warn!(
                        "GLOBAL_APP_HANDLE is None when trying to emit {} on attempt {}",
                        event_name,
                        attempt + 1
                    );
                }
            }
            Err(e) => {
                warn!(
                    "Could not lock GLOBAL_APP_HANDLE mutex for {} on attempt {}: {}",
                    event_name,
                    attempt + 1,
                    e
                );
            }
        }

        // Wait before retrying, except on the last attempt
        if attempt < max_retries {
            thread::sleep(Duration::from_millis(50 * (attempt + 1) as u64));
        }
    }

    error!(
        "Failed to emit {} event after {} attempts",
        event_name,
        max_retries + 1
    );
    false
}

// Helper function to validate task state transitions
fn is_valid_transition(current: &TaskStatus, new: &TaskStatus) -> bool {
    match (current, new) {
        // From Pending
        (TaskStatus::Pending, TaskStatus::Running) => true,
        (TaskStatus::Pending, TaskStatus::Cancelled) => true,
        (TaskStatus::Pending, TaskStatus::Failed) => true,

        // From Running
        (TaskStatus::Running, TaskStatus::Completed) => true,
        (TaskStatus::Running, TaskStatus::Failed) => true,
        (TaskStatus::Running, TaskStatus::Cancelled) => true,

        // From final states (no transitions allowed)
        (TaskStatus::Completed, _) => false,
        (TaskStatus::Failed, _) => false,
        (TaskStatus::Cancelled, _) => false,

        // Same state is always valid (for progress updates)
        (a, b) if a == b => true,

        // Any other transition is invalid
        _ => false,
    }
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

    info!("Creating task: {} ({})", task.id, task.label);

    // Use proper error handling for mutex lock
    match TASKS.lock() {
        Ok(mut tasks) => {
            tasks.insert(id.clone(), task.clone());
        }
        Err(e) => {
            error!("Failed to lock TASKS mutex when adding task {}: {}", id, e);
            return id; // Return early if we can't store the task
        }
    }

    // Emit event with retry mechanism
    if !emit_event_with_retry("task-created", &task, 2) {
        warn!("Failed to emit task-created event for task: {}", task.id);
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
    let updated_task = match TASKS.lock() {
        Ok(mut tasks) => {
            match tasks.get_mut(id) {
                Some(task) => {
                    // Validate state transition
                    if !is_valid_transition(&task.status, &status) {
                        warn!(
                            "Invalid state transition for task {}: {:?} -> {:?}",
                            id, task.status, status
                        );
                        return;
                    }

                    // Validate progress bounds
                    let bounded_progress = progress.clamp(0.0, 100.0);
                    if bounded_progress != progress {
                        warn!(
                            "Progress value {} clamped to {} for task {}",
                            progress, bounded_progress, id
                        );
                    }

                    task.status = status;
                    task.progress = bounded_progress;
                    task.message = message.to_string();

                    // Merge data instead of replacing
                    if let Some(new_data) = data {
                        if let Some(existing) = &mut task.data {
                            if let (
                                serde_json::Value::Object(existing_obj),
                                serde_json::Value::Object(new_obj),
                            ) = (existing, &new_data)
                            {
                                for (k, v) in new_obj {
                                    existing_obj.insert(k.clone(), v.clone());
                                }
                            } else {
                                task.data = Some(new_data);
                            }
                        } else {
                            task.data = Some(new_data);
                        }
                    }

                    debug!(
                        "Updated task {}: status={:?}, progress={:.1}%, message='{}'",
                        id, task.status, task.progress, task.message
                    );

                    Some(task.clone())
                }
                None => {
                    warn!("Attempted to update non-existent task: {}", id);
                    None
                }
            }
        }
        Err(e) => {
            error!(
                "Failed to lock TASKS mutex when updating task {}: {}",
                id, e
            );
            None
        }
    };

    // Emit event if task was successfully updated
    if let Some(task_to_emit) = updated_task {
        if !emit_event_with_retry("task-updated", &task_to_emit, 2) {
            warn!(
                "Failed to emit task-updated event for task: {}",
                task_to_emit.id
            );
        }
    }
}

pub fn get_all_tasks() -> Vec<TaskInfo> {
    match TASKS.lock() {
        Ok(tasks) => {
            let task_list: Vec<TaskInfo> = tasks.values().cloned().collect();
            debug!("Retrieved {} tasks", task_list.len());
            task_list
        }
        Err(e) => {
            error!("Failed to lock TASKS mutex when getting all tasks: {}", e);
            Vec::new()
        }
    }
}

pub fn remove_task(id: &str) -> bool {
    let removed = match TASKS.lock() {
        Ok(mut tasks) => match tasks.remove(id) {
            Some(_) => {
                info!("Removed task: {}", id);
                true
            }
            None => {
                warn!("Attempted to remove non-existent task: {}", id);
                false
            }
        },
        Err(e) => {
            error!(
                "Failed to lock TASKS mutex when removing task {}: {}",
                id, e
            );
            false
        }
    };

    if removed {
        if !emit_event_with_retry("task-removed", id, 2) {
            warn!("Failed to emit task-removed event for task: {}", id);
        }
    }

    removed
}

// New function to get a specific task by ID
pub fn get_task(id: &str) -> Option<TaskInfo> {
    match TASKS.lock() {
        Ok(tasks) => tasks.get(id).cloned(),
        Err(e) => {
            error!("Failed to lock TASKS mutex when getting task {}: {}", id, e);
            None
        }
    }
}

// New function to check if a task exists
pub fn task_exists(id: &str) -> bool {
    match TASKS.lock() {
        Ok(tasks) => tasks.contains_key(id),
        Err(e) => {
            error!(
                "Failed to lock TASKS mutex when checking task existence {}: {}",
                id, e
            );
            false
        }
    }
}

// Tauri command to expose get_all_tasks to frontend for synchronization
#[tauri::command]
pub fn get_all_tasks_command() -> Vec<TaskInfo> {
    get_all_tasks()
}

// Function to clean up completed/failed tasks older than specified duration
pub fn cleanup_old_tasks(max_age_seconds: u64) -> usize {
    let cutoff_time = chrono::Utc::now() - chrono::Duration::seconds(max_age_seconds as i64);

    match TASKS.lock() {
        Ok(mut tasks) => {
            let initial_count = tasks.len();
            tasks.retain(|_, task| {
                // Keep running and pending tasks regardless of age
                if matches!(task.status, TaskStatus::Running | TaskStatus::Pending) {
                    return true;
                }

                // Parse created_at and check age for completed/failed tasks
                match chrono::DateTime::parse_from_rfc3339(&task.created_at) {
                    Ok(created_time) => created_time.with_timezone(&chrono::Utc) > cutoff_time,
                    Err(_) => {
                        // If we can't parse the time, keep the task to be safe
                        warn!(
                            "Could not parse created_at for task {}: {}",
                            task.id, task.created_at
                        );
                        true
                    }
                }
            });

            let removed_count = initial_count - tasks.len();
            if removed_count > 0 {
                info!("Cleaned up {} old completed/failed tasks", removed_count);
            }
            removed_count
        }
        Err(e) => {
            error!("Failed to lock TASKS mutex for cleanup: {}", e);
            0
        }
    }
}

// Function to force emit all current tasks (useful for frontend recovery)
pub fn emit_all_tasks() -> bool {
    match TASKS.lock() {
        Ok(tasks) => {
            let mut success_count = 0;
            let total_count = tasks.len();

            for task in tasks.values() {
                if emit_event_with_retry("task-updated", task, 1) {
                    success_count += 1;
                }
            }

            info!("Re-emitted {}/{} tasks", success_count, total_count);
            success_count == total_count
        }
        Err(e) => {
            error!("Failed to lock TASKS mutex for emit_all_tasks: {}", e);
            false
        }
    }
}

// Tauri command to trigger task re-emission (for frontend recovery)
#[tauri::command]
pub fn resync_tasks_command() -> bool {
    info!("Frontend requested task resync");
    emit_all_tasks()
}
