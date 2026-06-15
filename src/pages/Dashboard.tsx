import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { usePermission } from "../hooks/usePermission";

export default function Dashboard() {
  const { me, logout } = useAuth();
  const { can } = usePermission();
  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h2>Order Hàng Nhật — Admin</h2>
      <p>Xin chào {me?.fullName ?? me?.email} ({me?.roles.join(", ")})</p>
      <ul>
        {can("orders.list") && <li><Link to="/orders">Đơn hàng</Link></li>}
      </ul>
      <button onClick={logout}>Đăng xuất</button>
    </div>
  );
}
