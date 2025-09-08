use lazy_static::lazy_static;
use log::{debug, error, info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Wry};
use uuid::Uuid;

use crate::core::bootstrap_error::BootstrapError;

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
    // Early validation - check if task exists before attempting to update
    if !task_exists(id) {
        warn!("Attempted to update non-existent task: {}", id);
        return;
    }

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
                    warn!("Task {} was deleted while attempting to update it", id);
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

/// Update task with bootstrap error information
pub fn update_task_with_bootstrap_error(
    id: &str,
    error: &BootstrapError,
) {
    let error_data = serde_json::json!({
        "step": error.step,
        "category": error.category,
        "suggestion": error.suggestion,
        "technical_details": error.technical_details,
        "bootstrap_error": true
    });

    update_task(
        id,
        TaskStatus::Failed,
        0.0,
        &format!("Error en {}: {}", error.step, error.message),
        Some(error_data),
    );
}

/// Check for tasks that have been stuck in Pending state for too long and mark them as failed
/// This prevents tasks from getting permanently stuck in "En espera" state
pub fn cleanup_stuck_pending_tasks(max_pending_seconds: u64) -> usize {
    let cutoff_time = chrono::Utc::now() - chrono::Duration::seconds(max_pending_seconds as i64);
    let mut stuck_tasks = Vec::new();

    // First pass: identify stuck tasks
    match TASKS.lock() {
        Ok(tasks) => {
            for task in tasks.values() {
                if task.status == TaskStatus::Pending {
                    match chrono::DateTime::parse_from_rfc3339(&task.created_at) {
                        Ok(created_time) => {
                            if created_time.with_timezone(&chrono::Utc) < cutoff_time {
                                stuck_tasks.push(task.id.clone());
                            }
                        }
                        Err(_) => {
                            warn!(
                                "Could not parse created_at for task {}: {}",
                                task.id, task.created_at
                            );
                        }
                    }
                }
            }
        }
        Err(e) => {
            error!("Failed to lock TASKS mutex for stuck task cleanup: {}", e);
            return 0;
        }
    }

    // Second pass: update stuck tasks to failed status
    let stuck_count = stuck_tasks.len();
    for task_id in stuck_tasks {
        update_task(
            &task_id,
            TaskStatus::Failed,
            0.0,
            "La tarea se quedó bloqueada en estado de espera y fue cancelada automáticamente",
            Some(serde_json::json!({
                "auto_failed": true,
                "reason": "stuck_in_pending"
            })),
        );
        warn!("Auto-failed stuck pending task: {}", task_id);
    }

    if stuck_count > 0 {
        info!("Auto-failed {} tasks that were stuck in pending state", stuck_count);
    }

    stuck_count
}

/// Enhanced add_task that ensures tasks don't get stuck in pending state
/// Automatically transitions to Running state after a brief delay if still pending
pub fn add_task_with_auto_start(label: &str, data: Option<serde_json::Value>) -> String {
    let task_id = add_task(label, data);
    
    // Clone task_id for the async task
    let task_id_clone = task_id.clone();
    
    // Spawn a task to auto-start if still pending after 2 seconds
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        
        // Check if task is still pending and auto-start it
        if let Some(task) = get_task(&task_id_clone) {
            if task.status == TaskStatus::Pending {
                update_task(
                    &task_id_clone,
                    TaskStatus::Running,
                    0.0,
                    "Iniciando tarea...",
                    None,
                );
                info!("Auto-started pending task: {} ({})", task_id_clone, task.label);
            }
        }
    });
    
    task_id
}

/// Start a background task to periodically check for and cleanup stuck tasks
/// This should be called once when the application starts
pub fn start_periodic_task_cleanup() {
    tokio::spawn(async {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300)); // Check every 5 minutes
        
        loop {
            interval.tick().await;
            
            // Cleanup tasks stuck in pending state for more than 2 minutes
            let stuck_count = cleanup_stuck_pending_tasks(120);
            if stuck_count > 0 {
                warn!("Periodic cleanup: Auto-failed {} stuck pending tasks", stuck_count);
            }
            
            // Also cleanup old completed/failed tasks older than 1 hour
            let old_count = cleanup_old_tasks(3600);
            if old_count > 0 {
                info!("Periodic cleanup: Removed {} old completed tasks", old_count);
            }
        }
    });
    
    info!("Started periodic task cleanup service");
}
