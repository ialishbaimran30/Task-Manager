import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import CategoryModal from "../components/CategoryModal";
// import TagModal from "../components/TagModal";
import Sidebar from "../components/Sidebar";
import { showToast } from "../utils/toast";
import "../styles/taskform.css";

const DRAFT_KEY = "taskFormDraft";

function loadDraft() {
  try {
    const saved = sessionStorage.getItem(DRAFT_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function TaskForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const draft = !id ? loadDraft() : null;

  const [title, setTitle] = useState(draft?.title || "");
  const [description, setDescription] = useState(draft?.description || "");
  const [dueDate, setDueDate] = useState(draft?.dueDate || "");
  const [dueTime, setDueTime] = useState(draft?.dueTime || "");
  const [priority, setPriority] = useState(draft?.priority || "Medium");
  const [status, setStatus] = useState(draft?.status || "Pending");
  const [category, setCategory] = useState(draft?.category || "");
  const [categories, setCategories] = useState([]);
  const [showCategory, setShowCategory] = useState(false);
  const [hasSubtasks, setHasSubtasks] = useState(draft?.hasSubtasks || false);
  const [subtasks, setSubtasks] = useState(draft?.subtasks || []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")
  

  useEffect(() => {
    if (id) return; 
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ title, description, dueDate, dueTime, priority, status, category,})
    );
  }, [id, title, description, dueDate, dueTime, priority, status, category, ]);

  useEffect(() => {
    loadCategories();

    if (id) {
      api.get(`/tasks/api/${id}/`).then((res) => {
        const task = res.data;
        setTitle(task.title);
        setDescription(task.description);
        setDueDate(task.due_date);
        setDueTime(task.due_time || "");
        setPriority(task.priority);
        setStatus(task.status);
        setCategory(task.category);
        if (task.subtasks && task.subtasks.length > 0) {
          setHasSubtasks(true);
          setSubtasks(task.subtasks);
        }
      });
    }
  }, [id]);

  const addSubtaskItem = () => {
    if (!newSubtaskTitle.trim()) return;
    setSubtasks([...subtasks, { title: newSubtaskTitle.trim(), is_completed: false }]);
    setNewSubtaskTitle("");
  };

  const removeSubtaskItem = (index) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast("Please enter a title.", "error");
      return;
    }
    if (!dueDate) {
      showToast("Please pick a due date.", "error");
      return;
    }
    if (!category) {
      showToast("Please select a category before saving — it's required.", "error");
      return;
    }

    const taskData = {
      title,
      description,
      due_date: dueDate,
      due_time: dueTime || null,
      priority,
      status,
      category,
      subtasks: hasSubtasks ? subtasks : [],
    };

    if (id) {
      api.put(`/tasks/api/${id}/`, taskData).then(() => {
        showToast("Task updated");
        navigate("/tasks");
      }).catch((err) => {
        console.log(err.response?.data);
        showToast("Couldn't update task", "error");
      });
    } else {
      api.post("/tasks/api/", taskData).then(() => {
        sessionStorage.removeItem(DRAFT_KEY);
        showToast("Task saved");
        navigate("/tasks");
      }).catch((err) => {
        console.log(err.response?.data);
        showToast("Couldn't save task", "error");
      });
    }
  };

  const cancelForm = () => {
    sessionStorage.removeItem(DRAFT_KEY);
    navigate("/tasks");
  };

  const loadCategories = () => {
    api.get("/tasks/categories/").then((res) => {
      setCategories(res.data);
      if (!res.data.some((cat) => cat.id === Number(category))) {
        setCategory("");
      }
    }).catch(console.log);
  };

  

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main form-main">
        <div className="glass-panel-strong task-form-card">
          <h1>{id ? "Edit Task" : "Add Task"}</h1>
          <p className="form-sub">{id ? "Update the details below" : "Fill in the details for your new task"}</p>

          <form onSubmit={handleSubmit} className="task-form-grid">
            <label className="field field-full">
              <span>Title <span style={{ color: 'red' }}>*</span></span>
              <input type="text" placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="field field-full">
              <span>Description <span style={{ color: 'red' }}>*</span></span>
              <textarea placeholder="Add more detail..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>

            <label className="field">
              <span>Due date</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </label>

            <label className="field">
              <span>Deadline time </span>
              <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </label>

            <label className="field">
              <span>Priority</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </label>

            <label className="field">
              <span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </label>

            <label className="field">
              <span>Category <span style={{ color: 'red' }}>*</span></span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </label>
            {/* Properly Aligned Checkbox Row */}
            <div className="subtasks-toggle-field" onClick={() => setHasSubtasks(!hasSubtasks)}>
              <input
                type="checkbox"
                id="hasSubtasks"
                className="custom-form-checkbox"
                checked={hasSubtasks}
                onChange={(e) => setHasSubtasks(e.target.checked)}
              />
              <label htmlFor="hasSubtasks" className="subtask-toggle-label">
                Does this task contain subtasks?
              </label>
            </div>

            {/* Subtasks Checklist Section */}
            {hasSubtasks && (
              <div className="field-full subtasks-box">
                <span style={{ fontSize: "12.5px", fontWeight: "600", color: "var(--ink-soft)" }}>Subtasks Checklist</span>
                <div className="subtasks-input-row">
                  <input
                    type="text"
                    placeholder="Enter subtask name..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSubtaskItem();
                      }
                    }}
                  />
                  <button type="button" className="btn btn-primary" onClick={addSubtaskItem}>Add</button>
                </div>

                {subtasks.length > 0 && (
                  <ul className="subtasks-list">
                    {subtasks.map((st, index) => (
                      <li key={index} className="subtask-list-item">
                        <span>• {st.title}</span>
                        <button
                          type="button"
                          className="btn-remove-subtask"
                          onClick={() => removeSubtaskItem(index)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="form-quick-actions field-full">
              <button type="button" className="btn btn-ghost" onClick={() => setShowCategory(true)}>+ Add Category</button>
              <button type="button" className="btn btn-ghost" onClick={() => navigate("/categories")}>Manage Categories</button>
    
            </div>

            <div className="form-submit-row field-full">
              <button type="button" className="btn btn-ghost" onClick={cancelForm}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Task</button>
            </div>
          </form>

          <CategoryModal show={showCategory} onClose={() => setShowCategory(false)} refreshCategories={loadCategories} />
          
        </div>
      </main>
    </div>
  );
}

export default TaskForm;