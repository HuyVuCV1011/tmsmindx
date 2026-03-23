'use client';

import RichTextEditor from '@/components/RichTextEditor';
import { DIFFICULTY_LEVELS, POINTS_PRESETS, QUESTION_TEMPLATES } from '@/lib/assignment-constants';
import { Question, QuestionFormData } from '@/types/assignment';
import { Eye, EyeOff, Image as ImageIcon, Plus, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface QuestionBuilderProps {
  onSave: (question: Partial<Question>) => void;
  onCancel: () => void;
  initialData?: Partial<Question>;
  assignmentId?: number;
}

const normalizeDifficulty = (difficulty?: string): QuestionFormData['difficulty'] => {
  switch (difficulty) {
    case 'easy':
    case 'remember':
    case 'understand':
      return 'easy';
    case 'hard':
    case 'evaluate':
    case 'create':
      return 'hard';
    case 'medium':
    case 'apply':
    case 'analyze':
    default:
      return 'medium';
  }
};

export function QuestionBuilder({ onSave, onCancel, initialData, assignmentId }: QuestionBuilderProps) {
  const draftKey = `question_draft_${assignmentId || 'new'}_${initialData?.id || 'new'}`;

  // Load từ draft hoặc initialData
  const loadDraft = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(draftKey);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const draft = loadDraft();
  const initData = draft || initialData || {};

  const [questionType, setQuestionType] = useState<QuestionFormData['question_type']>(
    initData?.question_type || 'multiple_choice'
  );
  const [questionText, setQuestionText] = useState(initData?.question_text || '');
  const [options, setOptions] = useState<string[]>(
    initData?.options || QUESTION_TEMPLATES.multiple_choice.defaultOptions
  );
  const [correctAnswer, setCorrectAnswer] = useState(initData?.correct_answer || '');
  const [explanation, setExplanation] = useState(initData?.explanation || '');
  const [points, setPoints] = useState(initData?.points || 1);
  const [difficulty, setDifficulty] = useState<QuestionFormData['difficulty']>(
    normalizeDifficulty(initData?.difficulty)
  );
  const [imageUrl, setImageUrl] = useState(initData?.image_url || '');
  const [imagePreview, setImagePreview] = useState(initData?.imagePreview || initData?.image_url || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showToolbar, setShowToolbar] = useState(true);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearDraft();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  // Auto-save draft mỗi khi có thay đổi
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window === 'undefined') return;
      
      const draftData = {
        question_type: questionType,
        question_text: questionText,
        options,
        correct_answer: correctAnswer,
        explanation,
        points,
        difficulty,
        image_url: imageUrl,
        imagePreview: imagePreview,
      };

      try {
        localStorage.setItem(draftKey, JSON.stringify(draftData));
      } catch (error) {
        console.error('Failed to save draft:', error);
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [questionType, questionText, options, correctAnswer, explanation, points, difficulty, imageUrl, imagePreview, draftKey]);

  // Clear draft khi component unmount do cancel hoặc save thành công
  const clearDraft = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(draftKey);
    }
  };

  const handleQuestionTypeChange = (newType: QuestionFormData['question_type']) => {
    setQuestionType(newType);
    const template = QUESTION_TEMPLATES[newType];
    if (template.defaultOptions) {
      setOptions(template.defaultOptions);
      setCorrectAnswer('');
    }
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    if (correctAnswer === options[index]) {
      setCorrectAnswer('');
    }
  };

  const updateOption = (index: number, value: string) => {
    const oldVal = options[index];
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
    if (correctAnswer === oldVal) {
      setCorrectAnswer(value);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file hình ảnh');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước file không được vượt quá 5MB');
      return;
    }

    // Lưu file để upload sau khi save
    setImageFile(file);

    // Show preview immediately (không upload ngay)
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    toast.success('Đã chọn ảnh. Ảnh sẽ được tải lên khi bạn lưu câu hỏi.');
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error('Kích thước ảnh không được vượt quá 5MB');
          return;
        }

        // Lưu file để upload sau khi save
        setImageFile(file);

        // Show preview immediately
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        toast.success('Đã dán ảnh. Ảnh sẽ được tải lên khi bạn lưu câu hỏi.');
        break;
      }
    }
  };

  const handleSave = async () => {
    // Strip HTML tags for validation
    const plainText = questionText.replace(/<[^>]*>/g, '').trim();
    
    if (!plainText) {
      toast.error('Vui lòng nhập câu hỏi');
      return;
    }

    if (questionType === 'multiple_choice') {
      const validOptions = options.filter(opt => opt.replace(/<[^>]*>/g, '').trim());
      if (validOptions.length < 2) {
        toast.error('Cần ít nhất 2 đáp án');
        return;
      }
      if (!correctAnswer) {
        toast.error('Vui lòng chọn đáp án đúng');
        return;
      }
    }

    if (!correctAnswer.trim()) {
      toast.error('Vui lòng nhập/chọn đáp án đúng');
      return;
    }

    // Upload ảnh nếu có file mới
    let finalImageUrl = imageUrl;
    if (imageFile) {
      setUploadingImage(true);
      toast.loading('Đang tải ảnh lên...', { id: 'uploading' });
      
      try {
        const formData = new FormData();
        formData.append('image', imageFile);

        const response = await fetch('/api/upload-question-image', {
          method: 'POST',
          body: formData
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Upload failed');
        }
        
        finalImageUrl = data.url;
        toast.success('Tải ảnh lên thành công!', { id: 'uploading' });
      } catch (error: any) {
        console.error('Error uploading image:', error);
        toast.error(error.message || 'Lỗi upload ảnh. Vui lòng thử lại.', { id: 'uploading' });
        setUploadingImage(false);
        return; // Dừng lại nếu upload ảnh thất bại
      } finally {
        setUploadingImage(false);
      }
    }

    const questionData: Partial<Question> = {
      ...initialData,
      question_text: questionText,
      question_type: questionType,
      correct_answer: correctAnswer,
      options: questionType === 'multiple_choice' || questionType === 'true_false' 
        ? options.filter(opt => opt.replace(/<[^>]*>/g, '').trim()) 
        : null,
      image_url: finalImageUrl || null,
      explanation,
      points,
      difficulty
    };

    // Clear draft sau khi save thành công
    clearDraft();
    onSave(questionData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {initialData?.id ? 'Chỉnh sửa câu hỏi' : 'Tạo câu hỏi mới'}
            </h2>
            {draft && (
              <p className="text-xs text-green-600 mt-1">
                ✓ Đã khôi phục bản nháp
              </p>
            )}
          </div>
          <button
            onClick={() => {
              clearDraft();
              onCancel();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Question Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Loại câu hỏi
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(QUESTION_TEMPLATES).map(([type, template]) => {
                const Icon = template.icon;
                return (
                  <button
                    key={type}
                    onClick={() => handleQuestionTypeChange(type as QuestionFormData['question_type'])}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      questionType === type
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                    <div className="font-semibold text-sm">{template.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{template.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Text */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                Câu hỏi <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowToolbar(!showToolbar)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all bg-gray-100 text-gray-600 hover:bg-gray-200"
                title={showToolbar ? 'Ẩn thanh công cụ' : 'Hiện thanh công cụ'}
              >
                {showToolbar ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showToolbar ? 'Ẩn thanh công cụ' : 'Hiện thanh công cụ'}
              </button>
            </div>
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden hover:border-blue-400 transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
              <RichTextEditor
                content={questionText}
                onChange={setQuestionText}
                showToolbar={showToolbar}
              />
            </div>
          </div>

          {/* Image Upload */}
          <div onPaste={handlePaste}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Hình ảnh minh họa (tùy chọn)
              <span className="text-xs text-gray-500 ml-2">
                (Click để tải lên hoặc Ctrl+V để dán ảnh)
              </span>
            </label>
            {imagePreview ? (
              <div className="relative inline-block">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  width={300}
                  height={200}
                  className="rounded-lg border border-gray-300 object-cover"
                />
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                    <div className="text-white text-center">
                      <div className="h-8 w-8 bg-white/30 rounded-full mx-auto mb-2 animate-pulse"></div>
                      <p className="text-sm">Đang tải lên...</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => {
                    setImagePreview('');
                    setImageUrl('');
                    setImageFile(null);
                  }}
                  disabled={uploadingImage}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Xóa ảnh"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <div className="text-center">
                  {uploadingImage ? (
                    <>
                      <div className="h-10 w-10 bg-blue-200 rounded-full mx-auto mb-2 animate-pulse"></div>
                      <span className="text-sm text-gray-600">Đang tải lên...</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600">Click để tải ảnh lên</span>
                      <span className="text-xs text-gray-500 block mt-1">Tối đa 5MB</span>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploadingImage}
                />
              </label>
            )}
          </div>

          {/* Options for Multiple Choice */}
          {questionType === 'multiple_choice' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Các đáp án <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={correctAnswer === option}
                      onChange={() => setCorrectAnswer(option)}
                      className="w-5 h-5 text-blue-600"
                    />
                    <div className="flex-1 min-w-0 border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                      <RichTextEditor
                        content={option}
                        onChange={(html) => updateOption(index, html)}
                        minHeight="min-h-[100px]"
                        showToolbar={true}
                      />
                    </div>
                    {options.length > 2 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addOption}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span>Thêm đáp án</span>
                </button>
              </div>
            </div>
          )}

          {/* True/False Options */}
          {questionType === 'true_false' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Đáp án đúng <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                {['Đúng', 'Sai'].map((option) => (
                  <label
                    key={option}
                    className={`flex-1 flex items-center justify-center gap-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      correctAnswer === option
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="tf-answer"
                      value={option}
                      checked={correctAnswer === option}
                      onChange={(e) => setCorrectAnswer(e.target.value)}
                      className="w-5 h-5"
                    />
                    <span className="font-semibold">{option}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Short Answer / Essay */}
          {(questionType === 'short_answer' || questionType === 'essay') && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Đáp án mẫu <span className="text-red-500">*</span>
              </label>
              <textarea
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                placeholder="Nhập đáp án mẫu hoặc keywords..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={questionType === 'essay' ? 4 : 2}
              />
              <p className="text-xs text-gray-500 mt-1">
                Đáp án này sẽ được dùng làm tham khảo khi chấm điểm
              </p>
            </div>
          )}

          {/* Explanation */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Giải thích (tùy chọn)
            </label>
            <div className="border-2 border-gray-300 rounded-lg overflow-hidden hover:border-blue-400 transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
              <RichTextEditor
                content={explanation}
                onChange={setExplanation}
                showToolbar={showToolbar}
              />
            </div>
          </div>

          {/* Points and Difficulty */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Điểm số
              </label>
              <div className="flex gap-2 mb-2">
                {POINTS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setPoints(preset)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      points === preset
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                min="0.5"
                step="0.5"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Độ khó
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {DIFFICULTY_LEVELS.map((level) => {
                  const colorMap: Record<string, string> = {
                    green: 'border-green-500 bg-green-50 text-green-700',
                    blue: 'border-blue-500 bg-blue-50 text-blue-700',
                    red: 'border-red-500 bg-red-50 text-red-700'
                  };
                  
                  return (
                    <label
                      key={level.value}
                      className={`flex flex-col p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        difficulty === level.value
                          ? colorMap[level.color]
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="radio"
                          name="difficulty"
                          value={level.value}
                          checked={difficulty === level.value}
                          onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                          className="w-4 h-4"
                        />
                        <span className="text-lg">{level.icon}</span>
                        <span className="font-semibold text-sm">{level.label}</span>
                      </div>
                      <p className="text-xs text-gray-600 ml-6">{level.description}</p>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => {
              clearDraft();
              onCancel();
            }}
            disabled={uploadingImage}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={uploadingImage}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploadingImage ? (
              <>
                <div className="h-4 w-4 bg-white/50 rounded-full animate-pulse"></div>
                <span>Đang tải ảnh lên...</span>
              </>
            ) : (
              <span>{initialData?.id ? 'Cập nhật' : 'Tạo câu hỏi'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
