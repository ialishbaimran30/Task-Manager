import { useEffect, useState } from "react";
import api from "../api/axios";
import { MONTH_NAMES } from "../config";
import GaugeRing from "../components/GaugeRing";
import "../styles/Expenses.css";
import "../styles/Budget.css";

const now = new Date();
const emptyForm = { monthly_budget: "", month: now.getMonth() + 1, year: now.getFullYear() };
const statusClass = (status) => `status-${status.replace(/\s+/g, "-")}`;

export default function Budget() {
  const [budgets, setBudgets] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const loadBudgets = async () => {
  const res = await api.get("/budgets/");
  const list = res.data.results || res.data;
  setBudgets(list);
  const summaryEntries = await Promise.all(
    list.map(async (b) => {
      const s = await api.get(`/budgets/${b.id}/summary/`);
      return [b.id, s.data];
    })
  );

  setSummaries(Object.fromEntries(summaryEntries));
};

  useEffect(() => {
    loadBudgets();
  }, []);

  const openAddModal = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setShowModal(true);
  };

  const openEditModal = (b) => {
    setForm({ monthly_budget: b.monthly_budget, month: b.month, year: b.year });
    setEditingId(b.id);
    setError("");
    setShowModal(true);
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");
  try {
    if (editingId) {
      await api.put(`/budgets/${editingId}/`, form);
    } else {
      await api.post("/budgets/", form);
    }
    setShowModal(false);
    setForm(emptyForm);
    setEditingId(null);
    loadBudgets();
  } catch (err) {
    const data = err.response?.data;
    setError(
      typeof data === "object"
        ? Object.values(data).flat().join(" ")
        : "Something went wrong."
    );
  }
};

  const handleDelete = async (id) => {
  if (!window.confirm("Delete this budget?")) return;
  await api.delete(`/budgets/${id}/`);
  loadBudgets();
};

  return (
    <div>
      <div className="toolbar">
        <div />
        <button className="btn btn-primary" onClick={openAddModal}>+ Set budget</button>
      </div>

      {budgets.length === 0 ? (
        <div className="empty-state">No budgets set yet. Add one to start tracking limits.</div>
      ) : (
        <div className="budget-grid">
          {budgets.map((b) => {
            const s = summaries[b.id];
            return (
              <div className="budget-card glass" key={b.id}>
                <div className="budget-card-head">
                  <h4>{MONTH_NAMES[b.month - 1]} {b.year}</h4>
                  <div className="row-actions">
                    <button className="icon-btn" onClick={() => openEditModal(b)} title="Edit">✎</button>
                    <button className="icon-btn" onClick={() => handleDelete(b.id)} title="Delete">✕</button>
                  </div>
                </div>
                <div className="budget-card-body">
                  {s && <GaugeRing percentage={s.used_percentage} status={s.status} size={100} />}
                  <div className="budget-card-figures">
                    <span className="label">Budget</span>
                    <strong className="mono">Rs {Number(b.monthly_budget).toLocaleString()}</strong>
                    {s && (
                      <>
                        <span className="label" style={{ marginTop: "0.4rem" }}>Spent</span>
                        <strong className="mono">Rs {Number(s.spent).toLocaleString()}</strong>
                        <span className={`status-pill ${statusClass(s.status)}`}>{s.status}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card glass-strong" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? "Edit budget" : "Set monthly budget"}</h3>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Monthly budget (Rs)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  name="monthly_budget"
                  value={form.monthly_budget}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-row">
                <div className="field">
                  <label>Month</label>
                  <select name="month" value={form.month} onChange={handleChange}>
                    {MONTH_NAMES.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label>Year</label>
                  <input
                    type="number"
                    name="year"
                    min="2025"
                    value={form.year}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              {error && <p className="error-text">{error}</p>}

              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingId ? "Save changes" : "Save budget"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}