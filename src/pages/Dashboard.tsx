import { useEffect, useState } from "react";
import { Row, Col, Card, Table, Tag, Alert, Spin } from "antd";
import {
  ShoppingCartOutlined, TeamOutlined, CarOutlined, CheckCircleOutlined,
} from "@ant-design/icons";
import { api } from "../api";
import { PageContainer } from "../components/PageContainer";
import { STATUS_LABEL, STATUS_COLOR } from "../lib/status";

interface Stats { totalOrders: number; customers: number; byStatus: { status: string; count: number }[]; }
interface Alerts { count: number; orders: { code: string }[]; }
interface Order { id: string; code: string; status: string; totalQuote: string | null; customer?: { name: string }; }

const StatCard = ({ cls, icon, label, value }: { cls: string; icon: any; label: string; value: number }) => (
  <Card className={`stat-card ${cls}`} variant="borderless">
    <span className="sc-icon">{icon}</span>
    <div className="sc-label">{label}</div>
    <div className="sc-value">{value}</div>
  </Card>
);

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);
  const [recent, setRecent] = useState<Order[]>([]);

  useEffect(() => {
    api.get<Stats>("/stats").then((r) => setS(r.data)).catch(() => {});
    api.get<Alerts>("/stats/alerts").then((r) => setAlerts(r.data)).catch(() => {});
    api.get<Order[]>("/orders").then((r) => setRecent(r.data.slice(0, 8))).catch(() => {});
  }, []);

  if (!s) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;

  const inProgress = s.byStatus.filter((b) => !["completed", "closed", "cancelled"].includes(b.status)).reduce((a, b) => a + b.count, 0);
  const done = s.byStatus.find((b) => b.status === "completed")?.count ?? 0;
  const max = Math.max(1, ...s.byStatus.map((b) => b.count));

  return (
    <PageContainer title="Dashboard" sub="Tổng quan vận hành đơn hàng">
      {alerts && alerts.count > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 18, borderRadius: 12 }}
          message={`${alerts.count} đơn quá 7 ngày kể từ thanh toán mà chưa có tracking`}
          description={alerts.orders.map((o) => o.code).join(", ")}
        />
      )}
      <Row gutter={[16, 16]} className="stat-cards">
        <Col xs={12} lg={6}><StatCard cls="sc-indigo" icon={<ShoppingCartOutlined />} label="Tổng đơn" value={s.totalOrders} /></Col>
        <Col xs={12} lg={6}><StatCard cls="sc-cyan" icon={<TeamOutlined />} label="Khách hàng" value={s.customers} /></Col>
        <Col xs={12} lg={6}><StatCard cls="sc-amber" icon={<CarOutlined />} label="Đang xử lý" value={inProgress} /></Col>
        <Col xs={12} lg={6}><StatCard cls="sc-green" icon={<CheckCircleOutlined />} label="Hoàn tất" value={done} /></Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={10}>
          <Card title="Phân bố trạng thái" style={{ height: "100%" }}>
            {s.byStatus.length === 0 && <span style={{ color: "#94a3b8" }}>Chưa có đơn</span>}
            {s.byStatus.map((b) => (
              <div className="status-row" key={b.status}>
                <span className="name"><Tag color={STATUS_COLOR[b.status]}>{STATUS_LABEL[b.status] ?? b.status}</Tag></span>
                <span className="bar"><span style={{ width: `${(b.count / max) * 100}%` }} /></span>
                <span className="cnt">{b.count}</span>
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="Đơn gần đây">
            <Table
              rowKey="id" size="small" pagination={false} dataSource={recent}
              locale={{ emptyText: "Chưa có đơn" }}
              columns={[
                { title: "Mã", dataIndex: "code" },
                { title: "Khách", dataIndex: ["customer", "name"] },
                { title: "Trạng thái", dataIndex: "status", render: (v) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] ?? v}</Tag> },
                { title: "Báo giá", dataIndex: "totalQuote", align: "right", render: (v) => (v ? Number(v).toLocaleString() + " ¥" : "-") },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
}
