import { PageContainer } from "@/components/PageContainer";
import Link from "next/link";

export default function ManageK12DocsPage() {
	return (
		<PageContainer
			title="Quan ly noi dung Quy trinh quy dinh K12 Teaching"
			description="Trang quan ly noi dung dang duoc khoi phuc"
		>
			<div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
				<p className="text-sm text-gray-700">
					Trang quan ly da co module hop le. Neu ban muon, minh se tiep tuc bo sung day du luong tao, sua, xoa noi dung theo kieu GitBook.
				</p>
				<div className="mt-3">
					<Link
						href="/admin/page2"
						className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
					>
						Quay ve trang quy trinh
					</Link>
				</div>
			</div>
		</PageContainer>
	);
}
