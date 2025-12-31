"use client";

import { useSearchParams, useRouter } from "next/navigation";

const dummyVideoData = {
  id: 1,
  title: "LESSON 05: Định hình sản phẩm theo chủ đề",
  author: "K12 MindX School",
  startDate: "April 28th, 12:00am",
  dueDate: "No due date",
  speedUp: true,
  students: [
    { name: "TEST", watched: 0, grade: null, attempts: 0, lastWatched: "Never", turnedIn: false },
    { name: "TEST", watched: 0, grade: null, attempts: 0, lastWatched: "Never", turnedIn: false },
  ],
};

export default function VideoDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const videoUrl = searchParams.get("url");
  const videoId = searchParams.get("id") || "1";
  const video = dummyVideoData;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <button className="mb-4 text-blue-600 hover:underline" onClick={() => router.back()}>&larr; Video Assignment</button>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex gap-6 items-center">
          <div className="w-64 h-40 bg-gray-200 flex items-center justify-center rounded">
            {videoUrl ? (
              <video src={videoUrl} controls className="w-full h-full rounded" />
            ) : (
              <span className="text-5xl text-gray-400">▶</span>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2">{video.title}</h1>
            <div className="text-gray-600 mb-1">By {video.author}</div>
            <div className="text-sm text-gray-500 mb-1">Start date: <span className="font-medium">{video.startDate}</span></div>
            <div className="text-sm text-gray-500 mb-1">Due date: <span className="font-medium">{video.dueDate}</span></div>
            <div className="text-xs text-gray-500">{video.speedUp && "Speed up videos"}</div>
          </div>
        </div>
      </div>
      <div>
        <div className="flex gap-8 border-b mb-4">
          <button className="pb-2 border-b-2 border-yellow-400 font-bold">Students</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left px-4 py-2">Student Name</th>
                <th className="text-left px-4 py-2">Watched</th>
                <th className="text-left px-4 py-2">Grade</th>
                <th className="text-left px-4 py-2">Attempts</th>
                <th className="text-left px-4 py-2">Last watched</th>
                <th className="text-left px-4 py-2">Turned in</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {video.students.map((s, idx) => (
                <tr key={idx} className="border-b">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2"><div className="w-32 h-2 bg-gray-200 rounded"><div className="h-2 bg-red-500 rounded" style={{width: s.watched + '%'}}></div></div></td>
                  <td className="px-4 py-2">{s.grade ?? '-'}</td>
                  <td className="px-4 py-2">{s.attempts}</td>
                  <td className="px-4 py-2">{s.lastWatched}</td>
                  <td className="px-4 py-2">{s.turnedIn ? <span className="text-green-600">✓ Turned in</span> : <span className="text-gray-500">✗ Not turned in</span>}</td>
                  <td className="px-2 py-2"><button className="p-1 rounded hover:bg-gray-100">⋯</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
