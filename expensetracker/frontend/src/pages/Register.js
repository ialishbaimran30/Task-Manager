import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Auth.css";

const initialForm = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  password: "",
  confirm_password: "",
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      await register(form);
      navigate("/login");
    } catch (err) {
      const data = err.response?.data;
      setErrors(typeof data === "object" ? data : { detail: "Registration failed." });
    } finally {
      setLoading(false);
    }
  };

  const fieldError = (name) =>
    errors[name] && <p className="error-text">{[].concat(errors[name]).join(" ")}</p>;

  return (
    <div className="auth-screen">
      <div className="auth-card glass">
        <div className="auth-header">
          <div className="auth-mark">K</div>
          <h1>Create your account</h1>
          <p>Start tracking your expenses today</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Username</label>
            <input name="username" value={form.username} onChange={handleChange} required />
          </div>
          {fieldError("username")}

          <div className="field">
            <label>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required />
          </div>
          {fieldError("email")}

          <div className="name-row">
            <div className="field">
              <label>First name</label>
              <input name="first_name" value={form.first_name} onChange={handleChange} />
            </div>
            <div className="field">
              <label>Last name</label>
              <input name="last_name" value={form.last_name} onChange={handleChange} />
            </div>
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>
          {fieldError("password")}

          <div className="field">
            <label>Confirm password</label>
            <input
              type="password"
              name="confirm_password"
              value={form.confirm_password}
              onChange={handleChange}
              required
            />
          </div>
          {fieldError("confirm_password")}

          {errors.detail && <p className="error-text">{errors.detail}</p>}

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}