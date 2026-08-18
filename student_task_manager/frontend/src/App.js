import ToastContainer from "./components/ToastContainer";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import TaskList from "./pages/TaskList";
import TaskForm from "./pages/TaskForm";
import CategoryPage from "./pages/CategoryPage";
import TeamCollaboration from "./pages/TeamCollaboration";
function App() {
  return (
    <>
      <ToastContainer />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/tasks/add" element={<TaskForm />} />
          <Route path="/tasks/edit/:id" element={<TaskForm />} />
          <Route path="/categories" element={<CategoryPage />} />
          <Route path="/team" element={<TeamCollaboration />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;