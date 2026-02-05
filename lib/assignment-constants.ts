import { CheckCheck, CheckSquare, FileText, PenLine } from 'lucide-react';

export const QUESTION_TEMPLATES = {
  multiple_choice: {
    name: 'Trắc nghiệm',
    icon: CheckSquare,
    description: 'Câu hỏi với nhiều lựa chọn, chỉ 1 đáp án đúng',
    defaultOptions: ['', '', '', ''],
    placeholder: 'Nhập câu hỏi trắc nghiệm...'
  },
  true_false: {
    name: 'Đúng/Sai',
    icon: CheckCheck,
    description: 'Câu hỏi đúng hoặc sai',
    defaultOptions: ['Đúng', 'Sai'],
    placeholder: 'Nhập câu hỏi đúng/sai...'
  },
  short_answer: {
    name: 'Trả lời ngắn',
    icon: PenLine,
    description: 'Câu hỏi yêu cầu trả lời ngắn (văn bản)',
    defaultOptions: null,
    placeholder: 'Nhập câu hỏi...'
  },
  essay: {
    name: 'Tự luận',
    icon: FileText,
    description: 'Câu hỏi yêu cầu trả lời chi tiết',
    defaultOptions: null,
    placeholder: 'Nhập câu hỏi tự luận...'
  }
};

// Bloom's Taxonomy - 6 cấp độ tư duy
export const DIFFICULTY_LEVELS = [
  { 
    value: 'remember', 
    label: 'Nhớ', 
    color: 'green', 
    icon: '🧠',
    description: 'Nhớ lại thông tin, thuật ngữ, khái niệm cơ bản'
  },
  { 
    value: 'understand', 
    label: 'Hiểu', 
    color: 'blue', 
    icon: '💡',
    description: 'Giải thích ý nghĩa, diễn giải thông tin'
  },
  { 
    value: 'apply', 
    label: 'Áp dụng', 
    color: 'cyan', 
    icon: '⚙️',
    description: 'Sử dụng kiến thức vào tình huống mới'
  },
  { 
    value: 'analyze', 
    label: 'Phân tích', 
    color: 'yellow', 
    icon: '🔍',
    description: 'Phân tách thông tin, tìm mối liên hệ'
  },
  { 
    value: 'evaluate', 
    label: 'Đánh giá', 
    color: 'orange', 
    icon: '⚖️',
    description: 'Đưa ra nhận định, phê phán dựa trên tiêu chí'
  },
  { 
    value: 'create', 
    label: 'Sáng tạo', 
    color: 'purple', 
    icon: '✨',
    description: 'Tạo ra giải pháp, sản phẩm mới'
  }
];

export const ASSIGNMENT_TYPES = [
  { value: 'quiz', label: 'Kiểm tra nhanh', icon: '⚡', description: 'Bài kiểm tra ngắn, nhanh' },
  { value: 'exam', label: 'Bài kiểm tra', icon: '📄', description: 'Bài kiểm tra chính thức' },
  { value: 'practice', label: 'Luyện tập', icon: '💪', description: 'Bài tập thực hành' }
];

export const POINTS_PRESETS = [1, 2, 5, 10];

export const TIME_PRESETS = [15, 30, 45, 60, 90, 120];
