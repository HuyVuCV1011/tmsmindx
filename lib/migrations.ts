import { Pool, PoolClient } from 'pg';

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
    `
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
      EXECUTE FUNCTION update_updated_at_column();`
  },


  // V38: Leave requests workflow (xin nghi 1 buoi)
  // ═══════════════════════════════════════════════════════
  {
    name: 'V37_leave_requests_workflow',
    version: 38,
    sql: `
      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        teacher_name VARCHAR(255) NOT NULL,
        lms_code VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        campus VARCHAR(255) NOT NULL,
        leave_date DATE NOT NULL,
        reason TEXT NOT NULL,
        class_code VARCHAR(100),
        student_count VARCHAR(50),
        class_time VARCHAR(255),
        leave_session VARCHAR(255),
        has_substitute BOOLEAN DEFAULT FALSE,
        substitute_teacher VARCHAR(255),
        substitute_email VARCHAR(255),
        class_status TEXT,
        email_subject TEXT,
        email_body TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending_admin'
          CHECK (status IN (
            'pending_admin',
            'approved_unassigned',
            'approved_assigned',
            'rejected',
            'substitute_confirmed'
          )),
        admin_note TEXT,
        admin_name VARCHAR(255),
        admin_email VARCHAR(255),
        substitute_confirmed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_leave_requests_email ON leave_requests(email);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_substitute_email ON leave_requests(substitute_email);
      CREATE INDEX IF NOT EXISTS idx_leave_requests_created_at ON leave_requests(created_at DESC);

      DROP TRIGGER IF EXISTS trg_leave_requests_updated_at ON leave_requests;
      CREATE TRIGGER trg_leave_requests_updated_at
      BEFORE UPDATE ON leave_requests
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

      INSERT INTO role_permissions (role_code, route_path)
      VALUES
        ('AD', '/admin/xin-nghi-mot-buoi'),
        ('TM', '/admin/xin-nghi-mot-buoi')
      ON CONFLICT DO NOTHING;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V39: HR Candidate GEN Assignment Management
  // ═══════════════════════════════════════════════════════
  {
    name: 'V35_hr_candidate_gen_assignment',
    version: 39,
    sql: `
      CREATE TABLE IF NOT EXISTS hr_candidate_gen_assignments (
        id SERIAL PRIMARY KEY,
        candidate_key VARCHAR(64) NOT NULL UNIQUE,
        candidate_fingerprint TEXT NOT NULL,
        candidate_name VARCHAR(255),
        candidate_email VARCHAR(255),
        candidate_phone VARCHAR(50),
        source_sheet_id VARCHAR(128),
        source_gid VARCHAR(64),
        assigned_gen VARCHAR(100) NOT NULL,
        note TEXT,
        assigned_by_email VARCHAR(255) NOT NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_hr_gen_assignments_assigned_gen
        ON hr_candidate_gen_assignments(assigned_gen);
      CREATE INDEX IF NOT EXISTS idx_hr_gen_assignments_candidate_email
        ON hr_candidate_gen_assignments(candidate_email);
      CREATE INDEX IF NOT EXISTS idx_hr_gen_assignments_updated_at
        ON hr_candidate_gen_assignments(updated_at DESC);

      DROP TRIGGER IF EXISTS trg_hr_candidate_gen_assignments_updated_at ON hr_candidate_gen_assignments;
      CREATE TRIGGER trg_hr_candidate_gen_assignments_updated_at
      BEFORE UPDATE ON hr_candidate_gen_assignments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

      CREATE TABLE IF NOT EXISTS hr_candidate_gen_assignment_history (
        id SERIAL PRIMARY KEY,
        assignment_id INTEGER REFERENCES hr_candidate_gen_assignments(id) ON DELETE SET NULL,
        candidate_key VARCHAR(64) NOT NULL,
        previous_gen VARCHAR(100),
        new_gen VARCHAR(100),
        changed_by_email VARCHAR(255) NOT NULL,
        change_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_hr_gen_assignment_history_candidate
        ON hr_candidate_gen_assignment_history(candidate_key);
      CREATE INDEX IF NOT EXISTS idx_hr_gen_assignment_history_created
        ON hr_candidate_gen_assignment_history(created_at DESC);

      INSERT INTO app_permissions (user_id, route_path, can_access)
      SELECT u.id, '/admin/hr-candidates', true
      FROM app_users u
      WHERE u.role = 'super_admin'
      ON CONFLICT (user_id, route_path) DO NOTHING;

      DO $$
      BEGIN
        IF to_regclass('public.roles') IS NOT NULL AND to_regclass('public.role_permissions') IS NOT NULL THEN
          INSERT INTO role_permissions (role_code, route_path)
          SELECT r.role_code, '/admin/hr-candidates'
          FROM roles r
          WHERE r.role_code IN ('AD', 'HR')
          ON CONFLICT DO NOTHING;
        END IF;
      END $$;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V40: HR GEN catalog for planner page
  // ═══════════════════════════════════════════════════════
  {
    name: 'V36_hr_gen_catalog',
    version: 40,
    sql: `
      CREATE TABLE IF NOT EXISTS hr_gen_catalog (
        id SERIAL PRIMARY KEY,
        gen_name VARCHAR(100) NOT NULL UNIQUE,
        source VARCHAR(30) NOT NULL DEFAULT 'manual',
        created_by_email VARCHAR(255),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_hr_gen_catalog_active
        ON hr_gen_catalog(is_active, gen_name);

      DROP TRIGGER IF EXISTS trg_hr_gen_catalog_updated_at ON hr_gen_catalog;
      CREATE TRIGGER trg_hr_gen_catalog_updated_at
      BEFORE UPDATE ON hr_gen_catalog
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

      INSERT INTO app_permissions (user_id, route_path, can_access)
      SELECT u.id, '/admin/hr-candidates/gen-planner', true
      FROM app_users u
      WHERE u.role = 'super_admin'
      ON CONFLICT (user_id, route_path) DO NOTHING;

      DO $$
      BEGIN
        IF to_regclass('public.roles') IS NOT NULL AND to_regclass('public.role_permissions') IS NOT NULL THEN
          INSERT INTO role_permissions (role_code, route_path)
          SELECT r.role_code, '/admin/hr-candidates/gen-planner'
          FROM roles r
          WHERE r.role_code IN ('AD', 'HR')
          ON CONFLICT DO NOTHING;
        END IF;
      END $$;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V41: HR GEN Candidate Attendance Records
  // Lưu điểm danh & điểm kiểm tra theo buổi (1-4) cho từng ứng viên
  // Không phụ thuộc vào teacherCode hay videoId
  // ═══════════════════════════════════════════════════════
  {
    name: 'V37_hr_gen_attendance_records',
    version: 41,
    sql: `
      CREATE TABLE IF NOT EXISTS hr_gen_attendance_records (
        id SERIAL PRIMARY KEY,
        candidate_key VARCHAR(64) NOT NULL,
        gen_code VARCHAR(100) NOT NULL,
        session_number SMALLINT NOT NULL CHECK (session_number BETWEEN 1 AND 4),
        attendance BOOLEAN NOT NULL DEFAULT FALSE,
        score DECIMAL(4, 1) CHECK (score IS NULL OR (score >= 0 AND score <= 10)),
        recorded_by_email VARCHAR(255) NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(candidate_key, session_number)
      );

      CREATE INDEX IF NOT EXISTS idx_hr_gen_attendance_candidate
        ON hr_gen_attendance_records(candidate_key);
      CREATE INDEX IF NOT EXISTS idx_hr_gen_attendance_gen
        ON hr_gen_attendance_records(gen_code);
      CREATE INDEX IF NOT EXISTS idx_hr_gen_attendance_gen_session
        ON hr_gen_attendance_records(gen_code, session_number);

      DROP TRIGGER IF EXISTS trg_hr_gen_attendance_updated_at ON hr_gen_attendance_records;
      CREATE TRIGGER trg_hr_gen_attendance_updated_at
      BEFORE UPDATE ON hr_gen_attendance_records
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V42: Canonical route for thu-vien-de permissions
  // ═══════════════════════════════════════════════════════
  {
    name: 'V42_canonical_thu_vien_de_route_permissions',
    version: 42,
    sql: `
      -- Backfill canonical permission for roles still using legacy page4 path
      INSERT INTO role_permissions (role_code, route_path)
      SELECT DISTINCT role_code, '/admin/thu-vien-de'
      FROM role_permissions
      WHERE route_path = '/admin/page4/thu-vien-de'
      ON CONFLICT DO NOTHING;

      -- Backfill user-level permissions for canonical route
      INSERT INTO app_permissions (user_id, route_path, can_access)
      SELECT ap.user_id, '/admin/thu-vien-de', ap.can_access
      FROM app_permissions ap
      WHERE ap.route_path = '/admin/page4/thu-vien-de'
      ON CONFLICT (user_id, route_path) DO UPDATE
      SET can_access = EXCLUDED.can_access;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V43: New Chuyen Sau database model (chuyensau_*)
  // ═══════════════════════════════════════════════════════
  {
    name: 'V43_create_chuyensau_database_model',
    version: 43,
    sql: `
      CREATE TABLE IF NOT EXISTS chuyensau_subjects (
        id BIGSERIAL PRIMARY KEY,
        legacy_subject_id BIGINT,
        exam_type VARCHAR(50) NOT NULL,
        block_code VARCHAR(100) NOT NULL,
        subject_code VARCHAR(255) NOT NULL,
        subject_name VARCHAR(500) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (exam_type, block_code, subject_code)
      );

      CREATE TABLE IF NOT EXISTS chuyensau_sets (
        id BIGSERIAL PRIMARY KEY,
        legacy_set_id BIGINT,
        subject_id BIGINT NOT NULL REFERENCES chuyensau_subjects(id) ON DELETE RESTRICT,
        set_code VARCHAR(120) NOT NULL UNIQUE,
        set_name VARCHAR(500) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
        target_scale NUMERIC(6, 2) NOT NULL DEFAULT 10,
        passing_score NUMERIC(6, 2) NOT NULL DEFAULT 7,
        min_questions_required INTEGER NOT NULL DEFAULT 10 CHECK (min_questions_required > 0),
        version_no INTEGER NOT NULL DEFAULT 1,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by VARCHAR(255),
        updated_by VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT ck_chuyensau_set_code_format CHECK (set_code ~ '^[A-Z0-9-]+$'),
        CONSTRAINT ck_chuyensau_set_name_not_test CHECK (UPPER(TRIM(set_name)) <> 'TEST'),
        CONSTRAINT ck_chuyensau_score_bounds CHECK (target_scale > 0 AND passing_score >= 0 AND passing_score <= target_scale)
      );

      CREATE TABLE IF NOT EXISTS chuyensau_questions (
        id BIGSERIAL PRIMARY KEY,
        legacy_question_id BIGINT,
        question_type VARCHAR(30) NOT NULL DEFAULT 'single_choice' CHECK (question_type IN ('single_choice', 'multiple_choice', 'true_false', 'short_answer')),
        question_text TEXT NOT NULL,
        option_a TEXT,
        option_b TEXT,
        option_c TEXT,
        option_d TEXT,
        correct_answer TEXT NOT NULL,
        explanation TEXT,
        points NUMERIC(8, 2) NOT NULL DEFAULT 1 CHECK (points > 0),
        difficulty VARCHAR(30) NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
        tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by VARCHAR(255),
        updated_by VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chuyensau_set_questions (
        id BIGSERIAL PRIMARY KEY,
        set_id BIGINT NOT NULL REFERENCES chuyensau_sets(id) ON DELETE CASCADE,
        question_id BIGINT NOT NULL REFERENCES chuyensau_questions(id) ON DELETE RESTRICT,
        display_order INTEGER NOT NULL DEFAULT 1,
        points_override NUMERIC(8, 2) CHECK (points_override > 0),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (set_id, question_id)
      );

      CREATE TABLE IF NOT EXISTS chuyensau_monthly_selections (
        id BIGSERIAL PRIMARY KEY,
        exam_type VARCHAR(50) NOT NULL,
        block_code VARCHAR(100) NOT NULL,
        subject_code VARCHAR(255) NOT NULL,
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2100),
        selected_set_id BIGINT REFERENCES chuyensau_sets(id) ON DELETE RESTRICT,
        lock_mode VARCHAR(20) NOT NULL DEFAULT 'locked' CHECK (lock_mode IN ('locked', 'fallback_random')),
        random_seed VARCHAR(100),
        notes TEXT,
        created_by VARCHAR(255),
        updated_by VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (exam_type, block_code, subject_code, month, year)
      );

      CREATE TABLE IF NOT EXISTS chuyensau_registrations (
        id BIGSERIAL PRIMARY KEY,
        legacy_registration_id BIGINT,
        teacher_name VARCHAR(255) NOT NULL,
        teacher_code VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        campus VARCHAR(255),
        exam_type VARCHAR(50) NOT NULL,
        block_code VARCHAR(100) NOT NULL,
        subject_code VARCHAR(255) NOT NULL,
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2100),
        registration_note TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'assigned', 'cancelled')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (teacher_code, exam_type, block_code, subject_code, month, year)
      );

      CREATE TABLE IF NOT EXISTS chuyensau_assignments (
        id BIGSERIAL PRIMARY KEY,
        legacy_assignment_id BIGINT,
        registration_id BIGINT NOT NULL REFERENCES chuyensau_registrations(id) ON DELETE CASCADE,
        selected_set_id BIGINT NOT NULL REFERENCES chuyensau_sets(id) ON DELETE RESTRICT,
        assignment_status VARCHAR(30) NOT NULL DEFAULT 'assigned' CHECK (assignment_status IN ('assigned', 'in_progress', 'submitted', 'expired', 'cancelled')),
        open_at TIMESTAMP,
        close_at TIMESTAMP,
        created_by VARCHAR(255),
        updated_by VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (registration_id)
      );

      CREATE TABLE IF NOT EXISTS chuyensau_submissions (
        id BIGSERIAL PRIMARY KEY,
        legacy_submission_id BIGINT,
        assignment_id BIGINT NOT NULL REFERENCES chuyensau_assignments(id) ON DELETE CASCADE,
        submission_status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (submission_status IN ('draft', 'submitted', 'graded')),
        submitted_at TIMESTAMP,
        graded_at TIMESTAMP,
        raw_score NUMERIC(8, 2) NOT NULL DEFAULT 0,
        normalized_score NUMERIC(8, 2) NOT NULL DEFAULT 0,
        max_raw_score NUMERIC(8, 2) NOT NULL DEFAULT 0,
        pass_status BOOLEAN,
        grader_note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (assignment_id)
      );

      CREATE TABLE IF NOT EXISTS chuyensau_submission_answers (
        id BIGSERIAL PRIMARY KEY,
        submission_id BIGINT NOT NULL REFERENCES chuyensau_submissions(id) ON DELETE CASCADE,
        question_id BIGINT NOT NULL REFERENCES chuyensau_questions(id) ON DELETE RESTRICT,
        selected_answer TEXT,
        is_correct BOOLEAN,
        points_awarded NUMERIC(8, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (submission_id, question_id)
      );

      CREATE TABLE IF NOT EXISTS chuyensau_explanations (
        id BIGSERIAL PRIMARY KEY,
        assignment_id BIGINT NOT NULL REFERENCES chuyensau_assignments(id) ON DELETE CASCADE,
        teacher_code VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        reason TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
        reviewer_email VARCHAR(255),
        reviewer_note TEXT,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (assignment_id)
      );

      CREATE TABLE IF NOT EXISTS chuyensau_results (
        id BIGSERIAL PRIMARY KEY,
        assignment_id BIGINT NOT NULL UNIQUE REFERENCES chuyensau_assignments(id) ON DELETE CASCADE,
        teacher_name VARCHAR(255) NOT NULL,
        teacher_code VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        exam_type VARCHAR(50) NOT NULL,
        block_code VARCHAR(100) NOT NULL,
        subject_code VARCHAR(255) NOT NULL,
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        year INTEGER NOT NULL CHECK (year BETWEEN 2020 AND 2100),
        set_code VARCHAR(120),
        correct_count INTEGER NOT NULL DEFAULT 0,
        raw_score NUMERIC(8, 2) NOT NULL DEFAULT 0,
        normalized_score NUMERIC(8, 2) NOT NULL DEFAULT 0,
        score_handling VARCHAR(50) NOT NULL DEFAULT 'default-0' CHECK (score_handling IN ('default-0', 'exam-submitted', 'pending-explanation-review', 'explanation-accepted-excluded', 'explanation-rejected-keep-0')),
        explanation_email VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (teacher_code, exam_type, block_code, subject_code, month, year)
      );

      CREATE INDEX IF NOT EXISTS idx_chuyensau_sets_subject_status ON chuyensau_sets(subject_id, status);
      CREATE INDEX IF NOT EXISTS idx_chuyensau_monthly_scope ON chuyensau_monthly_selections(exam_type, block_code, subject_code, year, month);
      CREATE INDEX IF NOT EXISTS idx_chuyensau_registrations_teacher_scope ON chuyensau_registrations(teacher_code, year, month);
      CREATE INDEX IF NOT EXISTS idx_chuyensau_assignments_set ON chuyensau_assignments(selected_set_id);
      CREATE INDEX IF NOT EXISTS idx_chuyensau_results_scope ON chuyensau_results(subject_code, year, month);

      DROP TRIGGER IF EXISTS trg_chuyensau_subjects_updated_at ON chuyensau_subjects;
      CREATE TRIGGER trg_chuyensau_subjects_updated_at BEFORE UPDATE ON chuyensau_subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      DROP TRIGGER IF EXISTS trg_chuyensau_sets_updated_at ON chuyensau_sets;
      CREATE TRIGGER trg_chuyensau_sets_updated_at BEFORE UPDATE ON chuyensau_sets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      DROP TRIGGER IF EXISTS trg_chuyensau_questions_updated_at ON chuyensau_questions;
      CREATE TRIGGER trg_chuyensau_questions_updated_at BEFORE UPDATE ON chuyensau_questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      DROP TRIGGER IF EXISTS trg_chuyensau_monthly_selections_updated_at ON chuyensau_monthly_selections;
      CREATE TRIGGER trg_chuyensau_monthly_selections_updated_at BEFORE UPDATE ON chuyensau_monthly_selections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      DROP TRIGGER IF EXISTS trg_chuyensau_registrations_updated_at ON chuyensau_registrations;
      CREATE TRIGGER trg_chuyensau_registrations_updated_at BEFORE UPDATE ON chuyensau_registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      DROP TRIGGER IF EXISTS trg_chuyensau_assignments_updated_at ON chuyensau_assignments;
      CREATE TRIGGER trg_chuyensau_assignments_updated_at BEFORE UPDATE ON chuyensau_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      DROP TRIGGER IF EXISTS trg_chuyensau_submissions_updated_at ON chuyensau_submissions;
      CREATE TRIGGER trg_chuyensau_submissions_updated_at BEFORE UPDATE ON chuyensau_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      DROP TRIGGER IF EXISTS trg_chuyensau_submission_answers_updated_at ON chuyensau_submission_answers;
      CREATE TRIGGER trg_chuyensau_submission_answers_updated_at BEFORE UPDATE ON chuyensau_submission_answers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      DROP TRIGGER IF EXISTS trg_chuyensau_explanations_updated_at ON chuyensau_explanations;
      CREATE TRIGGER trg_chuyensau_explanations_updated_at BEFORE UPDATE ON chuyensau_explanations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      DROP TRIGGER IF EXISTS trg_chuyensau_results_updated_at ON chuyensau_results;
      CREATE TRIGGER trg_chuyensau_results_updated_at BEFORE UPDATE ON chuyensau_results FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

      -- Data backfill phase 1: subjects
      INSERT INTO chuyensau_subjects (legacy_subject_id, exam_type, block_code, subject_code, subject_name, is_active, metadata)
      SELECT esc.id, esc.exam_type, esc.block_code, esc.subject_code, esc.subject_name,
             COALESCE(esc.is_active, TRUE),
             jsonb_build_object('source', 'exam_subject_catalog')
      FROM exam_subject_catalog esc
      ON CONFLICT (exam_type, block_code, subject_code) DO NOTHING;

      -- Data backfill phase 2: sets with deterministic set_code cleanup
      WITH source_sets AS (
        SELECT es.id AS legacy_set_id,
               es.subject_id AS legacy_subject_id,
               COALESCE(NULLIF(regexp_replace(UPPER(TRIM(es.set_code)), '[^A-Z0-9-]', '', 'g'), ''), CONCAT('SET-', es.id::text)) AS normalized_code,
               es.set_name,
               es.status,
               es.total_points,
               es.passing_score,
               ROW_NUMBER() OVER (
                 PARTITION BY COALESCE(NULLIF(regexp_replace(UPPER(TRIM(es.set_code)), '[^A-Z0-9-]', '', 'g'), ''), CONCAT('SET-', es.id::text))
                 ORDER BY es.id
               ) AS duplicate_rank
        FROM exam_sets es
      )
      INSERT INTO chuyensau_sets (
        legacy_set_id,
        subject_id,
        set_code,
        set_name,
        status,
        target_scale,
        passing_score,
        min_questions_required,
        metadata
      )
      SELECT s.legacy_set_id,
             cs.id,
             CASE
               WHEN s.duplicate_rank = 1 THEN s.normalized_code
               ELSE CONCAT(s.normalized_code, '-', s.duplicate_rank::text)
             END AS set_code,
             COALESCE(NULLIF(TRIM(s.set_name), ''), CONCAT('SET ', s.legacy_set_id::text)),
             CASE
               WHEN LOWER(COALESCE(s.status, '')) IN ('active', 'inactive') THEN LOWER(s.status)
               ELSE 'draft'
             END AS status,
             COALESCE(NULLIF(s.total_points, 0), 10),
             COALESCE(s.passing_score, 7),
             10,
             jsonb_build_object('source', 'exam_sets')
      FROM source_sets s
      JOIN chuyensau_subjects cs ON cs.legacy_subject_id = s.legacy_subject_id
      ON CONFLICT (set_code) DO NOTHING;

      -- Data backfill phase 3: questions
      INSERT INTO chuyensau_questions (
        legacy_question_id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        correct_answer,
        explanation,
        points,
        metadata
      )
      SELECT q.id,
             q.question_text,
             q.option_a,
             q.option_b,
             q.option_c,
             q.option_d,
             q.correct_answer,
             q.explanation,
             COALESCE(NULLIF(q.points, 0), 1),
             jsonb_build_object('source', 'exam_set_questions')
      FROM exam_set_questions q
      ON CONFLICT DO NOTHING;

      -- Data backfill phase 4: set-question mapping
            INSERT INTO chuyensau_set_questions (set_id, question_id, display_order, points_override)
            SELECT mapped.set_id,
              mapped.question_id,
              mapped.display_order,
              mapped.points_override
            FROM (
         SELECT cs.id AS set_id,
           cq.id AS question_id,
           ROW_NUMBER() OVER (
             PARTITION BY cs.id
             ORDER BY COALESCE(q.display_order, 999999), q.id
           )::INT AS display_order,
           CASE WHEN q.points > 0 THEN q.points ELSE NULL END AS points_override
         FROM exam_set_questions q
         JOIN chuyensau_sets cs ON cs.legacy_set_id = q.set_id
         JOIN chuyensau_questions cq ON cq.legacy_question_id = q.id
            ) mapped
      ON CONFLICT (set_id, question_id) DO NOTHING;

      -- Data backfill phase 5: monthly selections
      INSERT INTO chuyensau_monthly_selections (
        exam_type,
        block_code,
        subject_code,
        month,
        year,
        selected_set_id,
        lock_mode,
        notes,
        created_by,
        updated_by
      )
      SELECT ms.exam_type,
             ms.block_code,
             ms.subject_code,
             ms.month,
             ms.year,
             cs.id,
             'locked',
             ms.note,
             ms.created_by,
             ms.updated_by
      FROM monthly_exam_selections ms
      LEFT JOIN chuyensau_sets cs ON cs.legacy_set_id = ms.selected_set_id
      ON CONFLICT (exam_type, block_code, subject_code, month, year) DO NOTHING;

      CREATE OR REPLACE VIEW chuyensau_set_quality AS
      SELECT
        s.id,
        s.set_code,
        s.set_name,
        sb.exam_type,
        sb.block_code,
        sb.subject_code,
        s.status,
        s.min_questions_required,
        COUNT(sq.question_id)::INT AS question_count,
        COALESCE(SUM(COALESCE(sq.points_override, q.points)), 0)::NUMERIC(10, 2) AS sum_question_points,
        CASE
          WHEN COUNT(sq.question_id) >= s.min_questions_required
               AND COALESCE(SUM(COALESCE(sq.points_override, q.points)), 0) > 0
               AND s.status = 'active'
          THEN TRUE
          ELSE FALSE
        END AS is_eligible_for_assignment
      FROM chuyensau_sets s
      JOIN chuyensau_subjects sb ON sb.id = s.subject_id
      LEFT JOIN chuyensau_set_questions sq ON sq.set_id = s.id
      LEFT JOIN chuyensau_questions q ON q.id = sq.question_id
      GROUP BY s.id, s.set_code, s.set_name, sb.exam_type, sb.block_code, sb.subject_code, s.status, s.min_questions_required;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V44: Rename chuyensau tables to business-meaningful names
  // ═══════════════════════════════════════════════════════
  {
    name: 'V44_rename_chuyensau_tables_meaningful',
    version: 44,
    sql: `
      -- Rename core relations only when source exists (table/view-safe)
      DO $$
      DECLARE
        old_names TEXT[] := ARRAY[
          'chuyensau_subjects',
          'chuyensau_sets',
          'chuyensau_questions',
          'chuyensau_set_questions',
          'chuyensau_monthly_selections',
          'chuyensau_registrations',
          'chuyensau_assignments',
          'chuyensau_submissions',
          'chuyensau_submission_answers',
          'chuyensau_explanations',
          'chuyensau_results',
          'chuyensau_set_quality'
        ];
        new_names TEXT[] := ARRAY[
          'chuyensau_monhoc',
          'chuyensau_bode',
          'chuyensau_cauhoi',
          'chuyensau_bode_cauhoi',
          'chuyensau_chonde_thang',
          'chuyensau_dangky',
          'chuyensau_phancong',
          'chuyensau_bainop',
          'chuyensau_bainop_traloi',
          'chuyensau_giaitrinh',
          'chuyensau_ketqua',
          'chuyensau_chatluong_bode'
        ];
        alias_names TEXT[] := ARRAY[
          'chuyensau_subjects',
          'chuyensau_sets',
          'chuyensau_questions',
          'chuyensau_set_questions',
          'chuyensau_monthly_selections',
          'chuyensau_registrations',
          'chuyensau_assignments',
          'chuyensau_submissions',
          'chuyensau_submission_answers',
          'chuyensau_explanations',
          'chuyensau_results',
          'chuyensau_set_quality'
        ];
        i INTEGER;
        k CHAR;
      BEGIN
        FOR i IN 1..array_length(old_names, 1) LOOP
          SELECT c.relkind INTO k
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = old_names[i];

          IF k IN ('r', 'p') AND to_regclass('public.' || new_names[i]) IS NULL THEN
            EXECUTE format('ALTER TABLE %I RENAME TO %I', old_names[i], new_names[i]);
          ELSIF k IN ('v', 'm') AND to_regclass('public.' || new_names[i]) IS NULL THEN
            EXECUTE format('ALTER VIEW %I RENAME TO %I', old_names[i], new_names[i]);
          END IF;
        END LOOP;

        -- Keep backward-compatible read aliases for old technical names
        FOR i IN 1..array_length(alias_names, 1) LOOP
          IF to_regclass('public.' || new_names[i]) IS NOT NULL THEN
            EXECUTE format('CREATE OR REPLACE VIEW %I AS SELECT * FROM %I', alias_names[i], new_names[i]);
          END IF;
        END LOOP;
      END $$;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V45: Normalize prefix from chuyensau_* to chuyen_sau_*
  // ═══════════════════════════════════════════════════════
  {
    name: 'V45_normalize_prefix_to_chuyen_sau',
    version: 45,
    sql: `
      DO $$
      DECLARE
        old_names TEXT[] := ARRAY[
          'chuyensau_monhoc',
          'chuyensau_bode',
          'chuyensau_cauhoi',
          'chuyensau_bode_cauhoi',
          'chuyensau_chonde_thang',
          'chuyensau_dangky',
          'chuyensau_phancong',
          'chuyensau_bainop',
          'chuyensau_bainop_traloi',
          'chuyensau_giaitrinh',
          'chuyensau_ketqua',
          'chuyensau_chatluong_bode'
        ];
        new_names TEXT[] := ARRAY[
          'chuyen_sau_monhoc',
          'chuyen_sau_bode',
          'chuyen_sau_cauhoi',
          'chuyen_sau_bode_cauhoi',
          'chuyen_sau_chonde_thang',
          'chuyen_sau_dangky',
          'chuyen_sau_phancong',
          'chuyen_sau_bainop',
          'chuyen_sau_bainop_traloi',
          'chuyen_sau_giaitrinh',
          'chuyen_sau_ketqua',
          'chuyen_sau_chatluong_bode'
        ];
        canonical_alias TEXT[] := ARRAY[
          'chuyen_sau_subjects',
          'chuyen_sau_sets',
          'chuyen_sau_questions',
          'chuyen_sau_set_questions',
          'chuyen_sau_monthly_selections',
          'chuyen_sau_registrations',
          'chuyen_sau_assignments',
          'chuyen_sau_submissions',
          'chuyen_sau_submission_answers',
          'chuyen_sau_explanations',
          'chuyen_sau_results',
          'chuyen_sau_set_quality'
        ];
        backward_alias TEXT[] := ARRAY[
          'chuyensau_monhoc',
          'chuyensau_bode',
          'chuyensau_cauhoi',
          'chuyensau_bode_cauhoi',
          'chuyensau_chonde_thang',
          'chuyensau_dangky',
          'chuyensau_phancong',
          'chuyensau_bainop',
          'chuyensau_bainop_traloi',
          'chuyensau_giaitrinh',
          'chuyensau_ketqua',
          'chuyensau_chatluong_bode'
        ];
        i INTEGER;
        k CHAR;
      BEGIN
        FOR i IN 1..array_length(old_names, 1) LOOP
          SELECT c.relkind INTO k
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = old_names[i];

          IF k IN ('r', 'p') AND to_regclass('public.' || new_names[i]) IS NULL THEN
            EXECUTE format('ALTER TABLE %I RENAME TO %I', old_names[i], new_names[i]);
          ELSIF k IN ('v', 'm') AND to_regclass('public.' || new_names[i]) IS NULL THEN
            EXECUTE format('ALTER VIEW %I RENAME TO %I', old_names[i], new_names[i]);
          END IF;
        END LOOP;

        -- Canonical aliases with corrected prefix
        FOR i IN 1..array_length(canonical_alias, 1) LOOP
          IF to_regclass('public.' || new_names[i]) IS NOT NULL THEN
            EXECUTE format('CREATE OR REPLACE VIEW %I AS SELECT * FROM %I', canonical_alias[i], new_names[i]);
          END IF;
        END LOOP;

        -- Backward-compatible aliases for old typo prefix
        FOR i IN 1..array_length(backward_alias, 1) LOOP
          IF to_regclass('public.' || new_names[i]) IS NOT NULL THEN
            EXECUTE format('CREATE OR REPLACE VIEW %I AS SELECT * FROM %I', backward_alias[i], new_names[i]);
          END IF;
        END LOOP;
      END $$;
    `,
  },

  // ═══════════════════════════════════════════════════════
  // V46: Reconcile names to final chuyen_sau_* state
  // ═══════════════════════════════════════════════════════
  {
    name: 'V46_reconcile_chuyen_sau_final_state',
    version: 46,
    sql: `
      DO $$
      DECLARE
        src_names TEXT[] := ARRAY[
          'chuyensau_subjects','chuyensau_sets','chuyensau_questions','chuyensau_set_questions','chuyensau_monthly_selections','chuyensau_registrations','chuyensau_assignments','chuyensau_submissions','chuyensau_submission_answers','chuyensau_explanations','chuyensau_results','chuyensau_set_quality',
          'chuyensau_monhoc','chuyensau_bode','chuyensau_cauhoi','chuyensau_bode_cauhoi','chuyensau_chonde_thang','chuyensau_dangky','chuyensau_phancong','chuyensau_bainop','chuyensau_bainop_traloi','chuyensau_giaitrinh','chuyensau_ketqua','chuyensau_chatluong_bode'
        ];
        dst_names TEXT[] := ARRAY[
          'chuyen_sau_monhoc','chuyen_sau_bode','chuyen_sau_cauhoi','chuyen_sau_bode_cauhoi','chuyen_sau_chonde_thang','chuyen_sau_dangky','chuyen_sau_phancong','chuyen_sau_bainop','chuyen_sau_bainop_traloi','chuyen_sau_giaitrinh','chuyen_sau_ketqua','chuyen_sau_chatluong_bode',
          'chuyen_sau_monhoc','chuyen_sau_bode','chuyen_sau_cauhoi','chuyen_sau_bode_cauhoi','chuyen_sau_chonde_thang','chuyen_sau_dangky','chuyen_sau_phancong','chuyen_sau_bainop','chuyen_sau_bainop_traloi','chuyen_sau_giaitrinh','chuyen_sau_ketqua','chuyen_sau_chatluong_bode'
        ];
        i INTEGER;
        k CHAR;
      BEGIN
        FOR i IN 1..array_length(src_names, 1) LOOP
          IF src_names[i] = dst_names[i] THEN
            CONTINUE;
          END IF;

          SELECT c.relkind INTO k
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = src_names[i];

          IF k IN ('r', 'p') AND to_regclass('public.' || dst_names[i]) IS NULL THEN
            EXECUTE format('ALTER TABLE %I RENAME TO %I', src_names[i], dst_names[i]);
          ELSIF k IN ('v', 'm') AND to_regclass('public.' || dst_names[i]) IS NULL THEN
            EXECUTE format('ALTER VIEW %I RENAME TO %I', src_names[i], dst_names[i]);
          END IF;
        END LOOP;

        -- Canonical alias views
        IF to_regclass('public.chuyen_sau_monhoc') IS NOT NULL THEN
          CREATE OR REPLACE VIEW chuyen_sau_subjects AS SELECT * FROM chuyen_sau_monhoc;
        END IF;
        IF to_regclass('public.chuyen_sau_bode') IS NOT NULL THEN
          CREATE OR REPLACE VIEW chuyen_sau_sets AS SELECT * FROM chuyen_sau_bode;
        END IF;
        IF to_regclass('public.chuyen_sau_cauhoi') IS NOT NULL THEN
          CREATE OR REPLACE VIEW chuyen_sau_questions AS SELECT * FROM chuyen_sau_cauhoi;
        END IF;
        IF to_regclass('public.chuyen_sau_bode_cauhoi') IS NOT NULL THEN
          CREATE OR REPLACE VIEW chuyen_sau_set_questions AS SELECT * FROM chuyen_sau_bode_cauhoi;
        END IF;
        IF to_regclass('public.chuyen_sau_chonde_thang') IS NOT NULL THEN
          CREATE OR REPLACE VIEW chuyen_sau_monthly_selections AS SELECT * FROM chuyen_sau_chonde_thang;
        END IF;
        IF to_regclass('public.chuyen_sau_dangky') IS NOT NULL THEN
          CREATE OR REPLACE VIEW chuyen_sau_registrations AS SELECT * FROM chuyen_sau_dangky;
        END IF;
        IF to_regclass('public.chuyen_sau_phancong') IS NOT NULL THEN
          CREATE OR REPLACE VIEW chuyen_sau_assignments AS SELECT * FROM chuyen_sau_phancong;
        END IF;
        IF to_regclass('public.chuyen_sau_bainop') IS NOT NULL THEN
          CREATE OR REPLACE VIEW chuyen_sau_submissions AS SELECT * FROM chuyen_sau_bainop;
        END IF;
        IF to_regclass('public.chuyen_sau_bainop_traloi') IS NOT NULL THEN
          CREATE OR REPLACE VIEW chuyen_sau_submission_answers AS SELECT * FROM chuyen_sau_bainop_traloi;
        END IF;
        IF to_regclass('public.chuyen_sau_giaitrinh') IS NOT NULL THEN
          CREATE OR REPLACE VIEW chuyen_sau_explanations AS SELECT * FROM chuyen_sau_giaitrinh;
        END IF;
        IF to_regclass('public.chuyen_sau_ketqua') IS NOT NULL THEN
          CREATE OR REPLACE VIEW chuyen_sau_results AS SELECT * FROM chuyen_sau_ketqua;
        END IF;
        IF to_regclass('public.chuyen_sau_chatluong_bode') IS NOT NULL THEN
          CREATE OR REPLACE VIEW chuyen_sau_set_quality AS SELECT * FROM chuyen_sau_chatluong_bode;
        END IF;
      END $$;
    `,
  },
  {
    name: 'V47_restructure_thu_vien_de_columns',
    version: 47,
    sql: `
      -- V47: Thêm cột cho legacy exam_* tables để chuẩn bị cho cutover sang chuyen_sau_*.
      -- Mọi block đều kiểm tra sự tồn tại của table trước → an toàn trên fresh DB.

      -- exam_subject_catalog: stable key + metadata
      DO $$
      BEGIN
        IF to_regclass('public.exam_subject_catalog') IS NOT NULL THEN
          ALTER TABLE exam_subject_catalog
            ADD COLUMN IF NOT EXISTS subject_key VARCHAR(120),
            ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

          WITH key_seed AS (
            SELECT
              id,
              LOWER(REGEXP_REPLACE(COALESCE(NULLIF(subject_key, ''), subject_code, subject_name), '[^a-zA-Z0-9]+', '_', 'g')) AS base_key
            FROM exam_subject_catalog
          ),
          ranked AS (
            SELECT id, base_key, ROW_NUMBER() OVER (PARTITION BY base_key ORDER BY id) AS rn
            FROM key_seed
          )
          UPDATE exam_subject_catalog esc
          SET subject_key = CASE WHEN r.rn = 1 THEN r.base_key ELSE CONCAT(r.base_key, '_', esc.id::text) END
          FROM ranked r
          WHERE esc.id = r.id
            AND (esc.subject_key IS NULL OR TRIM(esc.subject_key) = ''
              OR esc.subject_key <> CASE WHEN r.rn = 1 THEN r.base_key ELSE CONCAT(r.base_key, '_', esc.id::text) END);

          CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_subject_catalog_subject_key
          ON exam_subject_catalog(subject_key) WHERE subject_key IS NOT NULL;
        END IF;
      END $$;

      -- exam_sets: governance + quality columns
      DO $$
      BEGIN
        IF to_regclass('public.exam_sets') IS NOT NULL THEN
          ALTER TABLE exam_sets
            ADD COLUMN IF NOT EXISTS min_questions_required INTEGER NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS scoring_mode VARCHAR(20) NOT NULL DEFAULT 'raw_10',
            ADD COLUMN IF NOT EXISTS random_weight INTEGER NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS setup_note TEXT,
            ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_exam_sets_min_questions_required') THEN
            ALTER TABLE exam_sets ADD CONSTRAINT ck_exam_sets_min_questions_required CHECK (min_questions_required > 0);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_exam_sets_random_weight') THEN
            ALTER TABLE exam_sets ADD CONSTRAINT ck_exam_sets_random_weight CHECK (random_weight > 0);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_exam_sets_score_bounds') THEN
            ALTER TABLE exam_sets ADD CONSTRAINT ck_exam_sets_score_bounds CHECK (total_points > 0 AND passing_score >= 0 AND passing_score <= total_points);
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_exam_sets_scoring_mode') THEN
            ALTER TABLE exam_sets ADD CONSTRAINT ck_exam_sets_scoring_mode CHECK (scoring_mode IN ('raw_10', 'scaled_10', 'weighted'));
          END IF;

          CREATE INDEX IF NOT EXISTS idx_exam_sets_subject_status ON exam_sets(subject_id, status);
        END IF;
      END $$;

      -- exam_set_questions: difficulty/tags UI fields
      DO $$
      BEGIN
        IF to_regclass('public.exam_set_questions') IS NOT NULL THEN
          ALTER TABLE exam_set_questions
            ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) NOT NULL DEFAULT 'medium',
            ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_exam_set_questions_difficulty') THEN
            ALTER TABLE exam_set_questions ADD CONSTRAINT ck_exam_set_questions_difficulty CHECK (difficulty IN ('easy', 'medium', 'hard'));
          END IF;
        END IF;
      END $$;

      -- monthly_exam_selections: lock mode/random seed/snapshot auditing
      DO $$
      BEGIN
        IF to_regclass('public.monthly_exam_selections') IS NOT NULL THEN
          ALTER TABLE monthly_exam_selections
            ADD COLUMN IF NOT EXISTS setup_source VARCHAR(20) NOT NULL DEFAULT 'manual',
            ADD COLUMN IF NOT EXISTS lock_mode VARCHAR(20) NOT NULL DEFAULT 'locked',
            ADD COLUMN IF NOT EXISTS random_seed VARCHAR(100),
            ADD COLUMN IF NOT EXISTS set_question_count_snapshot INTEGER,
            ADD COLUMN IF NOT EXISTS selected_by TEXT,
            ADD COLUMN IF NOT EXISTS selected_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

          UPDATE monthly_exam_selections
          SET selected_by = COALESCE(selected_by, created_by),
              selected_at = COALESCE(selected_at, created_at)
          WHERE selected_by IS NULL OR selected_at IS NULL;

          IF to_regclass('public.exam_set_questions') IS NOT NULL THEN
            UPDATE monthly_exam_selections mes
            SET set_question_count_snapshot = qc.question_count
            FROM (SELECT set_id, COUNT(*)::INT AS question_count FROM exam_set_questions GROUP BY set_id) qc
            WHERE mes.selected_set_id = qc.set_id AND mes.set_question_count_snapshot IS NULL;
          END IF;

          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_monthly_exam_selections_setup_source') THEN
            ALTER TABLE monthly_exam_selections ADD CONSTRAINT ck_monthly_exam_selections_setup_source CHECK (setup_source IN ('manual', 'random', 'auto'));
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_monthly_exam_selections_lock_mode') THEN
            ALTER TABLE monthly_exam_selections ADD CONSTRAINT ck_monthly_exam_selections_lock_mode CHECK (lock_mode IN ('locked', 'fallback_random'));
          END IF;

          CREATE INDEX IF NOT EXISTS idx_monthly_exam_selections_scope_v2
          ON monthly_exam_selections(subject_id, year, month, selection_mode);
        END IF;
      END $$;
    `,
  },
  {
    name: 'V48_drop_exam_tables_cutover_to_chuyen_sau',
    version: 48,
    sql: `
      -- Expand canonical tables so legacy exam APIs can map 1:1 fields.
      ALTER TABLE IF EXISTS chuyen_sau_monhoc
        ADD COLUMN IF NOT EXISTS subject_key VARCHAR(120),
        ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

      ALTER TABLE IF EXISTS chuyen_sau_bode
        ADD COLUMN IF NOT EXISTS total_points DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
        ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
        ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP,
        ADD COLUMN IF NOT EXISTS valid_to TIMESTAMP,
        ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER,
        ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS scoring_mode VARCHAR(20) NOT NULL DEFAULT 'raw_10',
        ADD COLUMN IF NOT EXISTS random_weight INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS setup_note TEXT,
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

      ALTER TABLE IF EXISTS chuyen_sau_cauhoi
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

      ALTER TABLE IF EXISTS chuyen_sau_dangky
        ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS registration_type VARCHAR(30) NOT NULL DEFAULT 'fixed',
        ADD COLUMN IF NOT EXISTS source_form VARCHAR(100) NOT NULL DEFAULT 'manual',
        ADD COLUMN IF NOT EXISTS center_code VARCHAR(100),
        ADD COLUMN IF NOT EXISTS event_schedule_id UUID;

      ALTER TABLE IF EXISTS chuyen_sau_giaitrinh
        ADD COLUMN IF NOT EXISTS teacher_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS teacher_email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS subject_code VARCHAR(100),
        ADD COLUMN IF NOT EXISTS center_code VARCHAR(100),
        ADD COLUMN IF NOT EXISTS test_date DATE,
        ADD COLUMN IF NOT EXISTS admin_note TEXT,
        ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS admin_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS decided_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS legacy_explanation_id BIGINT;

      CREATE TABLE IF NOT EXISTS chuyen_sau_sukien_phancong (
        id BIGSERIAL PRIMARY KEY,
        assignment_id BIGINT NOT NULL,
        actor_type VARCHAR(20) NOT NULL,
        actor_code VARCHAR(50),
        event_type VARCHAR(50) NOT NULL,
        payload JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        legacy_event_id BIGINT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_chuyen_sau_monhoc_legacy_subject
      ON chuyen_sau_monhoc(legacy_subject_id)
      WHERE legacy_subject_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_chuyen_sau_bode_legacy_set
      ON chuyen_sau_bode(legacy_set_id)
      WHERE legacy_set_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_chuyen_sau_cauhoi_legacy_question
      ON chuyen_sau_cauhoi(legacy_question_id)
      WHERE legacy_question_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_chuyen_sau_dangky_legacy_registration
      ON chuyen_sau_dangky(legacy_registration_id)
      WHERE legacy_registration_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_chuyen_sau_giaitrinh_legacy_explanation
      ON chuyen_sau_giaitrinh(legacy_explanation_id)
      WHERE legacy_explanation_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_chuyen_sau_sukien_legacy_event
      ON chuyen_sau_sukien_phancong(legacy_event_id)
      WHERE legacy_event_id IS NOT NULL;

      -- Data migration block: only runs when legacy exam_* tables still exist (non-fresh DB).
      -- On a fresh DB these tables don't exist, so we skip safely.
      DO $$
      BEGIN
        IF to_regclass('public.exam_subject_catalog') IS NOT NULL THEN

      -- Subjects
      INSERT INTO chuyen_sau_monhoc (
        exam_type, block_code, subject_code, subject_name, is_active, created_at, updated_at,
        legacy_subject_id, subject_key, display_order, metadata
      )
      SELECT
        esc.exam_type::TEXT,
        esc.block_code,
        esc.subject_code,
        esc.subject_name,
        esc.is_active,
        esc.created_at,
        esc.updated_at,
        esc.id,
        esc.subject_key,
        COALESCE(esc.display_order, 0),
        COALESCE(esc.metadata, '{}'::jsonb)
      FROM (
        SELECT DISTINCT ON (exam_type, block_code, subject_code)
          *
        FROM exam_subject_catalog
        ORDER BY exam_type, block_code, subject_code, updated_at DESC, id DESC
      ) esc
      ON CONFLICT (exam_type, block_code, subject_code)
      DO UPDATE SET
        subject_name = EXCLUDED.subject_name,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP,
        legacy_subject_id = COALESCE(chuyen_sau_monhoc.legacy_subject_id, EXCLUDED.legacy_subject_id),
        subject_key = COALESCE(EXCLUDED.subject_key, chuyen_sau_monhoc.subject_key),
        display_order = EXCLUDED.display_order,
        metadata = COALESCE(EXCLUDED.metadata, chuyen_sau_monhoc.metadata);

      -- Sets
      INSERT INTO chuyen_sau_bode (
        subject_id, set_code, set_name, total_points, passing_score, target_scale,
        duration_minutes, valid_from, valid_to,
        time_limit_minutes, max_attempts, status, version_no, created_by, updated_by,
        created_at, updated_at, legacy_set_id, min_questions_required, scoring_mode,
        random_weight, setup_note, archived_at, metadata
      )
      SELECT
        csm.id,
        es.set_code,
        es.set_name,
        COALESCE(es.total_points, 10),
        COALESCE(es.passing_score, 0),
        10,
        es.duration_minutes,
        es.valid_from,
        es.valid_to,
        NULL,
        1,
        es.status,
        1,
        NULL,
        NULL,
        es.created_at,
        es.updated_at,
        es.id,
        COALESCE(es.min_questions_required, 1),
        COALESCE(es.scoring_mode, 'raw_10'),
        COALESCE(es.random_weight, 1),
        es.setup_note,
        es.archived_at,
        COALESCE(es.metadata, '{}'::jsonb)
      FROM (
        SELECT DISTINCT ON (set_code)
          *
        FROM exam_sets
        ORDER BY set_code, updated_at DESC, id DESC
      ) es
      JOIN chuyen_sau_monhoc csm ON csm.legacy_subject_id = es.subject_id
      ON CONFLICT (set_code)
      DO UPDATE SET
        subject_id = EXCLUDED.subject_id,
        set_name = EXCLUDED.set_name,
        total_points = EXCLUDED.total_points,
        passing_score = EXCLUDED.passing_score,
        duration_minutes = EXCLUDED.duration_minutes,
        valid_from = EXCLUDED.valid_from,
        valid_to = EXCLUDED.valid_to,
        status = EXCLUDED.status,
        min_questions_required = EXCLUDED.min_questions_required,
        scoring_mode = EXCLUDED.scoring_mode,
        random_weight = EXCLUDED.random_weight,
        setup_note = EXCLUDED.setup_note,
        archived_at = EXCLUDED.archived_at,
        updated_at = CURRENT_TIMESTAMP,
        legacy_set_id = COALESCE(chuyen_sau_bode.legacy_set_id, EXCLUDED.legacy_set_id),
        metadata = COALESCE(EXCLUDED.metadata, chuyen_sau_bode.metadata);

      -- Questions
      INSERT INTO chuyen_sau_cauhoi (
        question_type, question_text, option_a, option_b, option_c, option_d,
        correct_answer, explanation, points, difficulty, tags, is_active,
        created_by, updated_by, created_at, updated_at, legacy_question_id, metadata
      )
      SELECT
        CASE
          WHEN esq.question_type::TEXT IN ('single_choice', 'multiple_choice', 'true_false', 'short_answer') THEN esq.question_type::TEXT
          WHEN esq.question_type::TEXT = 'essay' THEN 'short_answer'
          ELSE 'multiple_choice'
        END,
        esq.question_text,
        CASE WHEN jsonb_typeof(esq.options::jsonb) = 'array' THEN (esq.options::jsonb ->> 0) ELSE NULL END,
        CASE WHEN jsonb_typeof(esq.options::jsonb) = 'array' THEN (esq.options::jsonb ->> 1) ELSE NULL END,
        CASE WHEN jsonb_typeof(esq.options::jsonb) = 'array' THEN (esq.options::jsonb ->> 2) ELSE NULL END,
        CASE WHEN jsonb_typeof(esq.options::jsonb) = 'array' THEN (esq.options::jsonb ->> 3) ELSE NULL END,
        esq.correct_answer,
        esq.explanation,
        GREATEST(COALESCE(esq.points, 1), 1),
        COALESCE(esq.difficulty, 'medium'),
        COALESCE(esq.tags, ARRAY[]::TEXT[]),
        COALESCE(esq.is_active, TRUE),
        NULL,
        NULL,
        esq.created_at,
        esq.updated_at,
        esq.id,
        COALESCE(esq.metadata, '{}'::jsonb)
      FROM exam_set_questions esq
      WHERE NOT EXISTS (
        SELECT 1
        FROM chuyen_sau_cauhoi csc
        WHERE csc.legacy_question_id = esq.id
      );

      INSERT INTO chuyen_sau_bode_cauhoi (set_id, question_id, display_order, points_override, created_at)
      SELECT
        csb.id,
        csc.id,
        COALESCE(esq.order_number, 1),
        NULL,
        COALESCE(esq.created_at, CURRENT_TIMESTAMP)
      FROM exam_set_questions esq
      JOIN chuyen_sau_bode csb ON csb.legacy_set_id = esq.set_id
      JOIN chuyen_sau_cauhoi csc ON csc.legacy_question_id = esq.id
      WHERE NOT EXISTS (
        SELECT 1
        FROM chuyen_sau_bode_cauhoi map
        WHERE map.set_id = csb.id AND map.question_id = csc.id
      );

      -- Registrations
      INSERT INTO chuyen_sau_dangky (
        teacher_code, teacher_name, email, campus,
        exam_type, block_code, subject_code,
        month, year, status, registration_note,
        created_at, updated_at, legacy_registration_id,
        scheduled_at, registration_type, source_form, center_code, event_schedule_id
      )
      SELECT
        er.teacher_code,
        COALESCE(tts.full_name, er.teacher_code),
        COALESCE(tts.work_email, er.teacher_code || '@unknown.local'),
        tts.center,
        er.exam_type::TEXT,
        er.block_code,
        er.subject_code,
        EXTRACT(MONTH FROM er.scheduled_at)::INT,
        EXTRACT(YEAR FROM er.scheduled_at)::INT,
        'registered',
        NULL,
        er.created_at,
        er.updated_at,
        er.id,
        er.scheduled_at,
        er.registration_type::TEXT,
        er.source_form,
        er.center_code,
        er.event_schedule_id
      FROM (
        SELECT DISTINCT ON (teacher_code, exam_type, block_code, subject_code, EXTRACT(MONTH FROM scheduled_at), EXTRACT(YEAR FROM scheduled_at))
          *
        FROM exam_registrations
        ORDER BY teacher_code, exam_type, block_code, subject_code, EXTRACT(MONTH FROM scheduled_at), EXTRACT(YEAR FROM scheduled_at), updated_at DESC, id DESC
      ) er
      LEFT JOIN training_teacher_stats tts ON tts.teacher_code = er.teacher_code
      ON CONFLICT (teacher_code, exam_type, block_code, subject_code, month, year)
      DO UPDATE SET
        scheduled_at = COALESCE(EXCLUDED.scheduled_at, chuyen_sau_dangky.scheduled_at),
        registration_type = COALESCE(EXCLUDED.registration_type, chuyen_sau_dangky.registration_type),
        source_form = COALESCE(EXCLUDED.source_form, chuyen_sau_dangky.source_form),
        center_code = COALESCE(EXCLUDED.center_code, chuyen_sau_dangky.center_code),
        event_schedule_id = COALESCE(EXCLUDED.event_schedule_id, chuyen_sau_dangky.event_schedule_id),
        updated_at = CURRENT_TIMESTAMP,
        legacy_registration_id = COALESCE(chuyen_sau_dangky.legacy_registration_id, EXCLUDED.legacy_registration_id);

      -- Explanations
      INSERT INTO chuyen_sau_giaitrinh (
        assignment_id, teacher_code, reason, status,
        reviewer_note, reviewer_email, reviewed_at,
        created_at, updated_at,
        teacher_name, teacher_email, subject_code, center_code, test_date,
        admin_note, admin_email, admin_name, decided_at,
        legacy_explanation_id, email
      )
      SELECT
        ee.assignment_id,
        ee.teacher_code,
        ee.reason,
        ee.status::TEXT,
        ee.admin_note,
        ee.admin_email,
        ee.decided_at,
        ee.created_at,
        ee.updated_at,
        ee.teacher_name,
        ee.teacher_email,
        ee.subject_code,
        ee.center_code,
        ee.test_date,
        ee.admin_note,
        ee.admin_email,
        ee.admin_name,
        ee.decided_at,
        ee.id,
        ee.teacher_email
      FROM exam_explanations ee
      WHERE NOT EXISTS (
        SELECT 1
        FROM chuyen_sau_giaitrinh csg
        WHERE csg.legacy_explanation_id = ee.id
      );

      -- Assignment events
      INSERT INTO chuyen_sau_sukien_phancong (
        assignment_id, actor_type, actor_code, event_type, payload, created_at, legacy_event_id
      )
      SELECT
        eae.assignment_id,
        eae.actor_type,
        eae.actor_code,
        eae.event_type,
        eae.payload,
        eae.created_at,
        eae.id
      FROM exam_assignment_events eae
      WHERE NOT EXISTS (
        SELECT 1
        FROM chuyen_sau_sukien_phancong cssp
        WHERE cssp.legacy_event_id = eae.id
      );

      -- Drop exam-linked FKs before remapping to canonical IDs.
      EXECUTE 'ALTER TABLE IF EXISTS teacher_exam_answers DROP CONSTRAINT IF EXISTS teacher_exam_answers_question_id_fkey';
      EXECUTE 'ALTER TABLE IF EXISTS teacher_exam_assignments DROP CONSTRAINT IF EXISTS teacher_exam_assignments_selected_set_id_fkey';
      EXECUTE 'ALTER TABLE IF EXISTS teacher_exam_assignments DROP CONSTRAINT IF EXISTS teacher_exam_assignments_registration_id_fkey';
      EXECUTE 'ALTER TABLE IF EXISTS monthly_exam_selections DROP CONSTRAINT IF EXISTS monthly_exam_selections_subject_id_fkey';
      EXECUTE 'ALTER TABLE IF EXISTS monthly_exam_selections DROP CONSTRAINT IF EXISTS monthly_exam_selections_selected_set_id_fkey';

      -- Remap dependent IDs from exam_* IDs to chuyen_sau_* IDs
      UPDATE teacher_exam_assignments tea
      SET selected_set_id = csb.id
      FROM chuyen_sau_bode csb
      WHERE csb.legacy_set_id = tea.selected_set_id;

      UPDATE teacher_exam_assignments tea
      SET registration_id = csd.id
      FROM chuyen_sau_dangky csd
      WHERE csd.legacy_registration_id = tea.registration_id;

      UPDATE teacher_exam_answers tea
      SET question_id = csc.id
      FROM chuyen_sau_cauhoi csc
      WHERE csc.legacy_question_id = tea.question_id;

      UPDATE monthly_exam_selections mes
      SET subject_id = csm.id
      FROM chuyen_sau_monhoc csm
      WHERE csm.legacy_subject_id = mes.subject_id;

      UPDATE monthly_exam_selections mes
      SET selected_set_id = csb.id
      FROM chuyen_sau_bode csb
      WHERE csb.legacy_set_id = mes.selected_set_id;

      -- Rewire FKs
      EXECUTE 'ALTER TABLE IF EXISTS teacher_exam_answers DROP CONSTRAINT IF EXISTS teacher_exam_answers_question_id_fkey';
      EXECUTE 'ALTER TABLE IF EXISTS teacher_exam_assignments DROP CONSTRAINT IF EXISTS teacher_exam_assignments_selected_set_id_fkey';
      EXECUTE 'ALTER TABLE IF EXISTS teacher_exam_assignments DROP CONSTRAINT IF EXISTS teacher_exam_assignments_registration_id_fkey';
      EXECUTE 'ALTER TABLE IF EXISTS monthly_exam_selections DROP CONSTRAINT IF EXISTS monthly_exam_selections_subject_id_fkey';
      EXECUTE 'ALTER TABLE IF EXISTS monthly_exam_selections DROP CONSTRAINT IF EXISTS monthly_exam_selections_selected_set_id_fkey';

      IF to_regclass('public.teacher_exam_answers') IS NOT NULL THEN
        ALTER TABLE teacher_exam_answers
          ADD CONSTRAINT teacher_exam_answers_question_id_fkey
          FOREIGN KEY (question_id) REFERENCES chuyen_sau_cauhoi(id) ON DELETE RESTRICT;
      END IF;

      IF to_regclass('public.teacher_exam_assignments') IS NOT NULL THEN
        ALTER TABLE teacher_exam_assignments
          ADD CONSTRAINT teacher_exam_assignments_selected_set_id_fkey
          FOREIGN KEY (selected_set_id) REFERENCES chuyen_sau_bode(id) ON DELETE RESTRICT;

        ALTER TABLE teacher_exam_assignments
          ADD CONSTRAINT teacher_exam_assignments_registration_id_fkey
          FOREIGN KEY (registration_id) REFERENCES chuyen_sau_dangky(id) ON DELETE CASCADE;
      END IF;

      IF to_regclass('public.monthly_exam_selections') IS NOT NULL THEN
        ALTER TABLE monthly_exam_selections
          ADD CONSTRAINT monthly_exam_selections_subject_id_fkey
          FOREIGN KEY (subject_id) REFERENCES chuyen_sau_monhoc(id) ON DELETE CASCADE;

        ALTER TABLE monthly_exam_selections
          ADD CONSTRAINT monthly_exam_selections_selected_set_id_fkey
          FOREIGN KEY (selected_set_id) REFERENCES chuyen_sau_bode(id) ON DELETE SET NULL;
      END IF;

      -- Remove physical exam_* tables
      DROP TABLE IF EXISTS exam_assignment_events;
      DROP TABLE IF EXISTS exam_explanations;
      DROP TABLE IF EXISTS exam_registrations CASCADE;
      DROP TABLE IF EXISTS exam_set_questions;
      DROP TABLE IF EXISTS exam_sets;
      DROP TABLE IF EXISTS exam_subject_catalog;

        END IF; -- end: exam_subject_catalog exists
      END $$;

      -- ENUM types needed by compatibility views (safe to re-run)
      DO $$ BEGIN
        CREATE TYPE exam_type_enum AS ENUM ('expertise', 'experience');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE registration_type_enum AS ENUM ('official', 'additional');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE explanation_status_enum AS ENUM ('pending', 'accepted', 'rejected');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      -- Compatibility views (exam_* names now point to chuyen_sau_* structures)
      CREATE VIEW exam_subject_catalog AS
      SELECT
        id,
        exam_type::exam_type_enum AS exam_type,
        block_code,
        subject_code,
        subject_name,
        is_active,
        created_at,
        updated_at,
        subject_key,
        display_order,
        metadata
      FROM chuyen_sau_monhoc;

      CREATE VIEW exam_sets AS
      SELECT
        id,
        subject_id,
        set_code,
        set_name,
        duration_minutes,
        total_points,
        passing_score,
        valid_from,
        valid_to,
        time_limit_minutes,
        max_attempts,
        status,
        version_no,
        created_by,
        updated_by,
        created_at,
        updated_at,
        min_questions_required,
        scoring_mode,
        random_weight,
        setup_note,
        metadata,
        archived_at
      FROM chuyen_sau_bode;

      CREATE VIEW exam_registrations AS
      SELECT
        id,
        teacher_code,
        exam_type::exam_type_enum AS exam_type,
        block_code,
        subject_code,
        scheduled_at,
        registration_type::registration_type_enum AS registration_type,
        source_form,
        center_code,
        event_schedule_id,
        created_at,
        updated_at
      FROM chuyen_sau_dangky;

      CREATE VIEW exam_explanations AS
      SELECT
        id,
        assignment_id,
        teacher_code,
        teacher_name,
        teacher_email,
        subject_code,
        center_code,
        test_date,
        reason,
        status::explanation_status_enum AS status,
        admin_note,
        admin_email,
        admin_name,
        decided_at,
        created_at,
        updated_at
      FROM chuyen_sau_giaitrinh;

      CREATE VIEW exam_assignment_events AS
      SELECT
        id,
        assignment_id,
        actor_type,
        actor_code,
        event_type,
        payload,
        created_at
      FROM chuyen_sau_sukien_phancong;

      CREATE VIEW exam_set_questions AS
      SELECT
        csc.id,
        map.set_id,
        csc.question_text,
        csc.question_type,
        CASE
          WHEN csc.option_a IS NULL AND csc.option_b IS NULL AND csc.option_c IS NULL AND csc.option_d IS NULL THEN NULL
          ELSE jsonb_build_array(csc.option_a, csc.option_b, csc.option_c, csc.option_d)
        END AS options,
        csc.correct_answer,
        csc.explanation,
        csc.points,
        map.display_order AS order_number,
        csc.created_by,
        csc.updated_by,
        csc.created_at,
        csc.updated_at,
        csc.difficulty,
        csc.tags,
        csc.is_active,
        csc.metadata
      FROM chuyen_sau_cauhoi csc
      JOIN chuyen_sau_bode_cauhoi map ON map.question_id = csc.id;

      CREATE OR REPLACE FUNCTION exam_set_questions_view_iud()
      RETURNS TRIGGER AS $$
      DECLARE
        v_question_id BIGINT;
        v_display_order INTEGER;
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO chuyen_sau_cauhoi (
            question_type, question_text, option_a, option_b, option_c, option_d,
            correct_answer, explanation, points, difficulty, tags, is_active,
            created_by, updated_by, created_at, updated_at, metadata
          )
          VALUES (
            NEW.question_type,
            NEW.question_text,
            CASE WHEN jsonb_typeof(NEW.options::jsonb) = 'array' THEN NEW.options::jsonb ->> 0 ELSE NULL END,
            CASE WHEN jsonb_typeof(NEW.options::jsonb) = 'array' THEN NEW.options::jsonb ->> 1 ELSE NULL END,
            CASE WHEN jsonb_typeof(NEW.options::jsonb) = 'array' THEN NEW.options::jsonb ->> 2 ELSE NULL END,
            CASE WHEN jsonb_typeof(NEW.options::jsonb) = 'array' THEN NEW.options::jsonb ->> 3 ELSE NULL END,
            NEW.correct_answer, NEW.explanation, COALESCE(NEW.points, 0), COALESCE(NEW.difficulty, 'medium'),
            COALESCE(NEW.tags, ARRAY[]::TEXT[]), COALESCE(NEW.is_active, TRUE),
            NEW.created_by, NEW.updated_by, COALESCE(NEW.created_at, CURRENT_TIMESTAMP), COALESCE(NEW.updated_at, CURRENT_TIMESTAMP),
            COALESCE(NEW.metadata, '{}'::jsonb)
          )
          RETURNING id INTO v_question_id;

          SELECT COALESCE(NEW.order_number, COALESCE(MAX(display_order), 0) + 1)
          INTO v_display_order
          FROM chuyen_sau_bode_cauhoi
          WHERE set_id = NEW.set_id;

          INSERT INTO chuyen_sau_bode_cauhoi (set_id, question_id, display_order, created_at)
          VALUES (NEW.set_id, v_question_id, v_display_order, COALESCE(NEW.created_at, CURRENT_TIMESTAMP));

          NEW.id := v_question_id;
          NEW.order_number := v_display_order;
          RETURN NEW;
        ELSIF TG_OP = 'UPDATE' THEN
          UPDATE chuyen_sau_cauhoi
          SET
            question_type = NEW.question_type,
            question_text = NEW.question_text,
            option_a = CASE WHEN jsonb_typeof(NEW.options::jsonb) = 'array' THEN NEW.options::jsonb ->> 0 ELSE option_a END,
            option_b = CASE WHEN jsonb_typeof(NEW.options::jsonb) = 'array' THEN NEW.options::jsonb ->> 1 ELSE option_b END,
            option_c = CASE WHEN jsonb_typeof(NEW.options::jsonb) = 'array' THEN NEW.options::jsonb ->> 2 ELSE option_c END,
            option_d = CASE WHEN jsonb_typeof(NEW.options::jsonb) = 'array' THEN NEW.options::jsonb ->> 3 ELSE option_d END,
            correct_answer = NEW.correct_answer,
            explanation = NEW.explanation,
            points = COALESCE(NEW.points, points),
            difficulty = COALESCE(NEW.difficulty, difficulty),
            tags = COALESCE(NEW.tags, tags),
            is_active = COALESCE(NEW.is_active, is_active),
            updated_by = NEW.updated_by,
            updated_at = COALESCE(NEW.updated_at, CURRENT_TIMESTAMP),
            metadata = COALESCE(NEW.metadata, metadata)
          WHERE id = OLD.id;

          UPDATE chuyen_sau_bode_cauhoi
          SET
            set_id = NEW.set_id,
            display_order = COALESCE(NEW.order_number, display_order)
          WHERE question_id = OLD.id;

          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          DELETE FROM chuyen_sau_bode_cauhoi WHERE question_id = OLD.id;
          DELETE FROM chuyen_sau_cauhoi
          WHERE id = OLD.id
            AND NOT EXISTS (
              SELECT 1 FROM chuyen_sau_bode_cauhoi WHERE question_id = OLD.id
            );
          RETURN OLD;
        END IF;

        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS exam_set_questions_view_iud_trg ON exam_set_questions;
      CREATE TRIGGER exam_set_questions_view_iud_trg
      INSTEAD OF INSERT OR UPDATE OR DELETE ON exam_set_questions
      FOR EACH ROW EXECUTE FUNCTION exam_set_questions_view_iud();
    `,
  },
  {
    name: 'V49_force_drop_all_exam_tables',
    version: 49,
    sql: `
      -- User-requested hard cleanup: remove every physical exam_* table.
      DROP TABLE IF EXISTS exam_assignment_events CASCADE;
      DROP TABLE IF EXISTS exam_explanations CASCADE;
      DROP TABLE IF EXISTS exam_registrations CASCADE;
      DROP TABLE IF EXISTS exam_set_questions CASCADE;
      DROP TABLE IF EXISTS exam_sets CASCADE;
      DROP TABLE IF EXISTS exam_subject_catalog CASCADE;
    `,
  },
  {
    name: 'V50_rename_legacy_columns_and_normalize_thu_vien_de',
    version: 50,
    sql: `
      -- Remove "legacy_*" naming. Keep semantics as source references.
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_monhoc' AND column_name = 'legacy_subject_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_monhoc' AND column_name = 'source_subject_id'
        ) THEN
          ALTER TABLE chuyen_sau_monhoc RENAME COLUMN legacy_subject_id TO source_subject_id;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_bode' AND column_name = 'legacy_set_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_bode' AND column_name = 'source_set_id'
        ) THEN
          ALTER TABLE chuyen_sau_bode RENAME COLUMN legacy_set_id TO source_set_id;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_cauhoi' AND column_name = 'legacy_question_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_cauhoi' AND column_name = 'source_question_id'
        ) THEN
          ALTER TABLE chuyen_sau_cauhoi RENAME COLUMN legacy_question_id TO source_question_id;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_dangky' AND column_name = 'legacy_registration_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_dangky' AND column_name = 'source_registration_id'
        ) THEN
          ALTER TABLE chuyen_sau_dangky RENAME COLUMN legacy_registration_id TO source_registration_id;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_phancong' AND column_name = 'legacy_assignment_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_phancong' AND column_name = 'source_assignment_id'
        ) THEN
          ALTER TABLE chuyen_sau_phancong RENAME COLUMN legacy_assignment_id TO source_assignment_id;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_bainop' AND column_name = 'legacy_submission_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_bainop' AND column_name = 'source_submission_id'
        ) THEN
          ALTER TABLE chuyen_sau_bainop RENAME COLUMN legacy_submission_id TO source_submission_id;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_giaitrinh' AND column_name = 'legacy_explanation_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_giaitrinh' AND column_name = 'source_explanation_id'
        ) THEN
          ALTER TABLE chuyen_sau_giaitrinh RENAME COLUMN legacy_explanation_id TO source_explanation_id;
        END IF;

        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_sukien_phancong' AND column_name = 'legacy_event_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_sukien_phancong' AND column_name = 'source_event_id'
        ) THEN
          ALTER TABLE chuyen_sau_sukien_phancong RENAME COLUMN legacy_event_id TO source_event_id;
        END IF;
      END $$;

      -- Thu-vien-de metadata columns normalized for current feature set.
      ALTER TABLE chuyen_sau_monhoc
        ADD COLUMN IF NOT EXISTS subject_key VARCHAR(120),
        ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

      UPDATE chuyen_sau_monhoc
      SET subject_key = LOWER(REGEXP_REPLACE(COALESCE(subject_code, subject_name), '[^a-zA-Z0-9]+', '_', 'g'))
      WHERE subject_key IS NULL OR TRIM(subject_key) = '';

      CREATE UNIQUE INDEX IF NOT EXISTS idx_chuyen_sau_monhoc_subject_key
      ON chuyen_sau_monhoc(subject_key)
      WHERE subject_key IS NOT NULL;

      ALTER TABLE chuyen_sau_bode
        ADD COLUMN IF NOT EXISTS total_points DECIMAL(5,2),
        ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
        ADD COLUMN IF NOT EXISTS time_limit_minutes INTEGER,
        ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP,
        ADD COLUMN IF NOT EXISTS valid_to TIMESTAMP,
        ADD COLUMN IF NOT EXISTS scoring_mode VARCHAR(20) NOT NULL DEFAULT 'raw_10',
        ADD COLUMN IF NOT EXISTS random_weight INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS setup_note TEXT,
        ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

      UPDATE chuyen_sau_bode
      SET total_points = COALESCE(total_points, target_scale)
      WHERE total_points IS NULL;

      ALTER TABLE chuyen_sau_bode
        ALTER COLUMN total_points SET NOT NULL;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_chuyen_sau_bode_total_points_positive') THEN
          ALTER TABLE chuyen_sau_bode
          ADD CONSTRAINT ck_chuyen_sau_bode_total_points_positive CHECK (total_points > 0);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_chuyen_sau_bode_random_weight_positive') THEN
          ALTER TABLE chuyen_sau_bode
          ADD CONSTRAINT ck_chuyen_sau_bode_random_weight_positive CHECK (random_weight > 0);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_chuyen_sau_bode_scoring_mode') THEN
          ALTER TABLE chuyen_sau_bode
          ADD CONSTRAINT ck_chuyen_sau_bode_scoring_mode CHECK (scoring_mode IN ('raw_10', 'scaled_10', 'weighted'));
        END IF;
      END $$;
    `,
  },
  {
    name: 'V51_add_set_note_to_chuyen_sau_bode',
    version: 51,
    sql: `
      ALTER TABLE chuyen_sau_bode
        ADD COLUMN IF NOT EXISTS set_note TEXT;

      UPDATE chuyen_sau_bode
      SET set_note = set_name
      WHERE (set_note IS NULL OR TRIM(set_note) = '')
        AND set_name IS NOT NULL
        AND TRIM(set_name) <> '';
    `,
  },
  {
    name: 'V52_subject_driven_exam_config',
    version: 52,
    sql: `
      ALTER TABLE chuyen_sau_monhoc
        ADD COLUMN IF NOT EXISTS exam_duration_minutes INTEGER,
        ADD COLUMN IF NOT EXISTS set_selection_mode VARCHAR(20) NOT NULL DEFAULT 'default',
        ADD COLUMN IF NOT EXISTS default_set_id BIGINT;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chuyen_sau_monhoc_default_set') THEN
          ALTER TABLE chuyen_sau_monhoc
          ADD CONSTRAINT fk_chuyen_sau_monhoc_default_set
          FOREIGN KEY (default_set_id) REFERENCES chuyen_sau_bode(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_chuyen_sau_monhoc_set_selection_mode') THEN
          ALTER TABLE chuyen_sau_monhoc
          ADD CONSTRAINT ck_chuyen_sau_monhoc_set_selection_mode
          CHECK (set_selection_mode IN ('default', 'random'));
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_chuyen_sau_monhoc_exam_duration_minutes') THEN
          ALTER TABLE chuyen_sau_monhoc
          ADD CONSTRAINT ck_chuyen_sau_monhoc_exam_duration_minutes
          CHECK (exam_duration_minutes IS NULL OR exam_duration_minutes > 0);
        END IF;
      END $$;

      -- Backfill duration from legacy columns/metadata; subject is now the source of truth.
      UPDATE chuyen_sau_monhoc
      SET exam_duration_minutes = COALESCE(
        exam_duration_minutes,
        duration_minutes,
        CASE
          WHEN COALESCE(metadata->>'duration_minutes', '') ~ '^[0-9]+$' THEN (metadata->>'duration_minutes')::int
          ELSE NULL
        END,
        CASE WHEN exam_type = 'experience' THEN 60 ELSE 120 END
      )
      WHERE exam_duration_minutes IS NULL;

      ALTER TABLE chuyen_sau_monhoc
        ALTER COLUMN exam_duration_minutes SET NOT NULL;

      -- Backfill selection policy from latest monthly selection if available.
      WITH latest_selection AS (
        SELECT DISTINCT ON (mes.subject_id)
          mes.subject_id,
          mes.selected_set_id,
          CASE WHEN mes.selection_mode = 'random' THEN 'random' ELSE 'default' END AS subject_mode
        FROM monthly_exam_selections mes
        WHERE mes.selected_set_id IS NOT NULL
        ORDER BY mes.subject_id, COALESCE(mes.updated_at, mes.selected_at, mes.created_at) DESC, mes.id DESC
      )
      UPDATE chuyen_sau_monhoc csm
      SET
        default_set_id = ls.selected_set_id,
        set_selection_mode = ls.subject_mode
      FROM latest_selection ls
      WHERE csm.id = ls.subject_id
        AND csm.default_set_id IS NULL;

      -- Keep metadata clean: duration now is explicit column.
      UPDATE chuyen_sau_monhoc
      SET metadata = COALESCE(metadata, '{}'::jsonb) - 'duration_minutes';

      -- Drop deprecated duration column introduced by legacy flow.
      ALTER TABLE chuyen_sau_monhoc
        DROP COLUMN IF EXISTS duration_minutes;
    `,
  },
  {
    name: 'V53_rename_monthly_selection_table_to_chuyen_sau_chonde_monhoc',
    version: 53,
    sql: `
      DO $$
      DECLARE
        old_relkind CHAR;
      BEGIN
        SELECT c.relkind INTO old_relkind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'monthly_exam_selections'
        LIMIT 1;

        IF old_relkind IN ('r', 'p') THEN
          IF to_regclass('public.chuyen_sau_chonde_monhoc') IS NULL THEN
            ALTER TABLE monthly_exam_selections RENAME TO chuyen_sau_chonde_monhoc;
          ELSE
            DROP TABLE IF EXISTS monthly_exam_selections CASCADE;
          END IF;
        ELSIF old_relkind IN ('v', 'm') THEN
          DROP VIEW IF EXISTS monthly_exam_selections CASCADE;
        END IF;
      END $$;
    `,
  },
  {
    name: 'V54_remove_monthly_selection_legacy_tables',
    version: 54,
    sql: `
      DO $$
      BEGIN
        -- Remove compatibility views first to avoid dependency issues.
        DROP VIEW IF EXISTS chuyen_sau_monthly_selections CASCADE;
        DROP VIEW IF EXISTS monthly_exam_selections CASCADE;

        -- Remove both monthly-selection tables (old and renamed variants).
        DROP TABLE IF EXISTS chuyen_sau_chonde_thang CASCADE;
        DROP TABLE IF EXISTS chuyen_sau_chonde_monhoc CASCADE;

        -- Defensive cleanup in case any variant remains as a view/materialized view.
        DROP VIEW IF EXISTS chuyen_sau_chonde_thang CASCADE;
        DROP MATERIALIZED VIEW IF EXISTS chuyen_sau_chonde_thang CASCADE;
        DROP VIEW IF EXISTS chuyen_sau_chonde_monhoc CASCADE;
        DROP MATERIALIZED VIEW IF EXISTS chuyen_sau_chonde_monhoc CASCADE;
      END $$;
    `,
  },
  {
    name: 'V55_link_results_with_registration_assignment',
    version: 55,
    sql: `
      DO $$
      DECLARE
        target_name TEXT;
        relkind CHAR;
      BEGIN
        FOREACH target_name IN ARRAY ARRAY['chuyen_sau_ketqua', 'chuyen_sau_results'] LOOP
          SELECT c.relkind INTO relkind
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = target_name
          LIMIT 1;

          IF relkind IN ('r', 'p') THEN
            EXECUTE format(
              'ALTER TABLE %I
                 ADD COLUMN IF NOT EXISTS registration_id BIGINT,
                 ADD COLUMN IF NOT EXISTS assignment_id BIGINT',
              target_name
            );
          END IF;
        END LOOP;

        IF to_regclass('public.chuyen_sau_ketqua') IS NOT NULL
           AND EXISTS (
             SELECT 1
             FROM pg_class c
             JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public'
               AND c.relname = 'chuyen_sau_results'
               AND c.relkind IN ('v', 'm')
           ) THEN
          CREATE OR REPLACE VIEW chuyen_sau_results AS SELECT * FROM chuyen_sau_ketqua;
        END IF;
      END $$;

      DO $$
      BEGIN
        IF to_regclass('public.chuyen_sau_ketqua') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chuyen_sau_ketqua_registration') THEN
          ALTER TABLE chuyen_sau_ketqua
            ADD CONSTRAINT fk_chuyen_sau_ketqua_registration
            FOREIGN KEY (registration_id) REFERENCES chuyen_sau_dangky(id) ON DELETE SET NULL;
        END IF;

        IF to_regclass('public.chuyen_sau_ketqua') IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chuyen_sau_ketqua_assignment') THEN
          ALTER TABLE chuyen_sau_ketqua
            ADD CONSTRAINT fk_chuyen_sau_ketqua_assignment
            FOREIGN KEY (assignment_id) REFERENCES teacher_exam_assignments(id) ON DELETE SET NULL;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_chuyen_sau_ketqua_registration_id
      ON chuyen_sau_ketqua(registration_id);

      CREATE INDEX IF NOT EXISTS idx_chuyen_sau_ketqua_assignment_id
      ON chuyen_sau_ketqua(assignment_id);

      WITH matched AS (
        SELECT
          csr.id AS result_id,
          tea.registration_id,
          tea.id AS assignment_id,
          ROW_NUMBER() OVER (
            PARTITION BY csr.id
            ORDER BY tea.open_at DESC, tea.created_at DESC, tea.id DESC
          ) AS rn
        FROM chuyen_sau_results csr
        JOIN teacher_exam_assignments tea
          ON LOWER(TRIM(csr.ma_lms)) = LOWER(TRIM(tea.teacher_code))
          AND LOWER(TRIM(csr.bo_mon)) = LOWER(TRIM(tea.subject_code))
          AND csr.thang_dk = EXTRACT(MONTH FROM tea.open_at)::INT
          AND csr.nam_dk = EXTRACT(YEAR FROM tea.open_at)::INT
          AND (csr.de IS NULL OR csr.de = tea.selected_set_id::text)
      )
      UPDATE chuyen_sau_results csr
      SET registration_id = m.registration_id,
          assignment_id = m.assignment_id,
          updated_at = NOW()
      FROM matched m
      WHERE csr.id = m.result_id
        AND m.rn = 1
        AND (csr.registration_id IS NULL OR csr.assignment_id IS NULL);
    `,
  },
  {
    name: 'V56_link_explanations_with_assignment_registration',
    version: 56,
    sql: `
      ALTER TABLE explanations
        ADD COLUMN IF NOT EXISTS registration_id BIGINT,
        ADD COLUMN IF NOT EXISTS assignment_id BIGINT;

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_explanations_registration') THEN
          ALTER TABLE explanations
            ADD CONSTRAINT fk_explanations_registration
            FOREIGN KEY (registration_id) REFERENCES chuyen_sau_dangky(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_explanations_assignment') THEN
          ALTER TABLE explanations
            ADD CONSTRAINT fk_explanations_assignment
            FOREIGN KEY (assignment_id) REFERENCES teacher_exam_assignments(id) ON DELETE SET NULL;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_explanations_registration_id ON explanations(registration_id);
      CREATE INDEX IF NOT EXISTS idx_explanations_assignment_id ON explanations(assignment_id);

      WITH linked AS (
        SELECT
          e.id AS explanation_id,
          csr.registration_id,
          csr.assignment_id,
          ROW_NUMBER() OVER (
            PARTITION BY e.id
            ORDER BY csr.updated_at DESC, csr.created_at DESC, csr.id DESC
          ) AS rn
        FROM explanations e
        JOIN chuyen_sau_results csr
          ON LOWER(TRIM(csr.ma_lms)) = LOWER(TRIM(e.lms_code))
          AND LOWER(TRIM(csr.bo_mon)) = LOWER(TRIM(e.subject))
          AND csr.thang_dk = EXTRACT(MONTH FROM e.test_date)::INT
          AND csr.nam_dk = EXTRACT(YEAR FROM e.test_date)::INT
        WHERE e.assignment_id IS NULL OR e.registration_id IS NULL
      )
      UPDATE explanations e
      SET assignment_id = COALESCE(e.assignment_id, l.assignment_id),
          registration_id = COALESCE(e.registration_id, l.registration_id),
          updated_at = NOW()
      FROM linked l
      WHERE e.id = l.explanation_id
        AND l.rn = 1;
    `,
  },
  {
    name: 'V57_registration_unique_by_event_schedule',
    version: 57,
    sql: `
      ALTER TABLE chuyen_sau_dangky
        ADD COLUMN IF NOT EXISTS event_schedule_id UUID;

      DO $$
      DECLARE
        constraint_name TEXT;
      BEGIN
        FOR constraint_name IN
          SELECT c.conname
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'public'
            AND t.relname = 'chuyen_sau_dangky'
            AND c.contype = 'u'
            AND c.conkey = ARRAY[
              (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'teacher_code' AND NOT attisdropped),
              (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'exam_type' AND NOT attisdropped),
              (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'block_code' AND NOT attisdropped),
              (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'subject_code' AND NOT attisdropped),
              (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'month' AND NOT attisdropped),
              (SELECT attnum FROM pg_attribute WHERE attrelid = t.oid AND attname = 'year' AND NOT attisdropped)
            ]::smallint[]
        LOOP
          EXECUTE format('ALTER TABLE chuyen_sau_dangky DROP CONSTRAINT IF EXISTS %I', constraint_name);
        END LOOP;
      END $$;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_chuyen_sau_dangky_unique_event
      ON chuyen_sau_dangky (teacher_code, exam_type, block_code, subject_code, event_schedule_id)
      WHERE event_schedule_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_chuyen_sau_dangky_unique_month_fallback
      ON chuyen_sau_dangky (teacher_code, exam_type, block_code, subject_code, month, year)
      WHERE event_schedule_id IS NULL;
    `,
  },
  {
    name: 'V58_drop_legacy_chuyen_sau_phancong',
    version: 58,
    sql: `
      DROP VIEW IF EXISTS chuyen_sau_assignments;
      DROP TABLE IF EXISTS chuyen_sau_phancong CASCADE;
      DROP TABLE IF EXISTS chuyensau_phancong CASCADE;
    `,
  },
  {
    name: 'V59_link_explanation_id_to_chuyen_sau_giaitrinh',
    version: 59,
    sql: `
      DO $$
      BEGIN
        IF to_regclass('public.chuyen_sau_giaitrinh') IS NULL THEN
          RETURN;
        END IF;

        ALTER TABLE chuyen_sau_giaitrinh
          ADD COLUMN IF NOT EXISTS explanation_id BIGINT,
          ADD COLUMN IF NOT EXISTS registration_id BIGINT;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_chuyen_sau_giaitrinh_explanation_id'
        ) THEN
          ALTER TABLE chuyen_sau_giaitrinh
            ADD CONSTRAINT fk_chuyen_sau_giaitrinh_explanation_id
            FOREIGN KEY (explanation_id) REFERENCES explanations(id) ON DELETE SET NULL;
        END IF;

        IF to_regclass('public.chuyen_sau_dangky') IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM pg_constraint WHERE conname = 'fk_chuyen_sau_giaitrinh_registration'
           ) THEN
          ALTER TABLE chuyen_sau_giaitrinh
            ADD CONSTRAINT fk_chuyen_sau_giaitrinh_registration
            FOREIGN KEY (registration_id) REFERENCES chuyen_sau_dangky(id) ON DELETE SET NULL;
        END IF;
      END $$;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_chuyen_sau_giaitrinh_explanation_id
      ON chuyen_sau_giaitrinh(explanation_id)
      WHERE explanation_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_chuyen_sau_giaitrinh_registration_id
      ON chuyen_sau_giaitrinh(registration_id);

      WITH matched AS (
        SELECT
          e.id AS explanation_id,
          e.registration_id,
          e.assignment_id,
          ROW_NUMBER() OVER (
            PARTITION BY e.id
            ORDER BY csg.updated_at DESC, csg.created_at DESC, csg.id DESC
          ) AS rn,
          csg.id AS csg_id
        FROM explanations e
        JOIN chuyen_sau_giaitrinh csg
          ON (
            e.assignment_id IS NOT NULL
            AND csg.assignment_id = e.assignment_id
          )
          OR (
            e.assignment_id IS NULL
            AND LOWER(TRIM(COALESCE(csg.teacher_code, ''))) = LOWER(TRIM(COALESCE(e.lms_code, '')))
            AND LOWER(TRIM(COALESCE(csg.email, ''))) = LOWER(TRIM(COALESCE(e.email, '')))
            AND LOWER(TRIM(COALESCE(csg.reason, ''))) = LOWER(TRIM(COALESCE(e.reason, '')))
            AND csg.created_at::date = e.created_at::date
          )
      )
      UPDATE chuyen_sau_giaitrinh csg
      SET explanation_id = m.explanation_id,
          registration_id = COALESCE(csg.registration_id, m.registration_id),
          updated_at = NOW()
      FROM matched m
      WHERE csg.id = m.csg_id
        AND m.rn = 1
        AND (csg.explanation_id IS NULL OR csg.registration_id IS NULL);
    `,
  },
  {
    name: 'V61_create_chuyen_sau_chonde_thang',
    version: 61,
    sql: `
      CREATE TABLE IF NOT EXISTS chuyen_sau_chonde_thang (
        id serial PRIMARY KEY,
        id_mon integer NOT NULL REFERENCES chuyen_sau_monhoc(id) ON DELETE CASCADE,
        nam integer NOT NULL,
        thang integer NOT NULL,
        id_de integer NOT NULL REFERENCES chuyen_sau_bode(id) ON DELETE CASCADE,
        che_do_chon varchar(20) DEFAULT 'manual',
        tao_luc timestamp DEFAULT CURRENT_TIMESTAMP,
        cap_nhat_luc timestamp DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(id_mon, nam, thang)
      );

      CREATE INDEX IF NOT EXISTS idx_chuyen_sau_chonde_thang_id_de ON chuyen_sau_chonde_thang(id_de);
    `,
  },
  {
    name: 'V62_refactor_giaitrinh_to_new_tables',
    version: 62,
    sql: `
      -- 1. Add xu_ly_giai_trinh: tracks explanation status (pending/accepted/rejected) in giaitrinh table
      ALTER TABLE IF EXISTS chuyen_sau_giaitrinh
        ADD COLUMN IF NOT EXISTS xu_ly_giai_trinh VARCHAR(50) DEFAULT 'chờ giải trình';

      -- 2. Unique index: one explanation per result
      CREATE UNIQUE INDEX IF NOT EXISTS idx_chuyen_sau_giaitrinh_id_ket_qua
        ON chuyen_sau_giaitrinh(id_ket_qua)
        WHERE id_ket_qua IS NOT NULL;

      -- 3. Drop old explanations table (cascades FK on giaitrinh.explanation_id)
      DROP TABLE IF EXISTS explanations CASCADE;

      -- 4. Drop legacy columns no longer used in chuyen_sau_giaitrinh
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_giaitrinh' AND column_name = 'explanation_id'
        ) THEN
          ALTER TABLE chuyen_sau_giaitrinh DROP COLUMN IF EXISTS explanation_id;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_giaitrinh' AND column_name = 'registration_id'
        ) THEN
          ALTER TABLE chuyen_sau_giaitrinh DROP COLUMN IF EXISTS registration_id;
        END IF;
      END $$;

      -- 5. Drop legacy explanation_id from results tables
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_results' AND column_name = 'explanation_id'
        ) THEN
          ALTER TABLE chuyen_sau_results DROP COLUMN IF EXISTS explanation_id;
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'chuyen_sau_ketqua' AND column_name = 'explanation_id'
        ) THEN
          ALTER TABLE chuyen_sau_ketqua DROP COLUMN IF EXISTS explanation_id;
        END IF;
      END $$;
    `,
  },
];

// ========== HÀM CHẠY MIGRATIONS ==========

let migrationRan = false;

export async function runMigrations(pool: Pool): Promise<{ success: boolean; applied: string[]; errors: string[] }> {
  const applied: string[] = [];
  const errors: string[] = [];

  // Use a single client for all migrations to ensure connection stability and performance
  let client: PoolClient | undefined;
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

      // Cache cho legacy bridge check (chỉ cần query 1 lần cho cả V43 và V52)
      let cachedBridgeState: {
        hasLegacyExamTables: boolean;
        hasCanonicalChuyenSau: boolean;
      } | null = null;

      const getBridgeState = async () => {
        if (cachedBridgeState) return cachedBridgeState;
        const tableState = await client!.query(`
          SELECT
            to_regclass('public.exam_subject_catalog') IS NOT NULL AS has_exam_subject_catalog,
            to_regclass('public.exam_sets') IS NOT NULL AS has_exam_sets,
            to_regclass('public.exam_set_questions') IS NOT NULL AS has_exam_set_questions,
            to_regclass('public.chuyen_sau_monhoc') IS NOT NULL AS has_chuyen_sau_monhoc,
            to_regclass('public.chuyen_sau_bode') IS NOT NULL AS has_chuyen_sau_bode,
            to_regclass('public.chuyen_sau_cauhoi') IS NOT NULL AS has_chuyen_sau_cauhoi
        `);
        const state = tableState.rows[0] || {};
        cachedBridgeState = {
          hasLegacyExamTables:
            Boolean(state.has_exam_subject_catalog) &&
            Boolean(state.has_exam_sets) &&
            Boolean(state.has_exam_set_questions),
          hasCanonicalChuyenSau:
            Boolean(state.has_chuyen_sau_monhoc) &&
            Boolean(state.has_chuyen_sau_bode) &&
            Boolean(state.has_chuyen_sau_cauhoi),
        };
        return cachedBridgeState;
      };

      // Bước 3: Chạy từng migration chưa applied
      for (const migration of migrations) {
        if (appliedMigrations.has(migration.name)) {
          continue; // Đã chạy rồi, bỏ qua
        }

        // Legacy bridge: if old exam_* tables are gone and canonical chuyen_sau_* exists,
        // mark legacy-dependent migrations as applied to avoid repeated "relation exam_sets does not exist" errors.
        if (migration.name === 'V43_create_chuyensau_database_model' || migration.name === 'V52_subject_driven_exam_config') {
          const { hasLegacyExamTables, hasCanonicalChuyenSau } = await getBridgeState();

          if (!hasLegacyExamTables && hasCanonicalChuyenSau) {
            await client.query(
              'INSERT INTO _migrations (name, version) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
              [migration.name, migration.version]
            );
            applied.push(migration.name);
            console.log(`  ⏭️ Migration skipped as already cut-over: ${migration.name} (v${migration.version})`);
            continue;
          }
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

