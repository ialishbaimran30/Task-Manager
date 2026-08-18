import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { BASE_URL } from "../services/api";
import "../styles/Notificationbell.css";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const socketRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    api.get("/tasks/notifications/").then((res) => setNotifications(res.data)).catch(console.log);
  }, []);


  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const host = BASE_URL.replace(/^https?:\/\//, "");
    const socket = new WebSocket(`${wsProtocol}://${host}/ws/notifications/?token=${token}`);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setNotifications((prev) => [data, ...prev]);
    };

    socket.onerror = (err) => console.log("Notification socket error:", err);

    socketRef.current = socket;
    return () => socket.close();
  }, []);


  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = () => {
    api.post("/tasks/notifications/mark_all_read/").then(() => {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }).catch(console.log);
  };

  const markOneRead = (id) => {
    api.post(`/tasks/notifications/${id}/mark_read/`).then(() => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    }).catch(console.log);
  };

  const handleNotificationClick = (n) => {

    if (!n.is_read) {
      markOneRead(n.id);
    }


    setOpen(false);

    const isGroupInvite = n.message && n.message.includes("invited to join group");

    if (n.link) {
      navigate(n.link);
    } else if (isGroupInvite) {
      navigate("/team");
    }
  };

  const clearAllNotifications = () => {
    api.post("/tasks/notifications/clear_all/") 
      .then(() => {
        setNotifications([]); 
      })
      .catch((err) => console.log("Failed to clear notifications", err));
  };

  return (
    <div className="notif-wrapper" ref={panelRef}>
      <button className="notif-bell-btn" onClick={() => setOpen((v) => !v)} title="Notifications">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
          <path d="M6 8a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9.5 18a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-panel glass-panel-strong">
          <div className="notif-panel-head">
            <h4>Notifications</h4>
            {unreadCount > 0 && (
              <button className="link-btn" onClick={markAllRead}>Mark all read</button>
            )}
            {notifications.length > 0 && (
                <button 
                  className="link-btn" 
                  style={{ color: "#ef4444" }} 
                  onClick={clearAllNotifications}
                >
                  Clear all
                </button>
              )}
          </div>

          {notifications.length === 0 ? (
            <p className="notif-empty">No notifications yet</p>
          ) : (
            <div className="notif-list">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`notif-row ${n.is_read ? "" : "notif-unread"}`}
                  onClick={() => handleNotificationClick(n)}
                  style={{ cursor: "pointer" }}
                >
                  <span className="notif-dot" />
                  <div>
                    <p className="notif-message">{n.message}</p>
                    <span className="notif-time">{timeAgo(n.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;