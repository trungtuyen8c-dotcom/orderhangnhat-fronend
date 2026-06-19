import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Card, Input, Button, Descriptions, Table, Tag, Typography, App } from "antd";
import { STATUS_LABEL, STATUS_COLOR } from "../lib/status";

const BASE = import.meta.env.VITE_API_BASE ?? "/api";

export default function PublicLookup() {
  const { token: paramToken } = useParams();
  const { message } = App.useApp();
  const [token, setToken] = useState(paramToken ?? "");
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup(t: string) {
    if (!t) return;
    setLoading(true);
    try {
      const r = await axios.get(`${BASE}/public/orders/${t}`);
      setData(r.data);
    } catch {
      setData(null);
      message.error("Không tìm thấy đơn");
    } finally {
      setLoading(false);
    }
  }

  // tự tra nếu có token trên URL
  useEffect(() => { if (paramToken) lookup(paramToken); /* eslint-disable-next-line */ }, [paramToken]);

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <Typography.Title level={3} style={{ textAlign: "center" }}>Tra cứu đơn hàng</Typography.Title>
      <Card>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <Input placeholder="Nhập mã tra cứu" value={token} onChange={(e) => setToken(e.target.value)} onPressEnter={() => lookup(token)} />
          <Button type="primary" loading={loading} onClick={() => lookup(token)}>Tra cứu</Button>
        </div>
        {data && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Mã đơn">{data.code}</Descriptions.Item>
              <Descriptions.Item label="Khách">{data.customer?.name}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái"><Tag color={STATUS_COLOR[data.status]}>{STATUS_LABEL[data.status] ?? data.status}</Tag></Descriptions.Item>
            </Descriptions>
            <Table style={{ marginTop: 16 }} rowKey="name" size="small" pagination={false} dataSource={data.items}
              columns={[{ title: "Món", dataIndex: "name" }, { title: "SL", dataIndex: "qty" }]} />
            {data.trackings?.length > 0 && (
              <Table style={{ marginTop: 16 }} rowKey="code" size="small" pagination={false} dataSource={data.trackings}
                columns={[{ title: "Tracking", dataIndex: "code" }, { title: "Trạng thái", dataIndex: "status" }]} />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
