import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Form, Input, Button, Typography, App } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "../auth";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  async function onFinish(v: { email: string; password: string }) {
    setLoading(true);
    try {
      await login(v.email, v.password);
      nav("/");
    } catch {
      message.error("Sai email hoặc mật khẩu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-bg">
      <Card style={{ width: 380, boxShadow: "0 10px 40px rgba(0,0,0,.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Typography.Title level={3} style={{ marginBottom: 0 }}>Order Hàng Nhật</Typography.Title>
          <Typography.Text type="secondary">Hệ thống quản trị</Typography.Text>
        </div>
        <Form layout="vertical" initialValues={{ email: "admin@orderhn.local" }} onFinish={onFinish}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
            <Input prefix={<UserOutlined />} placeholder="Email" size="large" />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu" rules={[{ required: true }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>Đăng nhập</Button>
        </Form>
      </Card>
    </div>
  );
}
