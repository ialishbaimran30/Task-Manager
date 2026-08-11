import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { showToast } from "../utils/toast";
import { setAuthSession } from "../utils/authStorage";
import "../styles/register.css";

function Signup() {
  const navigate = useNavigate();

  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setOtpLoading(true);
    try {
      await api.post("/api/auth/otp/request/", { email, purpose: "signup" });
      showToast("Verification code sent to your email.");
      setStep("otp");
      setCooldown(30);
    } catch (error) {
      const message = error.response?.data?.error || "Failed to send code";
      showToast(message, "error");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setOtpLoading(true);
    try {
      const res = await api.post("/api/auth/otp/verify/", { email, code, purpose: "signup" });
      setAuthSession(res.data);
      showToast("Signed in successfully");
      navigate("/dashboard");
    } catch (error) {
      const message = error.response?.data?.error || "Invalid code";
      showToast(message, "error");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleChangeEmail = () => {
    setStep("email");
    setCode("");
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
        <h1>Create your account</h1>
        <p className="auth-sub">Sign up with your email to get started</p>

        {step === "email" ? (
          <form className="auth-form" onSubmit={handleRequestOtp}>
            <div className="field">
              <span>Email</span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={otpLoading}>
              {otpLoading ? "Sending…" : "Continue with Email"}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleVerifyOtp}>
            <p className="auth-sub" style={{ margin: 0 }}>Code sent to {email}</p>
            <div className="field">
              <span>Verification code</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={otpLoading}>
              {otpLoading ? "Verifying…" : "Verify & Create account"}
            </button>
            <div className="auth-switch">
              <button type="button" className="change-email-link" onClick={handleChangeEmail}>
                Change email
              </button>
              {" · "}
              <button
                type="button"
                className="resend-link"
                disabled={cooldown > 0}
                onClick={handleRequestOtp}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        <p className="auth-switch">
          Already have an account? <Link to="/">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
