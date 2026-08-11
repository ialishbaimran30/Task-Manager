import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import { showToast } from "../utils/toast";
import "../styles/ProfileButton.css";

function ProfileButton({ onUsernameChange }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const [saving, setSaving] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSave = () => {
    setSaving(true);
    api
      .patch("/api/auth/me/", { username })
      .then((res) => {
        localStorage.setItem("username", res.data.username);
        setUsername(res.data.username);
        if (onUsernameChange) onUsernameChange(res.data.username);
        showToast(res.data.message || "Username updated successfully.");
        setOpen(false);
      })
      .catch((err) => {
        const message = err.response?.data?.username?.[0] || "Failed to update username";
        showToast(message, "error");
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="profile-wrapper" ref={panelRef}>
      <button className="profile-btn" onClick={() => setOpen((v) => !v)} title="Profile">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="profile-panel glass-panel-strong">
          <h4>Profile</h4>
          <label className="profile-field-label" htmlFor="profile-username-input">Username</label>
          <input
            id="profile-username-input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button className="btn btn-primary profile-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

export default ProfileButton;
