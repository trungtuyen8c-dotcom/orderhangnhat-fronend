export const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp", quoted: "Đã báo giá", deposited: "Đã cọc", purchasing: "Đang mua",
  purchased: "Đã mua", jp_warehouse: "Kho Nhật", customs: "Hải quan", tax_done: "Đã làm thuế",
  vn_warehouse: "Kho VN", delivered: "Đã giao", completed: "Hoàn tất",
  closed: "Đóng đơn", cancelled: "Đã hủy",
};

export const STATUS_COLOR: Record<string, string> = {
  draft: "default", quoted: "blue", deposited: "cyan", purchasing: "geekblue",
  purchased: "purple", jp_warehouse: "orange", customs: "gold", tax_done: "lime",
  vn_warehouse: "green", delivered: "success", completed: "success",
  closed: "default", cancelled: "error",
};

export const NEXT: Record<string, string[]> = {
  draft: ["quoted", "closed"], quoted: ["deposited", "closed"],
  deposited: ["purchasing", "cancelled"], purchasing: ["purchased", "cancelled"],
  purchased: ["jp_warehouse"], jp_warehouse: ["customs"], customs: ["tax_done"],
  tax_done: ["vn_warehouse"], vn_warehouse: ["delivered"], delivered: ["completed"],
};

export const vnd = (n: number | string | null | undefined) =>
  n == null ? "-" : Number(n).toLocaleString("vi-VN") + " ₫";
