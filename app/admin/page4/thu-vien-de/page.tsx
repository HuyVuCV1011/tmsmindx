"use client";

import { Card } from "@/components/Card";
import { PageContainer } from "@/components/PageContainer";
import { BookCopy, PlusCircle, SquarePen } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

interface SubjectOption {
  examType: "expertise" | "experience";
  blockCode: string;
  blockLabel: string;
  subjectCode: string;
  subjectName: string;
}

interface ExamSetRecord {
  id: number;
  set_code: string;
  set_name: string;
  total_points: number;
  passing_score: number;
  status: "active" | "inactive";
  valid_from: string | null;
  valid_to: string | null;
  exam_type: "expertise" | "experience";
  block_code: string;
  subject_code: string;
  subject_name: string;
}

const SUBJECTS: SubjectOption[] = [
  {
    examType: "expertise",
    blockCode: "CODING",
    blockLabel: "Coding",
    subjectCode: "[COD] Scratch",
    subjectName: "[COD] Scratch",
  },
  {
    examType: "expertise",
    blockCode: "CODING",
    blockLabel: "Coding",
    subjectCode: "[COD] GameMaker",
    subjectName: "[COD] GameMaker",
  },
  {
    examType: "expertise",
    blockCode: "CODING",
    blockLabel: "Coding",
    subjectCode: "[COD] Web",
    subjectName: "[COD] Web",
  },
  {
    examType: "expertise",
    blockCode: "CODING",
    blockLabel: "Coding",
    subjectCode: "[COD] AppProducer",
    subjectName: "[COD] AppProducer",
  },
  {
    examType: "expertise",
    blockCode: "CODING",
    blockLabel: "Coding",
    subjectCode: "[COD] ComputerScience",
    subjectName: "[COD] ComputerScience",
  },
  {
    examType: "expertise",
    blockCode: "ROBOTICS",
    blockLabel: "Robotics",
    subjectCode: "[ROB] VexGo",
    subjectName: "[ROB] VexGo",
  },
  {
    examType: "expertise",
    blockCode: "ROBOTICS",
    blockLabel: "Robotics",
    subjectCode: "[ROB] VexIQ",
    subjectName: "[ROB] VexIQ",
  },
  {
    examType: "expertise",
    blockCode: "ART",
    blockLabel: "Art",
    subjectCode: "[ART] Test chuyên sâu",
    subjectName: "[ART] Test chuyên sâu",
  },
  {
    examType: "experience",
    blockCode: "PROCESS",
    blockLabel: "Kiểm tra quy trình, kỹ năng trải nghiệm",
    subjectCode: "[Trial] Quy Trình Trai nghiệm",
    subjectName: "Kiểm tra quy trình, kỹ năng trải nghiệm",
  },
];

export default function ProfessionalAssignmentLibraryPage() {
  const [sets, setSets] = useState<ExamSetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const blockOptions = useMemo(() => {
    const map = new Map<string, string>();
    SUBJECTS.forEach((item) => {
      if (!map.has(item.blockCode)) {
        map.set(item.blockCode, item.blockLabel);
      }
    });
    return Array.from(map.entries()).map(([blockCode, blockLabel]) => ({ blockCode, blockLabel }));
  }, []);

  const groupedByBlock = useMemo(() => {
    return blockOptions.map((block) => {
      const subjects = SUBJECTS.filter((s) => s.blockCode === block.blockCode).map((subject) => ({
        ...subject,
        sets: sets.filter((set) => set.subject_code === subject.subjectCode),
      }));
      return {
        ...block,
        subjects,
      };
    });
  }, [blockOptions, sets]);

  const fetchSets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/exam-sets');
      const data = await response.json();
      if (data.success) {
        setSets(data.data || []);
      } else {
        toast.error(data.error || 'Không thể tải danh sách bộ đề');
      }
    } catch (error) {
      console.error('Error fetching exam sets:', error);
      toast.error('Có lỗi xảy ra khi tải danh sách bộ đề');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSets();
  }, []);

  return (
    <PageContainer
      title="Bộ đề đánh giá chuyên môn"
      description="Quản lý bộ đề theo 3 khối chính: Coding, Robotics, Art và bộ đề kiểm tra quy trình - kỹ năng trải nghiệm"
    >
      <div className="mb-4 flex justify-end">
        <Link
          href="/admin/baitap/tao-moi?mode=professional"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#a1001f] text-white hover:bg-[#8a0019] text-sm font-medium"
        >
          <PlusCircle className="h-4 w-4" />
          Tạo đề kiểm tra chuyên môn
        </Link>
      </div>

      <div className="space-y-4">
          {groupedByBlock.map((group) => (
            <Card key={group.blockCode} padding="lg">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                  <BookCopy className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{group.blockLabel}</h2>
                  <p className="text-sm text-gray-600 mt-1">Danh sách bộ đề theo môn</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.subjects.map((subject) => (
                  <div key={`${group.blockCode}-${subject.subjectCode}`} className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h3 className="text-sm font-semibold text-gray-900">{subject.subjectName}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                        {subject.sets.length} đề
                      </span>
                    </div>

                    {subject.sets.length === 0 ? (
                      <p className="text-xs text-gray-500">Chưa có bộ đề.</p>
                    ) : (
                      <div className="space-y-2">
                        {subject.sets.map((set) => (
                          <div key={set.id} className="border border-gray-200 rounded-md p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <div className="text-xs font-semibold text-gray-900">{set.set_code}</div>
                                <div className="text-xs text-gray-600">{set.set_name}</div>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                set.status === 'active'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {set.status}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-gray-500">
                              {set.total_points} điểm • đạt {set.passing_score}
                            </div>
                            <div className="mt-2">
                              <Link
                                href={`/admin/page4/thu-vien-de/questions?set_id=${set.id}`}
                                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                              >
                                <SquarePen className="h-3.5 w-3.5" />
                                Quản lý câu hỏi
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

      {loading && (
        <div className="mt-4 text-sm text-gray-500">Đang tải danh sách bộ đề...</div>
      )}
    </PageContainer>
  );
}
