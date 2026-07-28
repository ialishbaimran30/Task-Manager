import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "../styles/Layout.css";

const TITLES = {
  "/": ["Dashboard", "Your spending at a glance"],
  "/expenses": ["Expenses", "Track and manage every rupee"],
  "/budget": ["Budget", "Set monthly limits and stay on track"],
};

export default function AppLayout() {
  const location = useLocation();
  const [title, subtitle] = TITLES[location.pathname] || ["Khata", ""];

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar title={title} subtitle={subtitle} />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}