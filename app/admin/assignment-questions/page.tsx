'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Question {
  id: number;
  assignment_id: number;
  question_text: string;
  question_type: string;
  correct_answer: string;
  options: any;
  image_url: string;
  explanation: string;
  points: number;
  order_number: number;
  difficulty: string;
}

function AssignmentQuestionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get('assignment_id');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    question_text: '',
    question_type: 'multiple_choice',
    correct_answer: '',
    options: '',
    image_url: '',
    explanation: '',
    points: '1',
    order_number: '',
    difficulty: 'medium'
  });

  // New states for improved UI
  const [mcOptions, setMcOptions] = useState(['', '', '', '']);
  const [tfAnswer, setTfAnswer] = useState('true');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState('');

  // CSV Import states
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => {
    if (assignmentId) {
      fetchQuestions();
    }
  }, [assignmentId]);

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/training-assignment-questions?assignment_id=${assignmentId}`);
      const data = await response.json();
      if (data.success) {
        setQuestions(data.data);
      }
    } catch (err) {
      console.error('Error fetching questions:', err);
      setError('Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Upload image first if file is selected
      let finalImageUrl = formData.image_url || '';
      if (imageFile) {
        const uploadedUrl = await uploadImageToCloudinary();
        if (!uploadedUrl) {
          alert('Lỗi upload hình ảnh');
          return;
        }
        finalImageUrl = uploadedUrl;
      }

      // Prepare options and correct answer based on question type
      let parsedOptions = null;
      let finalCorrectAnswer = formData.correct_answer;

      if (formData.question_type === 'multiple_choice') {
        // Filter out empty options
        const validOptions = mcOptions.filter(opt => opt.trim() !== '');
        if (validOptions.length < 2) {
          alert('Multiple Choice phải có ít nhất 2 đáp án');
          return;
        }
        if (!finalCorrectAnswer || !validOptions.includes(finalCorrectAnswer)) {
          alert('Vui lòng chọn đáp án đúng trong danh sách các đáp án');
          return;
        }
        // Shuffle options for randomness
        const shuffledOptions = shuffleArray([...validOptions]);
        parsedOptions = shuffledOptions;
      } else if (formData.question_type === 'true_false') {
        parsedOptions = ['True', 'False'];
        finalCorrectAnswer = tfAnswer === 'true' ? 'True' : 'False';
        // Shuffle True/False
        parsedOptions = shuffleArray(parsedOptions);
      } else if (formData.options) {
        try {
          parsedOptions = JSON.parse(formData.options);
        } catch {
          alert('Options phải là JSON hợp lệ (ví dụ: ["A", "B", "C"])');
          return;
        }
      }

      const payload = {
        ...formData,
        correct_answer: finalCorrectAnswer,
        image_url: finalImageUrl,
        assignment_id: assignmentId,
        options: parsedOptions,
        points: parseFloat(formData.points),
        order_number: formData.order_number ? parseInt(formData.order_number) : null
      };

      const url = editingId 
        ? '/api/training-assignment-questions'
        : '/api/training-assignment-questions';
      
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { id: editingId, ...payload } : payload;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (data.success) {
        alert(editingId ? 'Cập nhật câu hỏi thành công!' : 'Tạo câu hỏi thành công!');
        setShowModal(false);
        resetForm();
        fetchQuestions();
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err) {
      console.error('Error saving question:', err);
      alert('Lỗi khi lưu câu hỏi');
    }
  };

  const handleEdit = (question: Question) => {
    setEditingId(question.id);
    setFormData({
      question_text: question.question_text,
      question_type: question.question_type,
      correct_answer: question.correct_answer || '',
      options: question.options ? JSON.stringify(question.options) : '',
      image_url: question.image_url || '',
      explanation: question.explanation || '',
      points: question.points.toString(),
      order_number: question.order_number?.toString() || '',
      difficulty: question.difficulty
    });
    
    // Load data based on question type
    if (question.question_type === 'multiple_choice' && question.options) {
      const opts = Array.isArray(question.options) ? question.options : [];
      // Ensure at least 4 slots
      const paddedOpts = [...opts, '', '', '', ''].slice(0, Math.max(4, opts.length));
      setMcOptions(paddedOpts);
    } else if (question.question_type === 'true_false') {
      const answer = question.correct_answer?.toLowerCase();
      setTfAnswer(answer === 'true' ? 'true' : 'false');
    }
    
    // Set image preview if exists
    if (question.image_url) {
      setImagePreview(question.image_url);
    }
    
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) return;
    
    try {
      const response = await fetch(`/api/training-assignment-questions?id=${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        alert('Xóa câu hỏi thành công!');
        fetchQuestions();
      } else {
        alert('Lỗi: ' + data.error);
      }
    } catch (err) {
      console.error('Error deleting question:', err);
      alert('Lỗi khi xóa câu hỏi');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      question_text: '',
      question_type: 'multiple_choice',
      correct_answer: '',
      options: '',
      image_url: '',
      explanation: '',
      points: '1',
      order_number: '',
      difficulty: 'medium'
    });
    setMcOptions(['', '', '', '']);
    setTfAnswer('true');
    setImageFile(null);
    setImagePreview('');
  };

  // Shuffle array function for randomizing options
  const shuffleArray = (array: any[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Upload image to Cloudinary
  const uploadImageToCloudinary = async (): Promise<string | null> => {
    if (!imageFile) return null;

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('file', imageFile);

      const response = await fetch('/api/upload-thumbnail', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success && data.url) {
        return data.url;
      } else {
        console.error('Upload failed:', data.error);
        return null;
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle image file selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Parse CSV file
  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const questions = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const question: any = {};

      headers.forEach((header, idx) => {
        if (values[idx]) {
          question[header] = values[idx];
        }
      });

      if (question.question_text) {
        questions.push(question);
      }
    }

    return questions;
  };

  // Handle CSV file selection
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      setImportResult(null);
    }
  };

  // Handle CSV import
  const handleCsvImport = async () => {
    if (!csvFile) {
      alert('Vui lòng chọn file CSV');
      return;
    }

    try {
      setImportLoading(true);
      
      // Read file content
      const text = await csvFile.text();
      const questions = parseCSV(text);

      if (questions.length === 0) {
        alert('File CSV không có dữ liệu hợp lệ');
        return;
      }

      // Send to API
      const response = await fetch('/api/training-assignment-questions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: assignmentId,
          questions: questions
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setImportResult(data);
        alert(`Import thành công!\n✅ ${data.stats.success} câu hỏi\n❌ ${data.stats.failed} lỗi`);
        fetchQuestions(); // Refresh list
        
        // Auto close modal after 3 seconds if no errors
        if (data.stats.failed === 0) {
          setTimeout(() => {
            setShowCsvModal(false);
            setCsvFile(null);
            setImportResult(null);
          }, 3000);
        }
      } else {
        alert('Lỗi import: ' + data.error);
      }
    } catch (err) {
      console.error('Error importing CSV:', err);
      alert('Lỗi khi import file CSV');
    } finally {
      setImportLoading(false);
    }
  };

  // Download CSV template
  const downloadCsvTemplate = () => {
    const template = `question_text,question_type,correct_answer,options,points,difficulty,explanation,image_url,order_number
"Câu hỏi 1?",multiple_choice,"Đáp án A","[""Đáp án A"",""Đáp án B"",""Đáp án C"",""Đáp án D""]",1,medium,"Giải thích câu hỏi 1",,1
"Câu hỏi 2?",true_false,"Đúng","[""Đúng"",""Sai""]",1,easy,"Giải thích câu hỏi 2",,2
"Câu hỏi 3?",short_answer,"Câu trả lời ngắn",,2,medium,"Giải thích câu hỏi 3",,3
"Câu hỏi 4?",essay,,,5,hard,"Giải thích câu hỏi 4",,4`;

    // Add BOM for UTF-8 encoding to fix Vietnamese characters in Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'assignment_questions_template.csv';
    link.click();
  };

  if (!assignmentId) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-red-500">Thiếu assignment_id trong URL</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-gray-600 text-white rounded"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:underline mb-2"
            >
              ← Quay lại danh sách assignments
            </button>
            <h1 className="text-3xl font-bold">Quản lý câu hỏi - Assignment #{assignmentId}</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCsvModal(true)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              📁 Import CSV
            </button>
            <button
              onClick={() => { resetForm(); setShowModal(true); }}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              + Thêm câu hỏi
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Đang tải dữ liệu...</div>
        ) : error ? (
          <div className="text-red-500 text-center py-12">{error}</div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left">STT</th>
                  <th className="px-4 py-3 text-left">Câu hỏi</th>
                  <th className="px-4 py-3 text-left">Loại</th>
                  <th className="px-4 py-3 text-center">Độ khó</th>
                  <th className="px-4 py-3 text-center">Điểm</th>
                  <th className="px-4 py-3 text-center">Hình ảnh</th>
                  <th className="px-4 py-3 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {questions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      Chưa có câu hỏi nào. Nhấn "Thêm câu hỏi" để bắt đầu.
                    </td>
                  </tr>
                ) : (
                  questions.map((question, idx) => (
                    <tr key={question.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">{question.order_number || idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="max-w-md">
                          <p className="font-medium">{question.question_text}</p>
                          {question.correct_answer && (
                            <p className="text-sm text-green-600 mt-1">
                              ✓ Đáp án: {question.correct_answer}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                          {question.question_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-sm ${
                          question.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                          question.difficulty === 'hard' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {question.difficulty}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{question.points}</td>
                      <td className="px-4 py-3 text-center">
                        {question.image_url ? (
                          <a href={question.image_url} target="_blank" rel="noopener noreferrer" className="text-blue-600">
                            🖼️ Xem
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => handleEdit(question)}
                            className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 text-sm"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDelete(question.id)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-4">
                  {editingId ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Question Text */}
                  <div>
                    <label className="block mb-1 font-medium text-sm">Câu hỏi *</label>
                    <textarea
                      required
                      value={formData.question_text}
                      onChange={e => setFormData({...formData, question_text: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      rows={3}
                      placeholder="Nhập nội dung câu hỏi..."
                    />
                  </div>

                  {/* Question Type */}
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block mb-1 font-medium text-sm">Loại câu hỏi *</label>
                      <select
                        value={formData.question_type}
                        onChange={e => {
                          setFormData({...formData, question_type: e.target.value});
                          // Reset related fields when changing type
                          if (e.target.value === 'true_false') {
                            setTfAnswer('true');
                          } else if (e.target.value === 'multiple_choice') {
                            setMcOptions(['', '', '', '']);
                          }
                        }}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="multiple_choice">Multiple Choice</option>
                        <option value="true_false">True/False</option>
                        <option value="short_answer">Short Answer</option>
                        <option value="essay">Essay</option>
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 font-medium text-sm">Độ khó</label>
                      <select
                        value={formData.difficulty}
                        onChange={e => setFormData({...formData, difficulty: e.target.value})}
                        className="w-full border rounded px-3 py-2"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1 font-medium text-sm">Điểm</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.points}
                        onChange={e => setFormData({...formData, points: e.target.value})}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </div>

                  {/* Dynamic fields based on question type */}
                  {formData.question_type === 'multiple_choice' && (
                    <div className="space-y-3">
                      <label className="block font-medium text-sm">Các đáp án (tối thiểu 2)</label>
                      {mcOptions.map((opt, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            type="radio"
                            name="correct_answer"
                            checked={formData.correct_answer === opt && opt !== ''}
                            onChange={() => setFormData({...formData, correct_answer: opt})}
                            disabled={opt === ''}
                            className="shrink-0"
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={e => {
                              const newOptions = [...mcOptions];
                              newOptions[idx] = e.target.value;
                              setMcOptions(newOptions);
                              // Update correct answer if this was selected
                              if (formData.correct_answer === opt) {
                                setFormData({...formData, correct_answer: e.target.value});
                              }
                            }}
                            placeholder={`Đáp án ${idx + 1}`}
                            className="flex-1 border rounded px-3 py-2"
                          />
                          {idx > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newOptions = mcOptions.filter((_, i) => i !== idx);
                                setMcOptions(newOptions);
                              }}
                              className="text-red-600 hover:text-red-800 px-2"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setMcOptions([...mcOptions, ''])}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        + Thêm đáp án
                      </button>
                      <p className="text-xs text-yellow-600">
                        💡 Thứ tự đáp án sẽ được tự động xáo trộn khi hiển thị cho học viên
                      </p>
                    </div>
                  )}

                  {formData.question_type === 'true_false' && (
                    <div>
                      <label className="block mb-2 font-medium text-sm">Đáp án đúng</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="tf_answer"
                            value="true"
                            checked={tfAnswer === 'true'}
                            onChange={() => setTfAnswer('true')}
                            className="w-4 h-4"
                          />
                          <span>True (Đúng)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="tf_answer"
                            value="false"
                            checked={tfAnswer === 'false'}
                            onChange={() => setTfAnswer('false')}
                            className="w-4 h-4"
                          />
                          <span>False (Sai)</span>
                        </label>
                      </div>
                      <p className="text-xs text-yellow-600 mt-2">
                        💡 Thứ tự True/False sẽ được tự động xáo trộn khi hiển thị
                      </p>
                    </div>
                  )}

                  {(formData.question_type === 'short_answer' || formData.question_type === 'essay') && (
                    <div>
                      <label className="block mb-1 font-medium text-sm">Gợi ý đáp án</label>
                      <textarea
                        value={formData.correct_answer}
                        onChange={e => setFormData({...formData, correct_answer: e.target.value})}
                        className="w-full border rounded px-3 py-2"
                        rows={2}
                        placeholder="Nhập gợi ý hoặc đáp án mẫu..."
                      />
                    </div>
                  )}

                  {/* Image Upload */}
                  <div>
                    <label className="block mb-1 font-medium text-sm">Hình ảnh hỗ trợ (tùy chọn)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="w-full border rounded px-3 py-2"
                    />
                    {(imagePreview || formData.image_url) && (
                      <div className="mt-2">
                        <img
                          src={imagePreview || formData.image_url}
                          alt="Preview"
                          className="max-w-xs max-h-48 rounded border"
                        />
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Hình ảnh sẽ được tải lên Cloudinary khi lưu câu hỏi
                    </p>
                  </div>

                  {/* Explanation */}
                  <div>
                    <label className="block mb-1 font-medium text-sm">Giải thích</label>
                    <textarea
                      value={formData.explanation}
                      onChange={e => setFormData({...formData, explanation: e.target.value})}
                      className="w-full border rounded px-3 py-2"
                      rows={2}
                      placeholder="Giải thích đáp án đúng..."
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 justify-end pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); resetForm(); }}
                      className="px-6 py-2 border rounded hover:bg-gray-100"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={uploadingImage}
                      className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2"
                    >
                      {uploadingImage && (
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {uploadingImage ? 'Đang upload...' : (editingId ? 'Cập nhật' : 'Tạo mới')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* CSV Import Modal */}
        {showCsvModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-6">Import câu hỏi từ CSV</h2>

                {/* Instructions */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold mb-2">📋 Hướng dẫn:</h3>
                  <ul className="text-sm space-y-1 ml-4 list-disc">
                    <li>File CSV phải có header: question_text, question_type, correct_answer, options, points, difficulty, explanation, image_url</li>
                    <li><strong>question_type</strong>: multiple_choice, true_false, short_answer, essay</li>
                    <li><strong>options</strong>: Định dạng JSON array hoặc cách nhau bởi dấu phẩy. VD: ["Đáp án A","Đáp án B"]</li>
                    <li><strong>difficulty</strong>: easy, medium, hard</li>
                    <li><strong>points</strong>: Số điểm (số thực)</li>
                  </ul>
                </div>

                {/* Download Template */}
                <div className="mb-6">
                  <button
                    onClick={downloadCsvTemplate}
                    className="px-4 py-2 bg-gray-100 border rounded hover:bg-gray-200 flex items-center gap-2"
                  >
                    📥 Tải file mẫu CSV
                  </button>
                </div>

                {/* File Upload */}
                <div className="mb-6">
                  <label className="block mb-2 font-medium">Chọn file CSV:</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvFileChange}
                    className="w-full border rounded px-3 py-2"
                  />
                  {csvFile && (
                    <p className="text-sm text-gray-600 mt-2">
                      ✅ Đã chọn: {csvFile.name}
                    </p>
                  )}
                </div>

                {/* Import Result */}
                {importResult && (
                  <div className={`mb-6 p-4 rounded-lg border-2 ${
                    importResult.stats.failed === 0 
                      ? 'bg-green-50 border-green-500' 
                      : 'bg-yellow-50 border-yellow-500'
                  }`}>
                    <h3 className="font-semibold mb-2">Kết quả import:</h3>
                    <div className="text-sm space-y-1">
                      <p>✅ Thành công: {importResult.stats.success}/{importResult.stats.total} câu hỏi</p>
                      {importResult.stats.failed > 0 && (
                        <p>❌ Lỗi: {importResult.stats.failed} câu hỏi</p>
                      )}
                    </div>
                    
                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="mt-3 max-h-40 overflow-y-auto">
                        <p className="font-semibold text-sm mb-1">Chi tiết lỗi:</p>
                        <ul className="text-xs space-y-1 ml-4 list-disc text-red-600">
                          {importResult.errors.map((err: string, idx: number) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => { 
                      setShowCsvModal(false); 
                      setCsvFile(null); 
                      setImportResult(null);
                    }}
                    className="px-6 py-2 border rounded hover:bg-gray-100"
                    disabled={importLoading}
                  >
                    {importResult?.stats.failed === 0 ? 'Đóng' : 'Hủy'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCsvImport}
                    disabled={!csvFile || importLoading}
                    className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-300 flex items-center gap-2"
                  >
                    {importLoading && (
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {importLoading ? 'Đang import...' : 'Import'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssignmentQuestionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-8 text-center">Đang tải...</div>}>
      <AssignmentQuestionsContent />
    </Suspense>
  );
}
