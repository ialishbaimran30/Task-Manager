import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";
import "../styles/Layout.css";

export default function Topbar({ title, subtitle }) {
  const { user } = useAuth();
  const initial = user?.username?.[0]?.toUpperCase() || "?";

  return (
    <header className="topbar glass">
      <div className="topbar-title">
        <h2>{title}</h2>
        {subtitle && <span>{subtitle}</span>}
      </div>
      <div className="topbar-right">
        <NotificationBell />
        <div className="user-chip glass-strong">
          <div className="user-avatar">{initial}</div>
          <span className="user-name">{user?.username}</span>
        </div>
      </div>
    </header>
  );
}