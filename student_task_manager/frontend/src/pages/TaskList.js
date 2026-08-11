import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Sidebar from "../components/Sidebar";
import { showToast } from "../utils/toast";
import "../styles/tasklist.css";

const PRIORITY_COLOR = {
  High: "var(--accent-coral)",
  Medium: "var(--accent-gold)",
  Low: "var(--accent-blue)",
};

function isOverdue(task) {
  if (!task.due_date || task.status === "Completed") return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return new Date(task.due_date) < startOfToday;
}

function TaskCard({ task, onEdit, onDelete, onUpdate }) {
  const overdue = isOverdue(task);
  return (
    <div className={`kanban-card ${overdue ? "kanban-card-overdue" : ""}`}>
      <div className="kanban-card-top">
        <span
          className="chip"
          style={{ background: PRIORITY_COLOR[task.priority] || "var(--accent-blue)" }}
        >
          {task.priority}
        </span>
        {task.due_date && (
          <span className={`kanban-due ${overdue ? "kanban-due-overdue" : ""}`}>
            {overdue ? "Overdue · " : ""}{task.due_date}
          </span>
        )}
      </div>

      <h4>{task.title}</h4>
      {task.description && <p className="kanban-desc">{task.description}</p>}

      <div className="kanban-card-footer">
        
        <div className="kanban-card-actions">
          <button className="icon-btn" onClick={() => onEdit(task.id)} title="Edit">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M4 20h4L18.5 9.5a2.1 2.1 0 00-3-3L5 17v3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
            </svg>
          </button>
          <button className="icon-btn icon-btn-danger" onClick={() => onDelete(task.id)} title="Delete">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m1 0-1 13a1 1 0 01-1 1H9a1 1 0 01-1-1L7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const loadTasks = () => {
    api
      .get("/tasks/api/")
      .then((response) =>{
        // Sort by id ascending to maintain original creation order
        const sortedTasks = response.data.sort((a, b) => a.id - b.id);
        setTasks(sortedTasks);
      })
      .catch((error) => console.log(error));
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const deleteTask = (id) => {
    if (!window.confirm("Delete this task?")) return;
    api.delete(`/tasks/api/${id}/`).then(() => {
      setTasks(tasks.filter((task) => task.id !== id));
      showToast("Task deleted");
    }).catch(() => {
      showToast("Couldn't delete task", "error");
    });
  };

  const updateTask = (updated) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
    .sort((a, b) => a.id - b.id));
  };

 
const filteredTasks = tasks.filter((t) => {
  const query = searchQuery.trim().toLowerCase();
  const matchTitle = t.title.toLowerCase().includes(query);
  const matchDate = t.due_date ? t.due_date.toLowerCase().includes(query) : false;

  return matchTitle || matchDate;
});

  const pending = filteredTasks.filter((t) => t.status === "Pending");
  const completed = filteredTasks.filter((t) => t.status === "Completed");
  const overdueCount = tasks.filter(isOverdue).length;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <div className="task-header">
          <div>
            <h1>My Tasks</h1>
            <p className="task-sub">
              {tasks.length} total &middot; {pending.length} pending &middot; {completed.length} done
              {overdueCount > 0 && <span className="overdue-badge"> &middot; {overdueCount} overdue</span>}
            </p>
          </div>
          <div className="task-header-actions">
            <div className="search-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={() => navigate("/tasks/add")}>
              + Add Task
            </button>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="glass-panel empty-board">
            <h3>No tasks yet</h3>
            <p>Add your first task to see it here.</p>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="glass-panel empty-board">
            <h3>No matches</h3>
            <p>No tasks found for "{searchQuery}"</p>
          </div>
        ) : (
          <div className="kanban-board">
            <div className="kanban-column">
              <div className="kanban-column-head">
                <span className="kanban-dot" style={{ background: "var(--accent-gold)" }} />
                <h3>To Do</h3>
                <span className="kanban-count">{pending.length}</span>
              </div>
              <div className="kanban-column-body">
                {pending.length === 0 ? (
                  <div className="column-empty-state">
                    <p>No pending tasks</p>
                   
                  </div>
                ) : (
                  pending.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={(id) => navigate(`/tasks/edit/${id}`)}
                      onDelete={deleteTask}
                      onUpdate={updateTask}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="kanban-column">
              <div className="kanban-column-head">
                <span className="kanban-dot" style={{ background: "var(--accent-green)" }} />
                <h3>Done</h3>
                <span className="kanban-count">{completed.length}</span>
              </div>
              <div className="kanban-column-body">
                {completed.length === 0 ? (
                  <div className="column-empty-state">
                    
                    <p>Completed tasks will appear here.</p>
                  </div>
                ) : (
                  completed.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={(id) => navigate(`/tasks/edit/${id}`)}
                      onDelete={deleteTask}
                      onUpdate={updateTask}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default TaskList;