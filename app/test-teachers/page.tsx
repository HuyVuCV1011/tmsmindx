'use client';

import { useState } from 'react';

interface Teacher {
  [key: string]: any;
}

interface ApiResponse {
  success: boolean;
  message?: string;
  count?: number;
  data?: Teacher[];
  error?: string;
  details?: string;
  timestamp?: string;
}

export default function TestTeachersPage() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);

  const handleTest = async () => {
    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch('/api/test-teachers');
      const data: ApiResponse = await res.json();
      setResponse(data);
    } catch (error: any) {
      setResponse({
        success: false,
        error: error.message || 'Lỗi khi gọi API'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">
            🧪 Test PostgreSQL Connection - Bảng Teachers
          </h1>

          <div className="mb-6">
            <button
              onClick={handleTest}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg shadow transition duration-200"
            >
              {loading ? 'Đang kết nối...' : 'Test Kết Nối'}
            </button>
          </div>

          {response && (
            <div className="space-y-4">
              {/* Status Section */}
              <div className={`p-4 rounded-lg ${response.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <h2 className="font-bold text-lg mb-2">
                  {response.success ? '✅ Kết nối thành công!' : '❌ Kết nối thất bại'}
                </h2>
                {response.message && <p className="text-gray-700">{response.message}</p>}
                {response.timestamp && (
                  <p className="text-sm text-gray-500 mt-2">
                    Thời gian: {new Date(response.timestamp).toLocaleString('vi-VN')}
                  </p>
                )}
              </div>

              {/* Error Details */}
              {!response.success && response.error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <h3 className="font-bold text-red-800 mb-2">Chi tiết lỗi:</h3>
                  <p className="text-red-700 mb-2">{response.error}</p>
                  {response.details && (
                    <pre className="bg-red-100 p-3 rounded text-xs overflow-auto max-h-64 text-red-800">
                      {response.details}
                    </pre>
                  )}
                </div>
              )}

              {/* Data Count */}
              {response.success && response.count !== undefined && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <h3 className="font-bold text-blue-800">
                    📊 Số lượng bản ghi: {response.count}
                  </h3>
                </div>
              )}

              {/* Data Table */}
              {response.success && response.data && response.data.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <h3 className="font-bold text-lg p-4 bg-gray-50 border-b">
                    📝 Dữ liệu Teachers (Hiển thị tối đa 50 bản ghi)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          {Object.keys(response.data[0]).map((key) => (
                            <th key={key} className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {response.data.map((teacher, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            {Object.values(teacher).map((value, idx) => (
                              <td key={idx} className="px-4 py-3 text-sm text-gray-600">
                                {value !== null && value !== undefined 
                                  ? String(value) 
                                  : <span className="text-gray-400 italic">null</span>
                                }
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Raw JSON */}
              <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <summary className="cursor-pointer font-semibold text-gray-700">
                  🔍 Xem JSON Raw Response
                </summary>
                <pre className="mt-3 bg-gray-900 text-green-400 p-4 rounded overflow-auto max-h-96 text-xs">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
