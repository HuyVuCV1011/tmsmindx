import { redirect } from "next/navigation";

/** Trang tạm ẩn — chuyển về khu vực user. */
export default function DangKyLichLamViecPage() {
  redirect("/user/truyenthong");
}
