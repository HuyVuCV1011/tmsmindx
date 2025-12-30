"use client";
import React from "react";
import "./style.css";
import CalendarMonth from "@/components/CalendarMonth";

const TeacherHomePage = () => {
  return (
    <div className="teacher-home-container">
      {/* Carousel Tin tức mới nhất */}
      <section className="news-carousel-section">
        <h2 className="section-title">Tin tức mới nhất</h2>
        <div className="carousel-placeholder">
          {/* TODO: Thay thế bằng component Carousel thực tế */}
          <div style={{height: 200, background: '#f3f3f3', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8}}>
            <span>Carousel Tin tức sẽ hiển thị ở đây</span>
          </div>
        </div>
      </section>

      {/* Lịch bảng hoạt động tháng hiện tại */}
      <section className="calendar-section" style={{marginTop: 32}}>
        <h2 className="section-title">Lịch hoạt động tháng</h2>
        <div className="calendar-placeholder">
          <CalendarMonth />
        </div>
      </section>
    </div>
  );
};

export default TeacherHomePage;
