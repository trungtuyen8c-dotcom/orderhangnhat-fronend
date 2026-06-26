import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth";
import { RequireAuth, RequirePermission } from "./components/RequirePermission";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import WarehouseJp from "./pages/WarehouseJp";
import Shipments from "./pages/Shipments";
import Accounting from "./pages/Accounting";
import Warehouse from "./pages/Warehouse";
import Admin from "./pages/Admin";
import Backup from "./pages/Backup";
import PublicLookup from "./pages/PublicLookup";

function page(perm: string, el: React.ReactNode) {
  return <RequireAuth><Layout><RequirePermission permission={perm}>{el}</RequirePermission></Layout></RequireAuth>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/tra-cuu" element={<PublicLookup />} />
          <Route path="/tra-cuu/:token" element={<PublicLookup />} />
          <Route path="/" element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
          <Route path="/orders" element={page("orders.list", <Orders />)} />
          <Route path="/customers" element={page("customers.list", <Customers />)} />
          <Route path="/warehouse-jp" element={page("warehouse.weigh_jp", <WarehouseJp />)} />
          <Route path="/shipments" element={page("shipments.list", <Shipments />)} />
          <Route path="/accounting" element={page("accounting.reconcile", <Accounting />)} />
          <Route path="/warehouse" element={page("warehouse.weigh_vn", <Warehouse />)} />
          <Route path="/admin" element={page("users.list", <Admin />)} />
          <Route path="/backup" element={page("system.manage_settings", <Backup />)} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
