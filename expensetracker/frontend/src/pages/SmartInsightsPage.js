// src/pages/SmartInsightsPage.js
import React, { useEffect, useState } from "react";
import api from "../api/axios";
import "../styles/SmartInsights.css";

export default function SmartInsightsPage() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      const res = await api.get("/expenses/insights/");
      setInsights(res.data.insights || []);
    } catch (err) {
      console.error("Error fetching insights:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading-state">Updating daily insights...</div>;

  const projectionInsight = insights.find((i) => i.type === "projection");

  return (
    <div className="insights-container">
      <div className="insights-header">
        <h2>💡 Smart Expense Insights</h2>
        <span className="live-tag">🔴 Live Daily Updates</span>
      </div>

      <div className="insights-layout">
        {/* Main Insights List */}
        <div className="insights-list-section">
          {insights.map((item) => (
            <div className={`insight-card ${item.type}`} key={item.id}>
              <h4>{item.title}</h4>
              <p>{item.message}</p>
            </div>
          ))}
        </div>

        {/* Side Panel: Formula Explanation Box for Point 3 */}
        {projectionInsight && projectionInsight.formula_details && (
          <div className="formula-sidebar-box glass">
            <h3>📐 Formula & Calculation</h3>
            <p className="formula-subtitle">How your projected budget exceed date is calculated:</p>

            <div className="formula-code-box">
              <code>Daily Pace = Total Spent / Days Passed</code>
              <code>Exceed Day = Total Budget / Daily Pace</code>
            </div>

            <hr />

            <div className="formula-stats">
              <div className="stat-row">
                <span>Spent So Far:</span>
                <strong>Rs {projectionInsight.formula_details.spent_so_far.toLocaleString()}</strong>
              </div>
              <div className="stat-row">
                <span>Days Elapsed:</span>
                <strong>{projectionInsight.formula_details.days_passed} days</strong>
              </div>
              <div className="stat-row highlight">
                <span>Current Daily Rate:</span>
                <strong>Rs {projectionInsight.formula_details.daily_burn_rate.toLocaleString()}/day</strong>
              </div>
              <div className="stat-row">
                <span>Monthly Budget:</span>
                <strong>Rs {projectionInsight.formula_details.curr_budget.toLocaleString()}</strong>
              </div>
              <div className="stat-row">
                <span>Projected Month End:</span>
                <strong>Rs {projectionInsight.formula_details.projected_total.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}