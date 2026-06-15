import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth";
import { RequireAuth, RequirePermission } from "./components/RequirePermission";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import "./styles.css";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
          <Route path="/orders" element={
            <RequireAuth><Layout>
              <RequirePermission permission="orders.list"><Orders /></RequirePermission>
            </Layout></RequireAuth>
          } />
          <Route path="/customers" element={
            <RequireAuth><Layout>
              <RequirePermission permission="customers.list"><Customers /></RequirePermission>
            </Layout></RequireAuth>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
