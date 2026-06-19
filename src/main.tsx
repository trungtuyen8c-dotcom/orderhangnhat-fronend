import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, App as AntApp } from "antd";
import viVN from "antd/locale/vi_VN";
import App from "./App";
import "antd/dist/reset.css";
import "./styles.css";

const theme = {
  token: {
    colorPrimary: "#2563eb",
    borderRadius: 8,
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
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
