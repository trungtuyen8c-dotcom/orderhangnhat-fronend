import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, App as AntApp, theme as antdTheme } from "antd";
import viVN from "antd/locale/vi_VN";
import App from "./App";
import "antd/dist/reset.css";
import "./styles.css";

const theme = {
  token: {
    colorPrimary: "#4f46e5",
    colorInfo: "#4f46e5",
    colorSuccess: "#16a34a",
    colorWarning: "#f59e0b",
    colorError: "#dc2626",
    borderRadius: 10,
    controlHeight: 38,
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
    colorBgLayout: "#f4f6fb",
    boxShadowSecondary: "0 4px 16px rgba(15,23,42,.06)",
  },
  components: {
    Layout: { headerBg: "#ffffff", siderBg: "#ffffff", headerHeight: 60, headerPadding: "0 24px" },
    Menu: { itemSelectedBg: "#eef2ff", itemSelectedColor: "#4f46e5", itemHeight: 44, itemBorderRadius: 8, iconSize: 17 },
    Card: { borderRadiusLG: 14 },
    Table: { headerBg: "#f8fafc", headerColor: "#475569", borderColor: "#eef2f6", rowHoverBg: "#f8fafc" },
    Button: { fontWeight: 500 },
  },
  algorithm: antdTheme.defaultAlgorithm,
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider locale={viVN} theme={theme}>
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);
