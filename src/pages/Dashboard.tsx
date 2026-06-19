import { useEffect, useState } from "react";
import { Row, Col, Card, Statistic, Table, Tag, Alert, Spin } from "antd";
import { ShoppingCartOutlined, TeamOutlined } from "@ant-design/icons";
import { api } from "../api";
import { STATUS_LABEL, STATUS_COLOR } from "../lib/status";

interface Stats { totalOrders: number; customers: number; byStatus: { status: string; count: number }[]; }
interface Alerts { count: number; orders: { code: string }[]; }

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);

  useEffect(() => {
    api.get<Stats>("/stats").then((r) => setS(r.data)).catch(() => {});
    api.get<Alerts>("/stats/alerts").then((r) => setAlerts(r.data)).catch(() => {});
  }, []);

  if (!s) return <Spin size="large" style={{ display: "block", margin: "80px auto" }} />;

  return (
    <div>
      {alerts && alerts.count > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message={`${alerts.count} đơn quá 7 ngày kể từ thanh toán mà chưa có tracking`}
          description={alerts.orders.map((o) => o.code).join(", ")}
        />
      )}
      <Row gutter={16} className="stat-cards">
        <Col xs={12} md={6}><Card><Statistic title="Tổng đơn" value={s.totalOrders} prefix={<ShoppingCartOutlined />} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="Khách hàng" value={s.customers} prefix={<TeamOutlined />} /></Card></Col>
      </Row>
      <Card title="Đơn theo trạng thái">
        <Table
          rowKey="status" pagination={false} size="small"
          dataSource={s.byStatus}
          columns={[
            { title: "Trạng thái", dataIndex: "status", render: (v) => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] ?? v}</Tag> },
            { title: "Số lượng", dataIndex: "count" },
          ]}
          locale={{ emptyText: "Chưa có đơn" }}
        />
      </Card>
    </div>
  );
}
