import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Sidebar from "../components/Sidebar";
import ProgressBar from "../components/ProgressBar";
import NotificationBell from "../components/NotificationBell";
import { isToday, isUpcoming, formatFriendlyDate, statusProgress } from "../utils/schedule";
import { useTaskReminders } from "../utils/useTaskReminders";
import "../styles/dashboard.css";

function ProgressRing({ percent, size = 64 }) {
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="progress-ring">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(34,31,43,0.1)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke="var(--panel-dark)" strokeWidth={stroke} fill="none"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="53%" textAnchor="middle" className="ring-label">{percent}%</text>
    </svg>
  );
}

const PRIORITY_COLOR = {
  High: "var(--accent-coral)",
  Medium: "var(--accent-gold)",
  Low: "var(--accent-blue)",
};

function Dashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const username = localStorage.getItem("username") || "there";

  const fetchTasks = () => {
    api.get("/tasks/api/").then((res) => setTasks(res.data)).catch(console.log);
  };

  useEffect(() => {
    fetchTasks();
    api.get("/tasks/categories/").then((res) => setCategories(res.data)).catch(console.log);
  }, []);

  useTaskReminders(tasks);

  const calculateTaskProgress = (task) => {
    if (task.subtasks && task.subtasks.length > 0) {
      const completedSubtasks = task.subtasks.filter((st) => st.is_completed).length;
      return Math.round((completedSubtasks / task.subtasks.length) * 100);
    }
    return task.progress ?? statusProgress(task.status);
  };

  // Toggle Subtask Checked State & Sync Progress UI
  const handleToggleSubtask = (taskId, subtaskId, currentStatus) => {
    const updatedStatus = !currentStatus;

    // 1. Optimistic UI Update (Immediate response on UI)
    setTasks((prevTasks) =>
      prevTasks.map((t) => {
        if (t.id === taskId) {
          const newSubtasks = t.subtasks.map((st) =>
            st.id === subtaskId ? { ...st, is_completed: updatedStatus } : st
          );
          
          // Recalculate status automatically
          const completedCount = newSubtasks.filter((s) => s.is_completed).length;
          let newStatus = t.status;
          if (completedCount === newSubtasks.length) newStatus = "Completed";
          else if (completedCount > 0) newStatus = "In Progress";
          else newStatus = "Pending";

          return { ...t, subtasks: newSubtasks, status: newStatus };
        }
        return t;
      })
    );

    // 2. Persistent Backend Update
    api
      .patch(`/tasks/subtasks/${subtaskId}/`, { is_completed: updatedStatus })
      .then(() => fetchTasks())
      .catch((err) => {
        console.error("Failed to update subtask state", err);
        fetchTasks(); // Revert back if API fails
      });
  };

  const pending = tasks.filter((t) => t.status === "Pending");
  const completed = tasks.filter((t) => t.status === "Completed");

  // Overall Completion Rate across ALL tasks
  const totalPercentageSum = tasks.reduce((acc, task) => acc + calculateTaskProgress(task), 0);
  const completionRate = tasks.length ? Math.round(totalPercentageSum / tasks.length) : 0;

  const todayTasks = tasks.filter((t) => isToday(t.due_date));
  const upcomingTasks = tasks
    .filter((t) => isUpcoming(t.due_date))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main dash-main" style={{ padding: "32px", maxWidth: "1200px", margin: "0 auto" }}>
        
        <div className="dash-topbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#0f172a", margin: 0 }}>Dashboard</h1>
          <NotificationBell />
        </div>
        <p className="dash-welcome" style={{ color: "#64748b", margin: "0 0 24px 0", fontSize: "15px" }}>Welcome back, {username}</p>

       
        <div className="dash-grid" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px", marginBottom: "24px" }}>
          
         
          <section className="glass-panel dash-card" style={{ padding: "20px", borderRadius: "14px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
            <div className="dash-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#1e293b" }}>Categories</h3>
              <button className="link-btn" onClick={() => navigate("/categories")} style={{ background: "none", border: "none", color: "#4f46e5", cursor: "pointer", fontWeight: "600" }}>Manage</button>
            </div>
            {categories.length === 0 ? (
              <p className="empty-note" style={{ color: "#94a3b8", fontSize: "14px", fontStyle: "italic", margin: 0 }}>No categories yet</p>
            ) : (
              <ul className="simple-list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                {categories.slice(0, 5).map((c) => (
                  <li key={c.id} style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: "8px", fontSize: "14px", color: "#334155", border: "1px solid #f1f5f9" }}>{c.name}</li>
                ))}
              </ul>
            )}
          </section>

          {/* Weekly Stats Overview */}
          <section className="glass-panel-strong dash-card dash-overview" style={{ padding: "20px", borderRadius: "14px", background: "#ffffff", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", color: "#1e293b" }}>This week</h3>
              <div className="overview-stats" style={{ display: "flex", gap: "24px" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="stat-num" style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a" }}>{tasks.length}</span>
                  <span className="stat-label" style={{ fontSize: "12px", color: "#64748b" }}>Total tasks</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="stat-num" style={{ fontSize: "24px", fontWeight: "700", color: "#f59e0b" }}>{pending.length}</span>
                  <span className="stat-label" style={{ fontSize: "12px", color: "#64748b" }}>Pending</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span className="stat-num" style={{ fontSize: "24px", fontWeight: "700", color: "#10b981" }}>{completed.length}</span>
                  <span className="stat-label" style={{ fontSize: "12px", color: "#64748b" }}>Completed</span>
                </div>
              </div>
            </div>
            
            <div className="overview-ring" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <ProgressRing percent={completionRate} size={64} />
              <span className="overview-ring-caption" style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>Completion rate</span>
            </div>
          </section>
        </div>

        {/* Schedule Grid */}
        <div className="dash-schedule-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
          
          {/* Today's Schedule */}
          <section className="glass-panel-strong dash-card schedule-card" style={{ padding: "20px", borderRadius: "14px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
            <div className="dash-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#1e293b" }}>Today's Schedule</h3>
              <span className="schedule-date" style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>{formatFriendlyDate(new Date().toISOString())}</span>
            </div>
            {todayTasks.length === 0 ? (
              <p className="empty-note" style={{ color: "#94a3b8", fontSize: "14px", fontStyle: "italic", margin: 0 }}>Nothing due today 🎉</p>
            ) : (
              <div className="schedule-list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {todayTasks.map((task) => (
                  <div className="schedule-row" key={task.id} onClick={() => navigate(`/tasks/edit/${task.id}`)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", background: "#f8fafc", borderRadius: "8px", cursor: "pointer", border: "1px solid #f1f5f9" }}>
                    <span className="chip" style={{ background: PRIORITY_COLOR[task.priority] || "var(--accent-blue)", color: "#fff", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700" }}>
                      {task.priority}
                    </span>
                    <span className="schedule-title" style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: "#1e293b" }}>{task.title}</span>
                    <span className="schedule-status" style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>{task.status}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming Schedule */}
          <section className="glass-panel-strong dash-card schedule-card" style={{ padding: "20px", borderRadius: "14px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
            <div className="dash-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#1e293b" }}>Upcoming Schedule</h3>
              <span className="schedule-date" style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>Next 7 days</span>
            </div>
            {upcomingTasks.length === 0 ? (
              <p className="empty-note" style={{ color: "#94a3b8", fontSize: "14px", fontStyle: "italic", margin: 0 }}>Nothing coming up this week</p>
            ) : (
              <div className="schedule-list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {upcomingTasks.slice(0, 6).map((task) => (
                  <div className="schedule-row" key={task.id} onClick={() => navigate(`/tasks/edit/${task.id}`)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", background: "#f8fafc", borderRadius: "8px", cursor: "pointer", border: "1px solid #f1f5f9" }}>
                    <span className="chip" style={{ background: PRIORITY_COLOR[task.priority] || "var(--accent-blue)", color: "#fff", padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "700" }}>
                      {task.priority}
                    </span>
                    <span className="schedule-title" style={{ flex: 1, fontSize: "14px", fontWeight: "500", color: "#1e293b" }}>{task.title}</span>
                    <span className="schedule-due" style={{ fontSize: "12px", color: "#64748b", fontWeight: "500" }}>{formatFriendlyDate(task.due_date)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* All Tasks & Progress Section */}
        <section className="glass-panel-strong dash-tasks" style={{ padding: "20px", borderRadius: "14px", background: "#ffffff", border: "1px solid #e2e8f0" }}>
          <div className="dash-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ margin: 0, fontSize: "18px", color: "#1e293b" }}>All tasks &amp; progress</h3>
            <button className="link-btn" onClick={() => navigate("/tasks")} style={{ background: "none", border: "none", color: "#4f46e5", cursor: "pointer", fontWeight: "600" }}>Go to task board →</button>
          </div>

          {tasks.length === 0 ? (
            <p className="empty-note" style={{ color: "#94a3b8", fontSize: "14px", fontStyle: "italic", margin: 0 }}>No tasks yet — add your first one.</p>
          ) : (
            <div className="progress-task-list" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {tasks.map((task) => {
                const taskProg = calculateTaskProgress(task);
                return (
                  <div className="progress-task-wrapper" key={task.id} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
                    
                    {/* Main Task Info Row */}
                    <div className="progress-task-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: task.subtasks?.length ? "12px" : "0" }}>
                      
                      <div className="progress-task-main" onClick={() => navigate(`/tasks/edit/${task.id}`)} style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, cursor: "pointer" }}>
                        <span className="chip" style={{ background: PRIORITY_COLOR[task.priority] || "var(--accent-blue)", color: "#fff", padding: "3px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "700" }}>
                          {task.priority}
                        </span>
                        <span className="progress-task-title" style={{ fontSize: "15px", fontWeight: "600", color: "#0f172a", flex: 1 }}>{task.title}</span>
                        
                        <select
                          className="progress-task-status-select"
                          value={task.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const updatedTask = {
                              ...task,
                              status: e.target.value,
                            };
                            api
                              .put(`/tasks/api/${task.id}/`, updatedTask)
                              .then(() => fetchTasks())
                              .catch(console.log);
                          }}
                          style={{ width: "110px", padding: "5px 8px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px", color: "#334155", fontWeight: "500", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                        >
                          <option value="Pending">Pending</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>

                      <div className="progress-task-bar" style={{ minWidth: "140px" }}>
                        <ProgressBar percent={taskProg} status={task.status} />
                      </div>
                    </div>

                    {/* Interactive Subtasks Checklist */}
                    {task.subtasks && task.subtasks.length > 0 && (
                      <div className="subtasks-checklist-container" style={{ display: "flex", flexDirection: "column", gap: "8px", paddingTop: "10px", borderTop: "1px solid #e2e8f0" }}>
                        {task.subtasks.map((st) => (
                          <div 
                            key={st.id} 
                            className={`subtask-item-row ${st.is_completed ? "completed" : ""}`}
                            onClick={() => handleToggleSubtask(task.id, st.id, st.is_completed)}
                            style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", padding: "4px 8px", borderRadius: "6px", transition: "0.2s" }}
                          >
                            <input
                              type="checkbox"
                              className="custom-checkbox"
                              checked={st.is_completed}
                              onChange={() => {}} // State handled by outer row onClick
                              style={{ accentColor: "#4f46e5", width: "16px", height: "16px", cursor: "pointer" }}
                            />
                            <span className="subtask-label-text" style={{ fontSize: "13px", color: st.is_completed ? "#94a3b8" : "#334155", textDecoration: st.is_completed ? "line-through" : "none" }}>
                              {st.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;