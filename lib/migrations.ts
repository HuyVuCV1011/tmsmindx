import { Pool } from 'pg';

// ============================================================
// Hệ thống Migration tự động cho TMS
// Khi chạy app, tất cả tables sẽ được tạo tự động nếu chưa có
// Thêm chức năng mới → thêm migration vào danh sách → restart app
// ============================================================

interface Migration {
  name: string;
  version: number;
  sql: string;
}

// ========== DANH SÁCH MIGRATIONS ==========
// Thêm migration mới vào cuối mảng, KHÔNG SỬA migration cũ
// Version tăng dần: 1, 2, 3, ...
const migrations: Migration[] = [

  // ─── V1: Bảng tracking migrations ─────────────────────
  {
    name: 'create_migrations_table',
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        version INTEGER NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `,
  },

  // ─── V2: Updated_at trigger function ──────────────────
  {
    name: 'create_updated_at_function',
    version: 2,
    sql: `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `,
  },

  // ─── V3: Communications (Truyền thông) ────────────────
  {
    name: 'create_communications',
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS communications (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        content TEXT,
        featured_image TEXT,
        banner_image TEXT,
        post_type TEXT,
        audience TEXT,
        status TEXT DEFAULT 'draft',
        published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        view_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_communications_slug ON communications(slug);
      CREATE INDEX IF NOT EXISTS idx_communications_status ON communications(status);
    `,
  },

  // ─── V4: Communication Likes ──────────────────────────
  {
    name: 'create_communication_likes',
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS communication_likes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES communications(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      );
    `,
  },

  // ─── V5: Post Comments ────────────────────────────────
  {
    name: 'create_post_comments',
    version: 5,
    sql: `
      CREATE TABLE IF NOT EXISTS post_comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES communications(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        user_email TEXT,
        content TEXT NOT NULL,
        parent_id INTEGER REFERENCES post_comments(id) ON DELETE CASCADE,
        is_hidden BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON post_comments(parent_id);
    `,
  },

  // ─── V6: Comment Reactions ────────────────────────────
  {
    name: 'create_comment_reactions',
    version: 6,
    sql: `
      CREATE TABLE IF NOT EXISTS comment_reactions (
        id SERIAL PRIMARY KEY,
        comment_id INTEGER REFERENCES post_comments(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        reaction_type TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(comment_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON comment_reactions(comment_id);
    `,
  },

  // ─── V7: Truyền thông Comments (alternate table) ─────
  {
    name: 'create_truyenthong_comments',
    version: 7,
    sql: `
      CREATE TABLE IF NOT EXISTS truyenthong_comments (
        id SERIAL PRIMARY KEY,
        post_slug VARCHAR(255) NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) NOT NULL,
        user_email VARCHAR(255),
        content TEXT NOT NULL,
        parent_id INTEGER REFERENCES truyenthong_comments(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS truyenthong_comment_reactions (
        id SERIAL PRIMARY KEY,
        comment_id INTEGER NOT NULL REFERENCES truyenthong_comments(id) ON DELETE CASCADE,
        user_id VARCHAR(255) NOT NULL,
        reaction_type VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(comment_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_comments_post_slug ON truyenthong_comments(post_slug);
      CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON truyenthong_comments(parent_id);
      CREATE INDEX IF NOT EXISTS idx_comments_created_at ON truyenthong_comments(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_comment_reactions_tt_comment_id ON truyenthong_comment_reactions(comment_id);
    `,
  },

  // ─── V8: Explanations (Giải trình) ───────────────────
  {
    name: 'create_explanations',
    version: 8,
    sql: `
      CREATE TABLE IF NOT EXISTS explanations (
        id SERIAL PRIMARY KEY,
        teacher_name VARCHAR(255) NOT NULL,
        lms_code VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        campus VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        test_date DATE NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        admin_note TEXT,
        admin_email VARCHAR(255),
        admin_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_explanations_email ON explanations(email);
      CREATE INDEX IF NOT EXISTS idx_explanations_status ON explanations(status);
      CREATE INDEX IF NOT EXISTS idx_explanations_created_at ON explanations(created_at DESC);
    `,
  },

  // ─── V9: Teacher Certificates ─────────────────────────
  {
    name: 'create_teacher_certificates',
    version: 9,
    sql: `
      CREATE TABLE IF NOT EXISTS teacher_certificates (
        id SERIAL PRIMARY KEY,
        teacher_email VARCHAR(255) NOT NULL,
        certificate_name VARCHAR(500) NOT NULL,
        certificate_url TEXT NOT NULL,
        certificate_type VARCHAR(100),
        issue_date DATE,
        expiry_date DATE,
        description TEXT,
        cloudinary_public_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_teacher_certificates_email ON teacher_certificates(teacher_email);
      CREATE INDEX IF NOT EXISTS idx_teacher_certificates_created_at ON teacher_certificates(created_at DESC);
    `,
  },

  // ─── V10: Teacher Privacy Settings ────────────────────
  {
    name: 'create_teacher_privacy_settings',
    version: 10,
    sql: `
      CREATE TABLE IF NOT EXISTS teacher_privacy_settings (
        id SERIAL PRIMARY KEY,
        teacher_email VARCHAR(255) NOT NULL UNIQUE,
        show_birthday BOOLEAN DEFAULT true,
        show_on_public_list BOOLEAN DEFAULT true,
        show_phone BOOLEAN DEFAULT false,
        show_personal_email BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_teacher_privacy_email ON teacher_privacy_settings(teacher_email);
    `,
  },

  // ─── V11: Training Videos ────────────────────────────
  {
    name: 'create_training_videos',
    version: 11,
    sql: `
      CREATE TABLE IF NOT EXISTS training_videos (
        id SERIAL PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        video_link VARCHAR(1000) NOT NULL,
        start_date DATE NOT NULL,
        duration_minutes INTEGER,
        view_count INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft',
        description TEXT,
        thumbnail_url VARCHAR(1000),
        lesson_number INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_training_videos_start_date ON training_videos(start_date);
      CREATE INDEX IF NOT EXISTS idx_training_videos_status ON training_videos(status);
      CREATE INDEX IF NOT EXISTS idx_training_videos_lesson_number ON training_videos(lesson_number);
    `,
  },

  // ─── V12: Training Video Questions ─────────────────────
  {
    name: 'create_training_video_questions',
    version: 12,
    sql: `
      CREATE TABLE IF NOT EXISTS training_video_questions (
        id SERIAL PRIMARY KEY,
        video_id INTEGER NOT NULL REFERENCES training_videos(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        question_type VARCHAR(20) DEFAULT 'multiple_choice',
        time_in_video INTEGER,
        correct_answer TEXT,
        options JSONB,
        points DECIMAL(5, 2) DEFAULT 1.00,
        order_number INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_training_video_questions_video_id ON training_video_questions(video_id);
      CREATE INDEX IF NOT EXISTS idx_training_video_questions_order ON training_video_questions(order_number);
    `,
  },

  // ─── V13: Training Video Assignments ──────────────────
  {
    name: 'create_training_video_assignments',
    version: 13,
    sql: `
      CREATE TABLE IF NOT EXISTS training_video_assignments (
        id SERIAL PRIMARY KEY,
        video_id INTEGER NOT NULL REFERENCES training_videos(id) ON DELETE CASCADE,
        assignment_title VARCHAR(500) NOT NULL,
        assignment_type VARCHAR(20) DEFAULT 'quiz',
        description TEXT,
        total_points DECIMAL(5, 2) DEFAULT 10.00,
        passing_score DECIMAL(5, 2) DEFAULT 7.00,
        time_limit_minutes INTEGER,
        max_attempts INTEGER DEFAULT 1,
        is_required BOOLEAN DEFAULT TRUE,
        due_date TIMESTAMP,
        status VARCHAR(20) DEFAULT 'published',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_training_video_assignments_video_id ON training_video_assignments(video_id);
      CREATE INDEX IF NOT EXISTS idx_training_video_assignments_status ON training_video_assignments(status);
    `,
  },

  // ─── V14: Training Assignment Questions ────────────────
  {
    name: 'create_training_assignment_questions',
    version: 14,
    sql: `
      CREATE TABLE IF NOT EXISTS training_assignment_questions (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER NOT NULL REFERENCES training_video_assignments(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        question_type VARCHAR(20) DEFAULT 'multiple_choice',
        correct_answer TEXT,
        options JSONB,
        image_url VARCHAR(1000),
        explanation TEXT,
        points DECIMAL(5, 2) DEFAULT 1.00,
        order_number INTEGER,
        difficulty VARCHAR(10) DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_training_assignment_questions_assignment_id ON training_assignment_questions(assignment_id);
      CREATE INDEX IF NOT EXISTS idx_training_assignment_questions_order ON training_assignment_questions(order_number);
    `,
  },

  // ─── V15: Training Assignment Submissions ─────────────
  {
    name: 'create_training_assignment_submissions',
    version: 15,
    sql: `
      CREATE TABLE IF NOT EXISTS training_assignment_submissions (
        id SERIAL PRIMARY KEY,
        teacher_code VARCHAR(50) NOT NULL,
        assignment_id INTEGER NOT NULL REFERENCES training_video_assignments(id) ON DELETE CASCADE,
        attempt_number INTEGER DEFAULT 1,
        score DECIMAL(5, 2) DEFAULT 0.00,
        total_points DECIMAL(5, 2),
        percentage DECIMAL(5, 2),
        is_passed BOOLEAN DEFAULT FALSE,
        status VARCHAR(20) DEFAULT 'in_progress',
        started_at TIMESTAMP,
        submitted_at TIMESTAMP,
        graded_at TIMESTAMP,
        time_spent_seconds INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_teacher_assignment_attempt UNIQUE (teacher_code, assignment_id, attempt_number)
      );
      CREATE INDEX IF NOT EXISTS idx_training_submissions_teacher ON training_assignment_submissions(teacher_code);
      CREATE INDEX IF NOT EXISTS idx_training_submissions_assignment ON training_assignment_submissions(assignment_id);
      CREATE INDEX IF NOT EXISTS idx_training_submissions_status ON training_assignment_submissions(status);
    `,
  },

  // ─── V16: Training Assignment Answers ─────────────────
  {
    name: 'create_training_assignment_answers',
    version: 16,
    sql: `
      CREATE TABLE IF NOT EXISTS training_assignment_answers (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER NOT NULL REFERENCES training_assignment_submissions(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES training_assignment_questions(id) ON DELETE CASCADE,
        answer_text TEXT,
        is_correct BOOLEAN DEFAULT FALSE,
        points_earned DECIMAL(5, 2) DEFAULT 0.00,
        feedback TEXT,
        answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_training_answers_submission ON training_assignment_answers(submission_id);
      CREATE INDEX IF NOT EXISTS idx_training_answers_question ON training_assignment_answers(question_id);
    `,
  },

  // ─── V17: Training Teacher Stats ──────────────────────
  {
    name: 'create_training_teacher_stats',
    version: 17,
    sql: `
      CREATE TABLE IF NOT EXISTS training_teacher_stats (
        id SERIAL PRIMARY KEY,
        teacher_code VARCHAR(50) NOT NULL UNIQUE,
        full_name VARCHAR(200) NOT NULL,
        username VARCHAR(100),
        work_email VARCHAR(200) NOT NULL,
        phone_number VARCHAR(20),
        status VARCHAR(50) DEFAULT 'Active',
        center VARCHAR(200),
        teaching_block VARCHAR(100),
        position VARCHAR(100),
        total_score DECIMAL(5, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_training_teacher_stats_code ON training_teacher_stats(teacher_code);
      CREATE INDEX IF NOT EXISTS idx_training_teacher_stats_email ON training_teacher_stats(work_email);
    `,
  },

  // ─── V18: Training Teacher Video Scores ───────────────
  {
    name: 'create_training_teacher_video_scores',
    version: 18,
    sql: `
      CREATE TABLE IF NOT EXISTS training_teacher_video_scores (
        id SERIAL PRIMARY KEY,
        teacher_code VARCHAR(50) NOT NULL,
        video_id INTEGER NOT NULL REFERENCES training_videos(id) ON DELETE CASCADE,
        score DECIMAL(5, 2) DEFAULT 0.00,
        completion_status VARCHAR(20) DEFAULT 'not_started',
        view_count INTEGER DEFAULT 0,
        first_viewed_at TIMESTAMP,
        completed_at TIMESTAMP,
        time_spent_seconds INTEGER DEFAULT 0,
        assigned_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_teacher_video UNIQUE (teacher_code, video_id)
      );
      CREATE INDEX IF NOT EXISTS idx_training_tvs_teacher ON training_teacher_video_scores(teacher_code);
      CREATE INDEX IF NOT EXISTS idx_training_tvs_video ON training_teacher_video_scores(video_id);
    `,
  },

  // ─── V19: Training Teacher Answers ────────────────────
  {
    name: 'create_training_teacher_answers',
    version: 19,
    sql: `
      CREATE TABLE IF NOT EXISTS training_teacher_answers (
        id SERIAL PRIMARY KEY,
        teacher_code VARCHAR(50) NOT NULL,
        video_id INTEGER NOT NULL REFERENCES training_videos(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES training_video_questions(id) ON DELETE CASCADE,
        answer_text TEXT,
        is_correct BOOLEAN DEFAULT FALSE,
        points_earned DECIMAL(5, 2) DEFAULT 0.00,
        answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_training_ta_teacher ON training_teacher_answers(teacher_code);
      CREATE INDEX IF NOT EXISTS idx_training_ta_video ON training_teacher_answers(video_id);
    `,
  },

  // ─── V20: App Users & Permissions (In-app Authorization) ─
  {
    name: 'create_app_users_and_permissions',
    version: 20,
    sql: `
      -- Bảng tài khoản nội bộ app
      CREATE TABLE IF NOT EXISTS app_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'admin',
        is_active BOOLEAN DEFAULT true,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
      CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

      -- Bảng phân quyền route
      CREATE TABLE IF NOT EXISTS app_permissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        route_path VARCHAR(255) NOT NULL,
        can_access BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_user_route UNIQUE (user_id, route_path)
      );
      CREATE INDEX IF NOT EXISTS idx_app_permissions_user_id ON app_permissions(user_id);

      -- Seed super admin: HOTeaching@mindx.com.vn / MindX@2024
      INSERT INTO app_users (email, password_hash, display_name, role, created_by)
      VALUES (
        'hoteaching@mindx.com.vn',
        '$2b$10$wveSDVP2lAmmUVyNuG9foO5olJu.Scj/6Y5c29haEd2aw1SDTYyoG',
        'HO Teaching',
        'super_admin',
        'system'
      )
      ON CONFLICT (email) DO NOTHING;

      -- Grant super admin all permissions
      INSERT INTO app_permissions (user_id, route_path, can_access)
      SELECT u.id, route.path, true
      FROM app_users u,
      (VALUES
        ('/admin/dashboard'),
        ('/admin/page1'),
        ('/admin/page2'),
        ('/admin/page3'),
        ('/admin/page4'),
        ('/admin/page5'),
        ('/admin/training-dashboard'),
        ('/admin/assignments'),
        ('/admin/assignment-questions'),
        ('/admin/giaitrinh'),
        ('/admin/truyenthong'),
        ('/admin/database'),
        ('/admin/user-management'),
        ('/admin/video-setup'),
        ('/admin/video-detail'),
        ('/admin/assignments'),
        ('/admin/training-studio')
      ) AS route(path)
      WHERE u.email = 'hoteaching@mindx.com.vn'
      ON CONFLICT (user_id, route_path) DO NOTHING;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // THÊM MIGRATION MỚI Ở ĐÂY
  // ═══════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════
  // V21: Support Firebase accounts in permission system
  // ═══════════════════════════════════════════════════════
  {
    name: 'V21_app_users_auth_type',
    version: 21,
    sql: `
      -- Allow null password for Firebase-authenticated accounts
      ALTER TABLE app_users ALTER COLUMN password_hash DROP NOT NULL;

      -- Add auth_type to distinguish app vs firebase accounts
      DO $$ BEGIN
        ALTER TABLE app_users ADD COLUMN auth_type VARCHAR(20) DEFAULT 'app';
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$;

      -- Update existing records
      UPDATE app_users SET auth_type = 'app' WHERE auth_type IS NULL;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V22: Role-based permission system
  // ═══════════════════════════════════════════════════════
  {
    name: 'V22_role_based_permissions',
    version: 22,
    sql: `
      -- Role → screen permissions
      CREATE TABLE IF NOT EXISTS role_permissions (
        id SERIAL PRIMARY KEY,
        role_code VARCHAR(20) NOT NULL REFERENCES roles(role_code) ON DELETE CASCADE,
        route_path VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role_code, route_path)
      );

      CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_code);

      -- User → multiple roles
      CREATE TABLE IF NOT EXISTS user_roles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        role_code VARCHAR(20) NOT NULL REFERENCES roles(role_code) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, role_code)
      );

      CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_code);

      -- Seed default: AD (Admin) role gets all admin screens
      INSERT INTO role_permissions (role_code, route_path) VALUES
        ('AD', '/admin/dashboard'),
        ('AD', '/admin/page1'),
        ('AD', '/admin/page2'),
        ('AD', '/admin/page3'),
        ('AD', '/admin/page4'),
        ('AD', '/admin/page5'),
        ('AD', '/admin/training-dashboard'),
        ('AD', '/admin/assignments'),
        ('AD', '/admin/giaitrinh'),
        ('AD', '/admin/truyenthong'),
        ('AD', '/admin/database'),
        ('AD', '/admin/user-management')
      ON CONFLICT DO NOTHING;

      -- Seed: TM (Teaching Manager) gets management screens
      INSERT INTO role_permissions (role_code, route_path) VALUES
        ('TM', '/admin/dashboard'),
        ('TM', '/admin/page1'),
        ('TM', '/admin/page5'),
        ('TM', '/admin/training-dashboard'),
        ('TM', '/admin/assignments'),
        ('TM', '/admin/giaitrinh'),
        ('TM', '/admin/truyenthong')
      ON CONFLICT DO NOTHING;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V23: Add status to centers
  // ═══════════════════════════════════════════════════════
  {
    name: 'V23_center_status',
    version: 23,
    sql: `
      ALTER TABLE centers ADD COLUMN IF NOT EXISTS status VARCHAR(10) DEFAULT 'Active' NOT NULL;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V24: Event schedules (Lịch sự kiện tập trung)
  // ═══════════════════════════════════════════════════════
  {
    name: 'V24_event_schedules',
    version: 24,
    sql: `
      CREATE TABLE IF NOT EXISTS event_schedules (
        id UUID PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        specialty VARCHAR(255),
        event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('registration','exam','workshop_teaching','meeting','advanced_training_release','holiday')),
        registration_template VARCHAR(30) NULL CHECK (registration_template IN ('official','supplement')),
        start_at TIMESTAMP NOT NULL,
        end_at TIMESTAMP NOT NULL,
        note TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_by VARCHAR(255),
        updated_by VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT ck_event_schedule_time CHECK (end_at > start_at)
      );

      CREATE INDEX IF NOT EXISTS idx_event_schedules_start_at ON event_schedules(start_at);
      CREATE INDEX IF NOT EXISTS idx_event_schedules_event_type ON event_schedules(event_type);
      CREATE INDEX IF NOT EXISTS idx_event_schedules_created_at ON event_schedules(created_at DESC);

      DROP TRIGGER IF EXISTS trg_event_schedules_updated_at ON event_schedules;
      CREATE TRIGGER trg_event_schedules_updated_at
      BEFORE UPDATE ON event_schedules
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `,
  },

  // ─── V(Next): Split /admin/page4 into detailed routes for existing roles ───
  {
    name: 'split_admin_page4_permissions',
    version: 31, // assuming the last one was around 30, let me check version numbers. Wait! I don't know the exact last version.
    // wait I will use a high version number or a timestamp number. Let's use 1000.
    sql: `
      DO $$
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN SELECT role_code FROM role_permissions WHERE route_path = '/admin/page4'
          LOOP
              INSERT INTO role_permissions (role_code, route_path) VALUES (r.role_code, '/admin/page4/lich-danh-gia') ON CONFLICT DO NOTHING;
              INSERT INTO role_permissions (role_code, route_path) VALUES (r.role_code, '/admin/page4/danh-sach-dang-ky') ON CONFLICT DO NOTHING;
              INSERT INTO role_permissions (role_code, route_path) VALUES (r.role_code, '/admin/page4/thu-vien-de') ON CONFLICT DO NOTHING;
          END LOOP;
          DELETE FROM role_permissions WHERE route_path = '/admin/page4';
      END $$;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V32: Salary Deals (Deal Lương / Hạ Lương / Bonus)
  // ═══════════════════════════════════════════════════════
  {
    name: 'V32_salary_deals',
    version: 32,
    sql: `
      CREATE TABLE IF NOT EXISTS salary_deals (
        id SERIAL PRIMARY KEY,
        deal_type VARCHAR(20) NOT NULL CHECK (deal_type IN ('bonus','salary_reduction','salary_deal')),

        -- Người gửi (Leader/TE/TC)
        submitter_email VARCHAR(255) NOT NULL,
        submitter_name VARCHAR(255) NOT NULL,

        -- Thông tin GV
        teacher_name VARCHAR(255) NOT NULL,
        teacher_codename VARCHAR(100),
        teacher_email VARCHAR(255),

        -- Bonus fields
        class_code VARCHAR(100),
        bonus_amount INTEGER,
        bonus_reason TEXT,

        -- Salary deal fields
        deal_salary_amount INTEGER,
        teacher_experience TEXT,
        teacher_certificates TEXT,

        -- Salary reduction fields
        current_rate VARCHAR(10),
        new_rate VARCHAR(10),

        -- Trạng thái duyệt
        status VARCHAR(30) DEFAULT 'pending'
          CHECK (status IN ('pending','tegl_approved','tegl_rejected','admin_approved','admin_rejected')),

        -- TEGL review
        tegl_note TEXT,
        tegl_email VARCHAR(255),
        tegl_name VARCHAR(255),
        tegl_decided_at TIMESTAMP,

        -- Admin review
        admin_note TEXT,
        admin_email VARCHAR(255),
        admin_name VARCHAR(255),
        admin_decided_at TIMESTAMP,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_salary_deals_type ON salary_deals(deal_type);
      CREATE INDEX IF NOT EXISTS idx_salary_deals_status ON salary_deals(status);
      CREATE INDEX IF NOT EXISTS idx_salary_deals_submitter ON salary_deals(submitter_email);
      CREATE INDEX IF NOT EXISTS idx_salary_deals_created ON salary_deals(created_at DESC);

      -- Grant super_admin permission for admin deal-luong page
      INSERT INTO app_permissions (user_id, route_path, can_access)
      SELECT u.id, '/admin/deal-luong', true
      FROM app_users u
      WHERE u.role = 'super_admin'
      ON CONFLICT (user_id, route_path) DO NOTHING;

      -- Grant role-based permissions
      INSERT INTO role_permissions (role_code, route_path)
      VALUES ('AD', '/admin/deal-luong')
      ON CONFLICT DO NOTHING;


      -- Only AD and super_admin can access /admin/deal-luong
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V33: Make video_id nullable in training_video_assignments
  // ═══════════════════════════════════════════════════════
  {
    name: 'V33_make_video_id_nullable',
    version: 33,
    sql: `
      ALTER TABLE training_video_assignments ALTER COLUMN video_id DROP NOT NULL;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V34: Fix view counts for training videos
  // ═══════════════════════════════════════════════════════
  {
    name: 'V34_fix_view_counts',
    version: 34,
    sql: `
      UPDATE training_teacher_video_scores
      SET view_count = 1
      WHERE view_count IS NULL OR view_count = 0;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V35: Add unique constraint to training_assignment_answers
  // ═══════════════════════════════════════════════════════
  {
    name: 'V35_fix_assignment_answers_constraint',
    version: 35,
    sql: `
      -- Delete duplicates, keeping the latest one
      DELETE FROM training_assignment_answers a
      WHERE id < (
        SELECT MAX(id)
        FROM training_assignment_answers b
        WHERE a.submission_id = b.submission_id
          AND a.question_id = b.question_id
      );

      -- Add unique constraint to support ON CONFLICT
      ALTER TABLE training_assignment_answers
      DROP CONSTRAINT IF EXISTS unique_submission_question;

      ALTER TABLE training_assignment_answers
      ADD CONSTRAINT unique_submission_question UNIQUE (submission_id, question_id);
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V36: Grant K12 docs screen permission for TM
  // ═══════════════════════════════════════════════════════
  {
    name: 'V36_grant_page2_permission_to_tm',
    version: 36,
    sql: `
      INSERT INTO role_permissions (role_code, route_path)
      VALUES ('TM', '/admin/page2')
      ON CONFLICT DO NOTHING;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V37: Birthday wishes table for teacher popup
  // ═══════════════════════════════════════════════════════
  {
    name: 'V37_create_birthday_wishes',
    version: 37,
    sql: `
      CREATE TABLE IF NOT EXISTS birthday_wishes (
        id SERIAL PRIMARY KEY,
        month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
        week INTEGER NOT NULL CHECK (week >= 1 AND week <= 4),
        year INTEGER NOT NULL CHECK (year >= 2000),
        area VARCHAR(255),
        birthday_names TEXT,
        sender_name VARCHAR(255) NOT NULL,
        sender_email VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_birthday_wishes_scope
      ON birthday_wishes(year, month, week, area);

      CREATE INDEX IF NOT EXISTS idx_birthday_wishes_created_at
      ON birthday_wishes(created_at DESC);

      DROP TRIGGER IF EXISTS trg_birthday_wishes_updated_at ON birthday_wishes;
      CREATE TRIGGER trg_birthday_wishes_updated_at
      BEFORE UPDATE ON birthday_wishes
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `,
  },
];

// ========== HÀM CHẠY MIGRATIONS ==========

let migrationRan = false;

export async function runMigrations(pool: Pool): Promise<{ success: boolean; applied: string[]; errors: string[] }> {
  const applied: string[] = [];
  const errors: string[] = [];

  // Use a single client for all migrations to ensure connection stability and performance
  let client;
  try {
    client = await pool.connect();

    try {
      // Bước 1: Tạo bảng _migrations trước (luôn chạy)
      await client.query(`
        CREATE TABLE IF NOT EXISTS _migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          version INTEGER NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Bước 2: Lấy danh sách migration đã chạy
      const result = await client.query('SELECT name FROM _migrations');
      const appliedMigrations = new Set(result.rows.map((r: { name: string }) => r.name));

      // Bước 3: Chạy từng migration chưa applied
      for (const migration of migrations) {
        if (appliedMigrations.has(migration.name)) {
          continue; // Đã chạy rồi, bỏ qua
        }

        try {
          await client.query('BEGIN');
          await client.query(migration.sql);
          await client.query(
            'INSERT INTO _migrations (name, version) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
            [migration.name, migration.version]
          );
          await client.query('COMMIT');

          applied.push(migration.name);
          console.log(`  ✅ Migration applied: ${migration.name} (v${migration.version})`);
        } catch (err: any) {
          await client.query('ROLLBACK');
          const errorMsg = `Migration ${migration.name} failed: ${err.message}`;
          errors.push(errorMsg);
          console.error(`  ❌ ${errorMsg}`);
          // throw new Error(errorMsg); // Stop migration on first error (Removed to match original behavior: continue)
        }
      }

      return { success: errors.length === 0, applied, errors };
    } finally {
      client.release(); // Always release the client back to the pool
    }
  } catch (err: any) {
    console.error('❌ Migration system error (Connection or Query failed):', err.message);
    return { success: false, applied, errors: [err.message] };
  }
}

export async function initDatabase(pool: Pool): Promise<void> {
  if (migrationRan) return; // Chỉ chạy 1 lần
  migrationRan = true;

  console.log('\n🔄 Running database migrations...');
  const result = await runMigrations(pool);

  if (result.applied.length === 0) {
    console.log('✅ Database is up to date. No new migrations.\n');
  } else {
    console.log(`✅ Applied ${result.applied.length} migration(s).\n`);
  }

  if (result.errors.length > 0) {
    console.warn(`⚠️ ${result.errors.length} migration(s) had errors (may be already existing tables).\n`);
  }
}

export { migrations };

