import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import api from "../api/axios";

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    const token = localStorage.getItem("access");
    if (!token) return;

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await api.get("/notifications/", { headers });
      const data = res.data.results || res.data || [];
      setNotifications(data);

      const count = data.filter((n) => !n.is_read).length;
      setUnreadCount(count);
    } catch (err) {
      console.warn("Notifications load error:", err?.response?.status || err.message);
    }
  }, []);

  const connectSocket = useCallback(() => {
    const token = localStorage.getItem("access");
    if (!token) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(`ws://127.0.0.1:8000/ws/notifications/?token=${token}`);
    wsRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const newNotif = JSON.parse(event.data);
        setNotifications((prev) => [newNotif, ...prev]);
        setUnreadCount((prev) => prev + 1);
      } catch (err) {
        console.error("WS Message Parsing Error:", err);
      }
    };
  }, []);

  useEffect(() => {
    loadNotifications();
    connectSocket();

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, "Unmounted");
      }
    };
  }, [loadNotifications, connectSocket]);

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    const token = localStorage.getItem("access");
    if (!token) return;

    try {
      await api.patch("/notifications/mark-all-read/", {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.warn("Mark read failed on server:", err);
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loadNotifications,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);