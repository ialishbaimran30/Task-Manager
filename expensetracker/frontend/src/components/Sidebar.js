import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchPendingInvites } from "../api/splitBill";
import "../styles/Layout.css";

export default function Sidebar() {
  const { logout } = useAuth();
  const [inviteCount, setInviteCount] = useState(0);

  useEffect(() => {
    const checkInvites = async () => {
      try {
        const res = await fetchPendingInvites();
        const data = res.data?.results || res.data || [];
        setInviteCount(Array.isArray(data) ? data.length : 0);
      } catch (err) {
        console.error("Error fetching invite count:", err);
      }
    };

    checkInvites();
    const interval = setInterval(checkInvites, 10000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="sidebar glass">
      <div className="brand">
        <div className="brand-mark">K</div>
        <span className="brand-name">Khata</span>
      </div>

      <nav className="nav-group">
        <span className="nav-label">Menu</span>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="nav-icon">◆</span> Dashboard
        </NavLink>
        <NavLink
          to="/expenses"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="nav-icon">◈</span> Expenses
        </NavLink>

        <NavLink
          to="/insights"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="nav-icon">◇</span> Insights
        </NavLink>

        <NavLink
          to="/budget"
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="nav-icon">◇</span> Budget
        </NavLink>
      
        <NavLink 
          to="/split-bill" 
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <span className="nav-icon">◇</span> Split Bill
          {inviteCount > 0 && (
            <span style={{ color: "#ef4444", fontWeight: "bold", marginLeft: "8px" }}>
              {inviteCount}
            </span>
          )}
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="btn btn-ghost logout-btn" onClick={logout}>
          Logout
        </button>
      </div>
    </aside>
  );
}