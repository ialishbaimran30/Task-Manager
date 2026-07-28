import { useEffect, useState } from "react";
import api from "../api/axios";
import { EXPENSES_PREFIX, PAYMENT_METHODS } from "../config";
import "../styles/Expenses.css";

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const emptyForm = {
  title: "",
  amount: "",
  category: "",
  date: getTodayString(),
  payment_method: "Cash",
  description: "",
  favorite: false,
  is_tracked_in_insights: false,
  is_recurring: false,
  frequency: "Monthly",
  next_due_date: "",
};

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFilter, setDateFilter] = useState(""); 
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [newCategory, setNewCategory] = useState("");
  const [error, setError] = useState("");

  const loadCategories = async () => {
    try {
      const res = await api.get(`${EXPENSES_PREFIX}/categories/`);
      setCategories(res.data.results || res.data);
    } catch (err) {
      console.error("Failed to load categories", err);
    }
  };

  const loadExpenses = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (categoryFilter) params.append("category", categoryFilter);
      if (dateFilter) params.append("date", dateFilter);
      params.append("ordering", "-date");
      const res = await api.get(`${EXPENSES_PREFIX}/expenses/?${params.toString()}`);
      setExpenses(res.data.results || res.data);
    } catch (err) {
      console.error("Failed to load expenses", err);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter,dateFilter]);

  const openAddModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setShowModal(true);
  };

  const openEditModal = (exp) => {
    setForm({
      title: exp.title || "",
      amount: exp.amount || "",
      category: exp.category || "",
      date: exp.date || new Date().toISOString().slice(0, 10),
      payment_method: exp.payment_method || "Cash",
      description: exp.description || "",
      favorite: Boolean(exp.favorite),
      is_tracked_in_insights: Boolean(exp.is_tracked_in_insights),
      is_recurring: Boolean(exp.is_recurring),
      frequency: exp.frequency || "Monthly",
      next_due_date: exp.next_due_date || "",
    });
    setEditingId(exp.id);
    setError("");
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      const res = await api.post(`${EXPENSES_PREFIX}/categories/`, { name: newCategory.trim() });
      setCategories((prev) => [...prev, res.data]);
      setForm((prev) => ({ ...prev, category: res.data.id }));
      setNewCategory("");
    } catch (err) {
      console.error("Failed to add category", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const payload = {
        ...form,
        category: form.category || null,
        recurrence_type: form.frequency ? form.frequency.toLowerCase() : "monthly",
        frequency: form.frequency || "Monthly",
      };

      if (editingId) {
        await api.put(`${EXPENSES_PREFIX}/expenses/${editingId}/`, payload);
      } else {
        await api.post(`${EXPENSES_PREFIX}/expenses/`, payload);
      }

      setShowModal(false);
      loadExpenses();
    } catch (err) {
      const data = err.response?.data;
      setError(
        typeof data === "object"
          ? Object.entries(data)
              .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(" ") : val}`)
              .join(" | ")
          : "Something went wrong."
      );
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await api.delete(`${EXPENSES_PREFIX}/expenses/${id}/`);
      loadExpenses();
    } catch (err) {
      console.error("Failed to delete expense", err);
    }
  };

  const toggleFavorite = async (exp) => {
    try {
      await api.patch(`${EXPENSES_PREFIX}/expenses/${exp.id}/`, { favorite: !exp.favorite });
      loadExpenses();
    } catch (err) {
      console.error("Failed to toggle favorite", err);
    }
  };

  const toggleRecurring = async (exp) => {
    try {
      await api.patch(`${EXPENSES_PREFIX}/expenses/${exp.id}/`, { is_recurring: !exp.is_recurring });
      loadExpenses();
    } catch (err) {
      console.error("Failed to toggle recurring status", err);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-filters">
          <input
            placeholder="Search title or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="date-filter-wrapper">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              title="Filter by specific date"
            />
            {dateFilter && (
              <button 
                type="button" 
                className="clear-date-btn" 
                onClick={() => setDateFilter("")}
                title="Clear date filter"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>+ Add expense</button>
      </div>

      <div className="expense-table glass">
        {/* Table Header (Exact 6 Columns) */}
        <div className="expense-row header">
          <span>TITLE</span>
          <span>RECURRING</span>
          <span>CATEGORY</span>
          <span>DATE</span>
          <span>PAYMENT</span>
          <span></span> {/* Action buttons space */}
        </div>

        {expenses.length === 0 ? (
          <div className="empty-state">No expenses found.</div>
        ) : (
          expenses.map((exp) => (
            <div className="expense-row" key={exp.id}>
              {/* 1. Title */}
              <div className="expense-title">
                <strong className="mono">Rs {Number(exp.amount).toLocaleString()}</strong>
                <span>
                  {exp.title}{" "}
                  {exp.is_tracked_in_insights && <span title="Tracked in Insights">💡</span>}
                </span>
              </div>

              {/* 2. Recurring */}
              <div>
                <span 
                  onClick={() => toggleRecurring(exp)}
                  style={{ 
                    cursor: "pointer", 
                    userSelect: "none",
                    opacity: exp.is_recurring ? 1 : 0.6,
                    fontWeight: exp.is_recurring ? "600" : "normal"
                  }}
                  title="Click to toggle recurring status"
                >
                  {exp.is_recurring ? "Recurring" : "Non-Recurring"}
                </span>
              </div>

              {/* 3. Category */}
              <div>
                <span className="tag">{exp.category_name || "Uncategorized"}</span>
              </div>

              {/* 4. Date */}
              <span>{exp.date}</span>

              {/* 5. Payment */}
              <span>{exp.payment_method}</span>

              {/* 6. Action Buttons */}
              <div className="row-actions">
                <button
                  className={`icon-btn fav ${exp.favorite ? "active" : ""}`}
                  onClick={() => toggleFavorite(exp)}
                  title="Favorite"
                >
                  ★
                </button>
                <button className="icon-btn" onClick={() => openEditModal(exp)} title="Edit">
                  ✎
                </button>
                <button className="icon-btn" onClick={() => handleDelete(exp.id)} title="Delete">
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card glass-strong" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? "Edit expense" : "Add expense"}</h3>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Title</label>
                <input name="title" value={form.title} onChange={handleChange} required />
              </div>

              <div className="form-row">
                <div className="field">
                  <label>Amount (Rs)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    name="amount"
                    value={form.amount}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="field">
                  <label>Date</label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label>Category</label>
                <select name="category" value={form.category} onChange={handleChange}>
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="category-add-row">
                <input
                  placeholder="New category name"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
                <button type="button" className="btn btn-ghost" onClick={handleAddCategory}>Add</button>
              </div>

              <div className="field">
                <label>Payment method</label>
                <select name="payment_method" value={form.payment_method} onChange={handleChange}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Description (optional)</label>
                <textarea name="description" value={form.description} onChange={handleChange} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", margin: "1rem 0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontSize: "0.9rem" }}>
                  <input
                    type="checkbox"
                    name="favorite"
                    checked={form.favorite}
                    onChange={handleChange}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  Mark as favorite
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontSize: "0.9rem" }}>
                  <input
                    type="checkbox"
                    name="is_tracked_in_insights"
                    checked={form.is_tracked_in_insights}
                    onChange={handleChange}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  Track this expense in Smart Insights 💡
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", fontSize: "0.9rem" }}>
                  <input
                    type="checkbox"
                    name="is_recurring"
                    checked={form.is_recurring}
                    onChange={handleChange}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  Make this a Recurring Expense
                </label>
              </div>

              {form.is_recurring && (
                <>
                  <div className="field">
                    <label>Frequency</label>
                    <select name="frequency" value={form.frequency} onChange={handleChange}>
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Yearly">Yearly</option>
                    </select>
                  </div>

                  
                </>
              )}

              {error && <p className="error-text">{error}</p>}

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? "Save changes" : "Add expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}