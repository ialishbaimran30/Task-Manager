import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";
import { AUTH_PREFIX } from "../config";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const getUrl = (endpoint) =>
    `${AUTH_PREFIX.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get(`${AUTH_PREFIX}/profile/`)
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post(getUrl("login/"), {
      username,
      password,
    });
    localStorage.setItem("access", data.access);
    localStorage.setItem("refresh", data.refresh);
    const profile = await api.get(`${AUTH_PREFIX}/profile/`);
    setUser(profile.data);
    return profile.data;
  };

  const register = async (payload) => {
    const { data } = await api.post(getUrl("register/"), payload);
  };

 const logout = async () => {
    const refresh = localStorage.getItem("refresh");
    
    if (refresh) {
      try {
        await api.post(getUrl("logout/"), { refresh });
      } catch {
        // Silent catch: Token agar pehle se expired/invalid hai, 
        // to backend reject karega, par frontend session lazmi clear hoga.
      }
    }

    // Always clear tokens & user state
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}