// src/pages/Dashboard.js
import { useEffect, useState } from "react";
import api from "../api/axios";
import GaugeRing from "../components/GaugeRing";
import "../styles/Dashboard.css";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [statsRes, expensesRes, budgetsRes, savingsRes] = await Promise.all([
          api.get("/expenses/dashboard/"),
          api.get("/expenses/?ordering=-date"),
          api.get("/budgets/"),
         
        ]);

        if (!isMounted) return;

        setStats(statsRes.data);
        setRecent((expensesRes.data.results || expensesRes.data).slice(0, 5));

        const now = new Date();
        const budgets = budgetsRes.data.results || budgetsRes.data;
        const current = budgets.find(
          (b) =>
            b.month === now.getMonth() + 1 &&
            b.year === now.getFullYear()
        );

        if (current) {
          const summaryRes = await api.get(
            `/budgets/${current.id}/summary/`
          );
          if (isMounted) setBudgetSummary(summaryRes.data);
        }

      } catch (err) {
        console.error("Dashboard Loading Error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) return <div className="empty-state">Loading dashboard...</div>;

  return (
    <div>
      {stats?.warning && (
        <div className="warning-banner">
          ⚠ {stats.warning}
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card glass">
          <div className="stat-label">Total spent</div>
          <div className="stat-value neg mono">Rs {Number(stats?.total_expense || 0).toLocaleString()}</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-label">Spent today</div>
          <div className="stat-value mono">Rs {Number(stats?.today_expense || 0).toLocaleString()}</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-label">Highest expense</div>
          <div className="stat-value mono">Rs {Number(stats?.highest_expense || 0).toLocaleString()}</div>
        </div>
        <div className="stat-card glass">
          <div className="stat-label">Total transactions</div>
          <div className="stat-value mono">{stats?.total_expenses || 0}</div>
        </div>
      </div>

      <div className="small-stats">
        <div className="stat-card glass">
          <div className="stat-label">Budget Remaining</div>
          <div className="stat-value mono">
            Rs {Math.max(0, Number(budgetSummary?.remaining || 0)).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="dashboard-row">
        <div className="panel glass">
          <div className="panel-title">Recent expenses</div>
          {recent.length === 0 ? (
            <div className="empty-state">No expenses yet — add your first one.</div>
          ) : (
            recent.map((exp) => (
              <div className="recent-row" key={exp.id}>
                <div className="recent-meta">
                  <strong>{exp.title}</strong>
                  <span>{exp.category || "Uncategorized"} · {exp.date}</span>
                </div>
                <div className="recent-amount mono">Rs {Number(exp.amount).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>

        <div className="panel glass budget-summary-panel">
          <div className="panel-title">This month's budget</div>
          {budgetSummary ? (
            <>
              <GaugeRing percentage={budgetSummary.used_percentage} status={budgetSummary.status} />
              <div>
                <p className="mono">Rs {Number(budgetSummary.spent).toLocaleString()} of Rs {Number(budgetSummary.budget).toLocaleString()}</p>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginTop: "0.3rem" }}>
                  {budgetSummary.status}
                </p>
              </div>
            </>
          ) : (
            <p className="no-budget">No budget set for this month yet. Head to the Budget tab to add one.</p>
          )}
        </div>
      </div>
    </div>
  );
}