import type { ReactNode } from "react";

export function PageContainer({ title, sub, extra, children }: { title: string; sub?: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="page-head">
        <div>
          <h2>{title}</h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {extra && <div>{extra}</div>}
      </div>
      {children}
    </div>
  );
}
