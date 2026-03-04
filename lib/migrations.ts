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

    // ═══════════════════════════════════════════════════════
    // THÊM MIGRATION MỚI Ở ĐÂY
    // Ví dụ cho chức năng mới:
    // {
    //   name: 'create_exam_schedules',
    //   version: 20,
    //   sql: `CREATE TABLE IF NOT EXISTS exam_schedules (...);`,
    // },
    // ═══════════════════════════════════════════════════════
];

// ========== HÀM CHẠY MIGRATIONS ==========

let migrationRan = false;

export async function runMigrations(pool: Pool): Promise<{ success: boolean; applied: string[]; errors: string[] }> {
    const applied: string[] = [];
    const errors: string[] = [];

    try {
        // Bước 1: Tạo bảng _migrations trước (luôn chạy)
        await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        version INTEGER NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        // Bước 2: Lấy danh sách migration đã chạy
        const result = await pool.query('SELECT name FROM _migrations');
        const appliedMigrations = new Set(result.rows.map((r: { name: string }) => r.name));

        // Bước 3: Chạy từng migration chưa applied
        for (const migration of migrations) {
            if (appliedMigrations.has(migration.name)) {
                continue; // Đã chạy rồi, bỏ qua
            }

            try {
                await pool.query('BEGIN');
                await pool.query(migration.sql);
                await pool.query(
                    'INSERT INTO _migrations (name, version) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
                    [migration.name, migration.version]
                );
                await pool.query('COMMIT');

                applied.push(migration.name);
                console.log(`  ✅ Migration applied: ${migration.name} (v${migration.version})`);
            } catch (err: any) {
                await pool.query('ROLLBACK');
                const errorMsg = `Migration ${migration.name} failed: ${err.message}`;
                errors.push(errorMsg);
                console.error(`  ❌ ${errorMsg}`);
                // Tiếp tục với migration tiếp theo (không dừng lại)
            }
        }

        return { success: errors.length === 0, applied, errors };
    } catch (err: any) {
        console.error('❌ Migration system error:', err.message);
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

