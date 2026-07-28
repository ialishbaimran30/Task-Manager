import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { showToast } from "../utils/toast";
import "../styles/login.css";

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({username: "",email: "",password: "",password2: "",});

  const handleChange = (e) => {
  setFormData({
    ...formData,
    [e.target.name]: e.target.value,
  });
};

  const registerUser = async (e) => {
  e.preventDefault();

  try {
    await api.post("/register/", formData);

    showToast("Registration successful");
    setTimeout(() => navigate("/"), 800);
  } catch (err) {
    console.log(err.response?.data);
    showToast("Registration failed", "error");
  }
};

  return (
    <div className="auth-screen">
      <div className="glass-panel-strong auth-card">
        <div className="auth-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="6" cy="6" r="2.3" fill="currentColor" />
            <circle cx="18" cy="6" r="2.3" fill="currentColor" />
            <circle cx="6" cy="18" r="2.3" fill="currentColor" />
            <circle cx="18" cy="18" r="2.3" fill="currentColor" />
          </svg>
        </div>
        <h1>Create account</h1>
        <p className="auth-sub">Start organizing your tasks</p>

        <form onSubmit={registerUser} className="auth-form">
          <label className="field">
            <span>Username</span>
            <input type="text" name="username" placeholder="Username"value={formData.username}onChange={handleChange}required/>
          </label>

          <label className="field">
            <span>Email</span>
            <input type="email"name="email" className="auth-input" placeholder="Email"value={formData.email}onChange={handleChange}required/>
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange}required />
          </label>
          <label className="field">
            <span>Confirm Password</span>
            <input type="password"name="password2"placeholder="Confirm Password"value={formData.password2}onChange={handleChange}required/>
          </label>

          <button className="btn btn-primary auth-submit" type="submit">Register</button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <button type="button" className="link-btn" onClick={() => navigate("/")}>Back to login</button>
        </p>
      </div>
    </div>
  );
}

export default Register;