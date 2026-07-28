import { useEffect, useRef, useState } from "react";
import { useNotification } from "../context/NotificationContext";
import api from "../api/axios";
import "../styles/Notifications.css";

const ICONS = {
  invite: "📩",
  login_reminder: "📝",
  budget_exceeded: "⛔",
  insight: "💡",
  reminder: "✏️",
  budget_expiring: "⏳",
  new_month: "🗓️",
};

export default function NotificationBell() {
  const { 
    notifications: contextNotifs, 
    unreadCount: contextUnread, 
    markAllAsRead, 
    clearNotifications 
  } = useNotification();

  const [localNotifications, setLocalNotifications] = useState([]);
  const [localUnreadCount, setLocalUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const socketRef = useRef(null);

  // Initial Fetch from DB
  const fetchNotifications = async () => {
    try {
      const res = await api.get("/notifications/");
      const data = res.data.results || res.data;
      if (Array.isArray(data)) {
        setLocalNotifications(data);
        const unread = data.filter((n) => !n.is_read).length;
        setLocalUnreadCount(unread);
      }
    } catch (err) {
      console.warn("API notifications fetch failed:", err?.message);
    }
  };

  useEffect(() => {
    fetchNotifications();

    const token = localStorage.getItem("access");
    if (!token) return;

    // Single WS instance setup
    if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
      const wsUrl = `ws://127.0.0.1:8000/ws/notifications/?token=${token}`;
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        console.log("🟢 Live WebSocket Connected!");
      };

      socketRef.current.onmessage = (event) => {
        console.log("📩 Live WS Data:", event.data);
        try {
          const data = JSON.parse(event.data);
          const newNotif = data.notification || data.payload || data;

          if (newNotif) {
            setLocalNotifications((prev) => [newNotif, ...prev]);
            setLocalUnreadCount((prev) => prev + 1);
          }
        } catch (err) {
          console.error("Error parsing WS message:", err);
        }
      };

      socketRef.current.onclose = () => {
        console.log("⚪ WS Connection Closed");
      };
    }

    return () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
    };
  }, []);

  // Sync with context if available
  useEffect(() => {
    if (contextNotifs && contextNotifs.length > 0) {
      setLocalNotifications(contextNotifs);
      setLocalUnreadCount(contextUnread);
    }
  }, [contextNotifs, contextUnread]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOpen = () => {
    const nextState = !open;
    setOpen(nextState);

    if (nextState && localUnreadCount > 0) {
      if (markAllAsRead) markAllAsRead();
      setLocalUnreadCount(0);
    }
  };

  const handleClearAll = () => {
    if (clearNotifications) clearNotifications();
    setLocalNotifications([]);
    setLocalUnreadCount(0);
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "Just now";
    const date = new Date(timeStr);
    return isNaN(date.getTime())
      ? timeStr
      : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  return (
    <div className="notif-wrapper" ref={wrapperRef}>
      <button className="notif-bell" onClick={toggleOpen} title="Notifications">
        🔔
        {localUnreadCount > 0 && (
          <span className="notif-badge">
            {localUnreadCount > 9 ? "9+" : localUnreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span>Notifications</span>
            {localNotifications.length > 0 && (
              <button className="notif-clear-btn" onClick={handleClearAll}>
                Clear all
              </button>
            )}
          </div>

          {localNotifications.length === 0 ? (
            <div className="notif-empty">No notifications yet.</div>
          ) : (
            localNotifications.map((n, idx) => (
              <div
                className={`notif-item ${n.is_read ? "" : "unread"}`}
                key={n.id || idx}
              >
                <span className="notif-icon">
                  {ICONS[n.notification_type || n.type] || "⛔"}
                </span>

                <div className="notif-content-block">
                  <span className="notif-title-text">{n.title || "Budget Alert"}</span>
                  <p className="notif-message-text">{n.message || n.text}</p>
                  <span className="notif-time-text">
                    {formatTime(n.created_at || n.timestamp)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}