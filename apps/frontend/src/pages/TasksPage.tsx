import { useState, useEffect } from "react";
import type { BackgroundTask, TaskExecution } from "../types/background";

function formatInterval(ms: number): string {
  if (ms >= 3600000) return `${ms / 3600000}h`;
  if (ms >= 60000) return `${ms / 60000}m`;
  return `${ms / 1000}s`;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [history, setHistory] = useState<TaskExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tasks")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load tasks (${r.status})`);
        return r.json();
      })
      .then(setTasks)
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to load tasks";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleTask = async (id: string) => {
    try {
      const toggleRes = await fetch(`/api/tasks/${id}/toggle`, {
        method: "POST",
      });
      if (!toggleRes.ok) throw new Error("Failed to toggle task");
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed to refresh tasks");
      const updated = await res.json();
      setTasks(updated);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to toggle task";
      setError(message);
    }
  };

  const viewHistory = async (id: string) => {
    setSelectedTask(id);
    try {
      const res = await fetch(`/api/tasks/${id}/history`);
      if (!res.ok) throw new Error("Failed to load history");
      const hist = await res.json();
      setHistory(hist);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load task history";
      setError(message);
    }
  };

  if (loading) {
    return (
      <div className="tasks-page">
        <h2>Background Tasks</h2>
        <p>Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="tasks-page">
      <h2>Background Tasks</h2>
      {error && <p className="tasks-error">{error}</p>}
      <div className="task-list">
        {tasks.length === 0 && !error && (
          <p className="tasks-empty">No background tasks configured.</p>
        )}
        {tasks.map((task) => (
          <div key={task.id} className="task-card">
            <div className="task-header">
              <h3>{task.name}</h3>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={task.enabled}
                  onChange={() => toggleTask(task.id)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
            <p className="task-description">{task.description}</p>
            <div className="task-meta">
              <span>Every {formatInterval(task.intervalMs)}</span>
              <span>Class {task.actionClass}</span>
              {task.lastRun && (
                <span>
                  Last run: {new Date(task.lastRun).toLocaleString()}
                </span>
              )}
            </div>
            <button
              onClick={() => viewHistory(task.id)}
              className="view-history-btn"
            >
              View History
            </button>
          </div>
        ))}
      </div>
      {selectedTask && history.length > 0 && (
        <div className="task-history">
          <h3>Execution History</h3>
          {history.map((exec, i) => (
            <div
              key={i}
              className={`history-item ${exec.success ? "success" : "error"}`}
            >
              <span>{new Date(exec.timestamp).toLocaleString()}</span>
              <span>{exec.durationMs}ms</span>
              <span>{exec.success ? "Success" : "Failed"}</span>
              {exec.error && <span className="error-msg">{exec.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
