import { useEffect, useState } from "react";
import { Card, Table, Button, Tag, Input, App, Row, Col, Popconfirm, Alert } from "antd";
import { CloudUploadOutlined, GoogleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { api } from "../api";
import { PageContainer } from "../components/PageContainer";

interface Run { id: string; kind: string; status: string; startedAt: string; finishedAt?: string | null; sizeBytes: number; remotePath?: string | null; error?: string | null; }
interface Status { connected: boolean; running: boolean; last: Run | null; }

const fmtSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n > 1e3 ? `${(n / 1e3).toFixed(0)} KB` : `${n} B`);
const statusTag = (s: string) => {
  const m: any = { success: ["green", "Thành công"], failed: ["red", "Thất bại"], running: ["blue", "Đang chạy"], pending: ["gold", "Chờ"] };
  const [c, l] = m[s] ?? ["default", s];
  return <Tag color={c}>{l}</Tag>;
};

export default function Backup() {
  const { message } = App.useApp();
  const [st, setSt] = useState<Status | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get<Status>("/backup/status").then((r) => setSt(r.data)).catch(() => {});
    api.get<Run[]>("/backup/runs").then((r) => setRuns(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  // tự refresh khi đang chạy
  useEffect(() => {
    if (!st?.running) return;
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [st?.running]);

  async function connect() {
    if (!token.trim()) return message.error("Dán token rclone");
    setBusy(true);
    try { await api.put("/backup/rclone-token", { token: token.trim() }); message.success("Đã kết nối Google Drive"); setToken(""); load(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "Token không hợp lệ"); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    try { await api.post("/backup/disconnect"); message.success("Đã ngắt kết nối"); load(); } catch { message.error("Lỗi"); }
  }
  async function runNow() {
    setBusy(true);
    try { await api.post("/backup/run"); message.success("Đã bắt đầu backup"); load(); }
    catch (e: any) { message.error(e?.response?.data?.message ?? "Không chạy được"); }
    finally { setBusy(false); }
  }

  return (
    <PageContainer title="Backup" sub="Sao lưu dữ liệu (DB + file chứng từ) lên Google Drive">
      <Row gutter={16} className="stat-cards">
        <Col xs={24} md={8}><Card>
          <div style={{ color: "#888", fontSize: 13 }}>Google Drive</div>
          <div style={{ marginTop: 6 }}>{st?.connected ? <Tag color="green">Đã kết nối</Tag> : <Tag color="red">Chưa kết nối</Tag>}</div>
        </Card></Col>
        <Col xs={24} md={8}><Card>
          <div style={{ color: "#888", fontSize: 13 }}>Lần backup cuối</div>
          <div style={{ marginTop: 6 }}>{st?.last ? <span>{statusTag(st.last.status)} {dayjs(st.last.startedAt).format("DD/MM HH:mm")}</span> : "-"}</div>
        </Card></Col>
        <Col xs={24} md={8}><Card>
          <Button type="primary" icon={<CloudUploadOutlined />} loading={busy || st?.running} disabled={!st?.connected} block onClick={runNow}>
            {st?.running ? "Đang backup..." : "Backup ngay"}
          </Button>
          {!st?.connected && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 6 }}>Kết nối Drive trước</div>}
        </Card></Col>
      </Row>

      <Card title={<span><GoogleOutlined /> Kết nối Google Drive</span>} style={{ marginTop: 16 }}
        extra={st?.connected && <Popconfirm title="Ngắt kết nối Drive?" onConfirm={disconnect}><Button size="small" danger>Ngắt kết nối</Button></Popconfirm>}>
        {st?.connected ? (
          <Alert type="success" message="Đã kết nối Google Drive. Có thể bấm 'Backup ngay'." />
        ) : (
          <>
            <Alert type="info" style={{ marginBottom: 12 }}
              message="Cách lấy token (làm 1 lần trên máy bạn)"
              description={<div style={{ fontSize: 13 }}>
                Mở Terminal, chạy:<br />
                <code>brew install rclone</code><br />
                <code>rclone authorize "drive"</code><br />
                → trình duyệt mở → đăng nhập Gmail → Allow → copy đoạn <code>{"{...}"}</code> dán vào ô dưới.
              </div>} />
            <Input.TextArea rows={4} value={token} onChange={(e) => setToken(e.target.value)}
              placeholder='{"access_token":"...","refresh_token":"...","expiry":"..."}' style={{ fontFamily: "monospace", marginBottom: 8 }} />
            <Button type="primary" loading={busy} onClick={connect}>Kết nối</Button>
          </>
        )}
      </Card>

      <Card title="Lịch sử backup" style={{ marginTop: 16 }}>
        <Table rowKey="id" size="small" dataSource={runs} pagination={{ pageSize: 10 }}
          locale={{ emptyText: "Chưa có bản backup" }}
          columns={[
            { title: "Thời gian", dataIndex: "startedAt", render: (v) => dayjs(v).format("DD/MM/YYYY HH:mm:ss") },
            { title: "Loại", dataIndex: "kind", render: (v) => (v === "manual" ? "Chạy tay" : "Tự động") },
            { title: "Trạng thái", dataIndex: "status", render: statusTag },
            { title: "Dung lượng", dataIndex: "sizeBytes", align: "right", render: (v) => (v ? fmtSize(v) : "-") },
            { title: "Vị trí Drive", dataIndex: "remotePath", render: (v) => v ?? "-" },
            { title: "Lỗi", dataIndex: "error", ellipsis: true, render: (v) => (v ? <span style={{ color: "#dc2626" }}>{v}</span> : "-") },
          ]} />
      </Card>
    </PageContainer>
  );
}
