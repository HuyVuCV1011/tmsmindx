import path from "path";
import pool from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

let k12SchemaEnsured = false;

interface K12DocPayload {
  type?: "section" | "article";
  slug?: string;
  title?: string;
  relativePath?: string;
  content?: string;
  topic?: string;
  excerpt?: string;
  coverImageUrl?: string;
  sectionSlug?: string;
  parentSlug?: string;
  status?: "draft" | "published";
  sortOrder?: number;
  originalSlug?: string;
}

async function ensureK12Schema() {
  if (k12SchemaEnsured) return;

  await pool.query(`
    ALTER TABLE IF EXISTS k12_documents
    ADD COLUMN IF NOT EXISTS topic VARCHAR(255),
    ADD COLUMN IF NOT EXISTS excerpt TEXT,
    ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
    ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT 'article',
    ADD COLUMN IF NOT EXISTS section_id INTEGER,
    ADD COLUMN IF NOT EXISTS parent_id INTEGER,
    ADD COLUMN IF NOT EXISTS content_format VARCHAR(20) NOT NULL DEFAULT 'html'
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'k12_documents_type_check'
      ) THEN
        ALTER TABLE k12_documents
        ADD CONSTRAINT k12_documents_type_check CHECK (type IN ('section', 'article'));
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'k12_documents_content_format_check'
      ) THEN
        ALTER TABLE k12_documents
        ADD CONSTRAINT k12_documents_content_format_check CHECK (content_format IN ('html', 'json'));
      END IF;
    END $$;
  `);

  k12SchemaEnsured = true;
}

function normalizeSlug(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

async function getDocBySlug(slug: string) {
  await ensureK12Schema();

  const result = await pool.query(
    "SELECT id, slug, relative_path, type, section_id, parent_id FROM k12_documents WHERE slug = $1 LIMIT 1",
    [slug]
  );

  return result.rows[0] || null;
}

function getDirname(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  const dir = path.posix.dirname(normalized);
  return dir === "." ? "" : dir;
}

function buildRelativePathByHierarchy(type: "section" | "article", slug: string, sectionDoc?: { relative_path: string } | null, parentDoc?: { relative_path: string } | null) {
  if (type === "section") {
    if (parentDoc?.relative_path) {
      return `${getDirname(parentDoc.relative_path)}/${slug}/index.md`;
    }
    return `${slug}/index.md`;
  }

  if (parentDoc?.relative_path) {
    return `${getDirname(parentDoc.relative_path)}/${slug}.md`;
  }

  if (sectionDoc?.relative_path) {
    return `${getDirname(sectionDoc.relative_path)}/${slug}.md`;
  }

  return `${slug}.md`;
}

async function ensureSuperAdmin(request: NextRequest) {
  const queryEmail = request.nextUrl.searchParams.get("email");
  const headerEmail = request.headers.get("x-user-email");
  const email = (headerEmail || queryEmail || "").toLowerCase().trim();

  if (!email) {
    return {
      ok: false,
      email: "",
      response: NextResponse.json({ success: false, error: "Thiếu thông tin tài khoản" }, { status: 401 }),
    };
  }

  const result = await pool.query(
    "SELECT role FROM app_users WHERE LOWER(email) = $1 AND is_active = true LIMIT 1",
    [email]
  );

  if (!result.rows[0] || result.rows[0].role !== "super_admin") {
    return {
      ok: false,
      email,
      response: NextResponse.json({ success: false, error: "Chỉ Super Admin được phép thao tác" }, { status: 403 }),
    };
  }

  return { ok: true, email };
}

export async function GET(request: NextRequest) {
  try {
    await ensureK12Schema();

    const includeDraft = request.nextUrl.searchParams.get("includeDraft") === "1";

    if (includeDraft) {
      const auth = await ensureSuperAdmin(request);
      if (!auth.ok) return auth.response;
    }

    const query = includeDraft
      ? `SELECT id, slug, title, relative_path, content, topic, excerpt, cover_image_url, type, section_id, parent_id, status, sort_order, updated_at
         FROM k12_documents
         ORDER BY sort_order ASC, title ASC`
      : `SELECT id, slug, title, relative_path, content, topic, excerpt, cover_image_url, type, section_id, parent_id, status, sort_order, updated_at
         FROM k12_documents
         WHERE status = 'published'
         ORDER BY sort_order ASC, title ASC`;

    const result = await pool.query(query);

    return NextResponse.json({
      success: true,
      data: result.rows.map((row: any) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        relativePath: row.relative_path,
        content: row.content,
        topic: row.topic || "",
        excerpt: row.excerpt || "",
        coverImageUrl: row.cover_image_url || "",
        type: row.type || "article",
        sectionId: row.section_id,
        parentId: row.parent_id,
        status: row.status,
        sortOrder: row.sort_order,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error: any) {
    console.error("k12-docs GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureK12Schema();

    const auth = await ensureSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as K12DocPayload;
    const type = body.type === "section" || body.sectionSlug === "__new__" ? "section" : "article";
    const title = (body.title || "").trim();
    const content = body.content || "";
    const topic = (body.topic || "").trim();
    const excerpt = (body.excerpt || "").trim();
    const coverImageUrl = (body.coverImageUrl || "").trim();
    const status = body.status === "published" ? "published" : "draft";
    const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0;

    if (!title) {
      return NextResponse.json({ success: false, error: "Tiêu đề là bắt buộc" }, { status: 400 });
    }

    const requestedSlug = (body.slug || "").trim();
    const slug = normalizeSlug(requestedSlug || title);
    if (!slug) {
      return NextResponse.json({ success: false, error: "Slug không hợp lệ" }, { status: 400 });
    }

    const sectionDoc = body.sectionSlug && body.sectionSlug !== "__new__" ? await getDocBySlug(normalizeSlug(body.sectionSlug)) : null;
    const parentDoc = body.parentSlug ? await getDocBySlug(normalizeSlug(body.parentSlug)) : null;
    const relativePath = buildRelativePathByHierarchy(type, slug, sectionDoc, parentDoc).replace(/\\/g, "/").trim();

    const sectionId =
      type === "article"
        ? sectionDoc?.id || (parentDoc?.type === "section" ? parentDoc.id : parentDoc?.section_id || null)
        : null;
    const parentId = parentDoc?.id || null;

    const existed = await pool.query("SELECT 1 FROM k12_documents WHERE slug = $1 LIMIT 1", [slug]);
    if (existed.rowCount) {
      return NextResponse.json({ success: false, error: "Slug đã tồn tại" }, { status: 409 });
    }

    const inserted = await pool.query(
      `INSERT INTO k12_documents (
         slug, title, relative_path, content, topic, excerpt, cover_image_url, type, section_id, parent_id, status, sort_order, created_by_email, updated_by_email
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
       RETURNING id, slug, title, relative_path, content, topic, excerpt, cover_image_url, type, section_id, parent_id, status, sort_order, updated_at`,
      [slug, title, relativePath, content, topic || null, excerpt || null, coverImageUrl || null, type, sectionId, parentId, status, sortOrder, auth.email]
    );

    return NextResponse.json({
      success: true,
      message: status === "draft" ? "Đã lưu nháp" : "Đã xuất bản",
      data: {
        slug: inserted.rows[0].slug,
        title: inserted.rows[0].title,
        relativePath: inserted.rows[0].relative_path,
        content: inserted.rows[0].content,
        topic: inserted.rows[0].topic || "",
        excerpt: inserted.rows[0].excerpt || "",
        coverImageUrl: inserted.rows[0].cover_image_url || "",
        type: inserted.rows[0].type || "article",
        sectionId: inserted.rows[0].section_id,
        parentId: inserted.rows[0].parent_id,
        status: inserted.rows[0].status,
        sortOrder: inserted.rows[0].sort_order,
        updatedAt: inserted.rows[0].updated_at,
      },
    });
  } catch (error: any) {
    console.error("k12-docs POST error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureK12Schema();

    const auth = await ensureSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as K12DocPayload;
    const originalSlug = (body.originalSlug || body.slug || "").trim();
    const nextType = body.type === "section" || body.sectionSlug === "__new__"
      ? "section"
      : body.type === "article"
        ? "article"
        : undefined;

    if (!originalSlug) {
      return NextResponse.json({ success: false, error: "Thiếu slug tài liệu" }, { status: 400 });
    }

    const current = await pool.query("SELECT * FROM k12_documents WHERE slug = $1", [originalSlug]);
    if (current.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy tài liệu" }, { status: 404 });
    }

    const title = (body.title || current.rows[0].title).trim();
    const nextSlug = normalizeSlug((body.slug || originalSlug).trim());
    const currentType = current.rows[0].type === "section" ? "section" : "article";
    const finalType = nextType || currentType;
    const sectionDoc = body.sectionSlug && body.sectionSlug !== "__new__" ? await getDocBySlug(normalizeSlug(body.sectionSlug)) : null;
    const parentDoc = body.parentSlug ? await getDocBySlug(normalizeSlug(body.parentSlug)) : null;
    const relativePath = buildRelativePathByHierarchy(finalType, nextSlug, sectionDoc, parentDoc).replace(/\\/g, "/").trim();
    const content = body.content ?? current.rows[0].content;
    const topic = (body.topic ?? current.rows[0].topic ?? "").trim();
    const excerpt = (body.excerpt ?? current.rows[0].excerpt ?? "").trim();
    const coverImageUrl = (body.coverImageUrl ?? current.rows[0].cover_image_url ?? "").trim();
    const status = body.status === "published" ? "published" : body.status === "draft" ? "draft" : current.rows[0].status;
    const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : current.rows[0].sort_order;
    const sectionId =
      finalType === "article"
        ? sectionDoc?.id || (parentDoc?.type === "section" ? parentDoc.id : parentDoc?.section_id || null)
        : null;
    const parentId = parentDoc?.id || null;

    if (!title || !nextSlug) {
      return NextResponse.json({ success: false, error: "Tiêu đề hoặc slug không hợp lệ" }, { status: 400 });
    }

    if (nextSlug !== originalSlug) {
      const existed = await pool.query("SELECT 1 FROM k12_documents WHERE slug = $1 LIMIT 1", [nextSlug]);
      if (existed.rowCount) {
        return NextResponse.json({ success: false, error: "Slug đã tồn tại" }, { status: 409 });
      }
    }

    const updated = await pool.query(
      `UPDATE k12_documents
       SET slug = $1,
           title = $2,
           relative_path = $3,
           content = $4,
           topic = $5,
           excerpt = $6,
           cover_image_url = $7,
           type = $8,
           section_id = $9,
           parent_id = $10,
           status = $11,
           sort_order = $12,
           updated_by_email = $13,
           updated_at = CURRENT_TIMESTAMP
       WHERE slug = $14
       RETURNING id, slug, title, relative_path, content, topic, excerpt, cover_image_url, type, section_id, parent_id, status, sort_order, updated_at`,
      [
        nextSlug,
        title,
        relativePath,
        content,
        topic || null,
        excerpt || null,
        coverImageUrl || null,
        finalType,
        sectionId,
        parentId,
        status,
        sortOrder,
        auth.email,
        originalSlug,
      ]
    );

    return NextResponse.json({
      success: true,
      message: status === "draft" ? "Đã lưu nháp" : "Đã cập nhật",
      data: {
        slug: updated.rows[0].slug,
        title: updated.rows[0].title,
        relativePath: updated.rows[0].relative_path,
        content: updated.rows[0].content,
        topic: updated.rows[0].topic || "",
        excerpt: updated.rows[0].excerpt || "",
        coverImageUrl: updated.rows[0].cover_image_url || "",
        type: updated.rows[0].type || "article",
        sectionId: updated.rows[0].section_id,
        parentId: updated.rows[0].parent_id,
        status: updated.rows[0].status,
        sortOrder: updated.rows[0].sort_order,
        updatedAt: updated.rows[0].updated_at,
      },
    });
  } catch (error: any) {
    console.error("k12-docs PATCH error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await ensureK12Schema();

    const auth = await ensureSuperAdmin(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as { slug?: string };
    const slug = (body.slug || "").trim();

    if (!slug) {
      return NextResponse.json({ success: false, error: "Thiếu slug tài liệu" }, { status: 400 });
    }

    const deleted = await pool.query("DELETE FROM k12_documents WHERE slug = $1 RETURNING slug", [slug]);
    if (deleted.rowCount === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy tài liệu" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Đã xóa tài liệu" });
  } catch (error: any) {
    console.error("k12-docs DELETE error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
