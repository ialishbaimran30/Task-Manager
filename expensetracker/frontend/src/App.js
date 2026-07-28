import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider ,useAuth} from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Budget from "./pages/Budget";

import RecurringExpenses from "./pages/RecurringExpenses";
import { NotificationProvider } from "./context/NotificationContext";
import SplitBillPage from "./pages/SplitBillPage";
import Insights from "./pages/Insights";

function SplitBillWithAuth() {
  const { user } = useAuth();
  return <SplitBillPage currentUser={user} />;}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>

          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="recurring"element={<RecurringExpenses />}/>
            <Route path="/split-bill" element={<SplitBillWithAuth />} />
            <Route
              path="/"element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="budget" element={<Budget />} />
              <Route path="insights" element={<Insights />} />  

            </Route>
          </Routes>

        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}