// src/pages/Insights.js
import { useEffect, useState } from "react";
import api from "../api/axios";

export default function Insights() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/expenses/insights/");
      console.log("Insights API Response:", res.data);

      if (res.data?.insights && Array.isArray(res.data.insights)) {
        setInsights(res.data.insights);
      } else if (Array.isArray(res.data)) {
        setInsights(res.data);
      } else {
        setInsights([]);
      }
    } catch (err) {
      console.error("Error fetching insights:", err);
      setError("Failed to load insights. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  if (loading) return <div className="empty-state">Loading smart insights...</div>;

  return (
    <div style={{ padding: "1rem", maxWidth: "900px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ margin: 0 }}>💡 Smart Expense Insights</h2>
        <button className="btn btn-ghost" onClick={fetchInsights}>
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="error-text" style={{ marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {insights.length === 0 ? (
        <div className="panel glass" style={{ padding: "1.5rem" }}>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            No insights generated yet. Set up a monthly budget or mark expenses as 
            <strong> "Track in Smart Insights"</strong> to generate personalized analytics.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          {insights.map((item, idx) => (
            <div
              key={item.id || idx}
              className="panel glass"
              style={{
                borderLeft: "4px solid #6366f1",
                padding: "1.2rem",
                borderRadius: "8px",
                position: "relative",
              }}
            >
              {/* Card Header & Title */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "0.5rem", color: "#6366f1", marginTop: 0 }}>
                  {item.title || "Insight"}
                </h3>

                {/* Small Formula Note on Top Right Side (Requirement) */}
                {item.formula_text && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary, #9ca3af)",
                      fontStyle: "italic",
                      background: "rgba(99, 102, 241, 0.08)",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "4px",
                      border: "1px solid rgba(99, 102, 241, 0.2)",
                    }}
                  >
                    {item.formula_text}
                  </span>
                )}
              </div>

              {/* Main Insight Message */}
              <p style={{ color: "var(--text-primary)", fontSize: "1rem", lineHeight: "1.5", margin: "0.5rem 0" }}>
                {item.message}
              </p>

              {/* Daily Burn Rate Formula Details Grid */}
              {item.formula && (
                <div
                  style={{
                    marginTop: "0.8rem",
                    padding: "0.75rem",
                    background: "rgba(255, 255, 255, 0.04)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "6px",
                    fontSize: "0.82rem",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: "0.5rem",
                  }}
                >
                  <div>
                    <span style={{ color: "#818cf8" }}>Daily Avg:</span> PKR {item.formula.daily_burn_rate?.toLocaleString()}
                  </div>
                  <div>
                    <span style={{ color: "#818cf8" }}>Spent So Far:</span> PKR {item.formula.spent_so_far?.toLocaleString()}
                  </div>
                  <div>
                    <span style={{ color: "#818cf8" }}>Budget:</span> PKR {item.formula.budget?.toLocaleString()}
                  </div>
                  <div>
                    <span style={{ color: "#818cf8" }}>Projected Total:</span> PKR {item.formula.projected_total?.toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}