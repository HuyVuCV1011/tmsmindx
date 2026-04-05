import { promises as fs } from "fs";
import pool from "@/lib/db";
import path from "path";

let k12SchemaEnsured = false;

export interface K12DocItem {
	id: number;
	slug: string;
	title: string;
	relativePath: string;
	content: string;
	type?: "section" | "article";
	sectionId?: number | null;
	parentId?: number | null;
	topic?: string;
	excerpt?: string;
	coverImageUrl?: string;
	headings: Array<{ id: string; text: string; level: number }>;
}

export interface K12DocNode {
	id: string;
	title: string;
	children?: K12DocNode[];
	slug?: string;
}

export interface K12DocsPayload {
	rootTitle: string;
	tree: K12DocNode[];
	documents: K12DocItem[];
	defaultSlug: string;
}

interface K12DocumentRow {
	id: number;
	slug: string;
	title: string;
	relative_path: string;
	content: string;
	type: "section" | "article";
	section_id: number | null;
	parent_id: number | null;
	topic?: string | null;
	excerpt?: string | null;
	cover_image_url?: string | null;
	status: "draft" | "published";
	sort_order: number;
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

	k12SchemaEnsured = true;
}

const DOCS_ROOT = path.join(
	process.cwd(),
	"app",
	"api",
	"gitbook_markdown",
	"markdown_files",
	"quy-trinh-quy-dinh-danh-cho-giao-vien"
);

function slugify(input: string) {
	return input
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9\s-]/g, "")
		.trim()
		.replace(/\s+/g, "-");
}

function addVietnameseAccents(input: string) {
	return input
		.replace(/\bQuy Trinh\b/gi, "Quy Trình")
		.replace(/\bQuy Dinh\b/gi, "Quy Định")
		.replace(/\bGiao Vien\b/gi, "Giáo Viên")
		.replace(/\bDao Tao\b/gi, "Đào Tạo")
		.replace(/\bDanh Gia\b/gi, "Đánh Giá")
		.replace(/\bKiem Tra\b/gi, "Kiểm Tra")
		.replace(/\bHuong Dan\b/gi, "Hướng Dẫn")
		.replace(/\bThong Tin\b/gi, "Thông Tin")
		.replace(/\bNghiep Vu\b/gi, "Nghiệp Vụ");
}

function prettifyName(filename: string) {
	const noExt = filename.replace(/\.md$/i, "");
	const cleaned = noExt
		.replace(/^[ivxlcdm]+\.-?/i, "")
		.replace(/^[0-9]+\.-?/i, "")
		.replace(/[._-]+/g, " ")
		.trim();

	const title = cleaned
		.split(/\s+/)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");

	return addVietnameseAccents(title);
}

function decodeHtmlEntities(input: string) {
	return input
		.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

function cleanHeadingText(raw: string) {
	const withoutTags = raw.replace(/<[^>]+>/g, " ");
	const withoutLinks = withoutTags.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1");
	const withoutMarks = withoutLinks
		.replace(/[*_`~]/g, "")
		.replace(/\\/g, "")
		.trim();

	return decodeHtmlEntities(withoutMarks)
		.replace(/\s+/g, " ")
		.trim();
}

function extractTitle(content: string, fallback: string) {
	const firstHeading = content.match(/^#\s+(.+)$/m);
	const cleaned = cleanHeadingText(firstHeading?.[1] || fallback);
	return cleaned || fallback;
}

function extractHeadings(content: string) {
	const result: Array<{ id: string; text: string; level: number }> = [];
	const headingRegex = /^(#{1,3})\s+(.+)$/gm;
	let match: RegExpExecArray | null;

	while ((match = headingRegex.exec(content)) !== null) {
		const hashes = match[1];
		const rawText = match[2].trim();
		const text = cleanHeadingText(rawText);

		if (!text) continue;

		result.push({
			id: slugify(text),
			text,
			level: hashes.length,
		});
	}

	if (result.length > 0) {
		return result;
	}

	const htmlHeadingRegex = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
	while ((match = htmlHeadingRegex.exec(content)) !== null) {
		const level = Number(match[1]);
		const text = cleanHeadingText(match[2] || "");
		if (!text) continue;

		result.push({
			id: slugify(text),
			text,
			level,
		});
	}

	return result;
}

async function walkDirectory(
	absoluteDir: string,
	relativeDir: string,
	docs: K12DocItem[]
): Promise<K12DocNode[]> {
	const entries = await fs.readdir(absoluteDir, { withFileTypes: true });
	const sorted = entries.sort((a, b) => a.name.localeCompare(b.name, "vi"));
	const nodes: K12DocNode[] = [];

	for (const entry of sorted) {
		const absolutePath = path.join(absoluteDir, entry.name);
		const relativePath = path.join(relativeDir, entry.name);

		if (entry.isDirectory()) {
			const children = await walkDirectory(absolutePath, relativePath, docs);
			if (children.length > 0) {
				nodes.push({
					id: relativePath.replace(/\\/g, "/"),
					title: prettifyName(entry.name),
					children,
				});
			}
			continue;
		}

		if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) {
			continue;
		}

		const content = await fs.readFile(absolutePath, "utf8");
		const normalizedRelative = relativePath.replace(/\\/g, "/");
		const slug = normalizedRelative.replace(/\.md$/i, "");
		const fallbackTitle = prettifyName(entry.name) || entry.name;
		const title = extractTitle(content, fallbackTitle);

		docs.push({
			id: docs.length + 1,
			slug,
			title,
			relativePath: normalizedRelative,
			content,
			headings: extractHeadings(content),
		});

		nodes.push({
			id: normalizedRelative,
			title,
			slug,
		});
	}

	return nodes;
}

function buildTreeFromRelativePaths(documents: K12DocItem[]): K12DocNode[] {
	const root: K12DocNode[] = [];
	const nodeMap = new Map<string, K12DocNode>();

	const ensureFolderNode = (folderPath: string, folderName: string, parentPath: string | null) => {
		if (nodeMap.has(folderPath)) return nodeMap.get(folderPath)!;

		const node: K12DocNode = {
			id: folderPath,
			title: prettifyName(folderName),
			children: [],
		};

		nodeMap.set(folderPath, node);

		if (!parentPath) {
			root.push(node);
		} else {
			const parent = nodeMap.get(parentPath);
			if (parent) {
				if (!parent.children) parent.children = [];
				parent.children.push(node);
			}
		}

		return node;
	};

	for (const doc of documents) {
		const segments = doc.relativePath.split("/");
		const fileName = segments.pop() || "";
		let parentFolderPath: string | null = null;

		segments.forEach((segment, index) => {
			const currentFolderPath = segments.slice(0, index + 1).join("/");
			ensureFolderNode(currentFolderPath, segment, parentFolderPath);
			parentFolderPath = currentFolderPath;
		});

		const fileNode: K12DocNode = {
			id: doc.relativePath,
			title: doc.title || prettifyName(fileName),
			slug: doc.slug,
		};

		if (parentFolderPath) {
			const parent = nodeMap.get(parentFolderPath);
			if (parent) {
				if (!parent.children) parent.children = [];
				parent.children.push(fileNode);
			}
		} else {
			root.push(fileNode);
		}
	}

	return root;
}

async function seedK12DocsFromFilesystem() {
	const docs: K12DocItem[] = [];
	await walkDirectory(DOCS_ROOT, "", docs);

	if (docs.length === 0) {
		return;
	}

	const client = await pool.connect();
	try {
		await client.query("BEGIN");

		for (let i = 0; i < docs.length; i++) {
			const doc = docs[i];
			await client.query(
				`INSERT INTO k12_documents (slug, title, relative_path, content, status, sort_order, created_by_email, updated_by_email)
				 VALUES ($1, $2, $3, $4, 'published', $5, 'system', 'system')
				 ON CONFLICT (slug) DO NOTHING`,
				[doc.slug, doc.title, doc.relativePath, doc.content, i]
			);
		}

		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}

async function loadK12DocsFromDatabase(): Promise<K12DocsPayload | null> {
	const client = await pool.connect();
	let releasedEarly = false;
	try {
		await ensureK12Schema();

		const tableCheck = await client.query(
			"SELECT to_regclass('public.k12_documents') AS table_name"
		);

		if (!tableCheck.rows[0]?.table_name) {
			return null;
		}

		const countResult = await client.query(
			"SELECT COUNT(*)::int AS count FROM k12_documents"
		);

		if (countResult.rows[0]?.count === 0) {
			client.release();
			releasedEarly = true;
			await seedK12DocsFromFilesystem();
			return await loadK12DocsFromDatabase();
		}

		const result = await client.query<K12DocumentRow>(
			`SELECT id, slug, title, relative_path, content, type, section_id, parent_id, topic, excerpt, cover_image_url, status, sort_order
			 FROM k12_documents
			 WHERE status = 'published'
			 ORDER BY sort_order ASC, title ASC`
		);

		const documents: K12DocItem[] = result.rows.map((row) => ({
			id: row.id,
			slug: row.slug,
			title: row.title,
			relativePath: row.relative_path,
			content: row.content,
			type: row.type,
			sectionId: row.section_id,
			parentId: row.parent_id,
			topic: row.topic || undefined,
			excerpt: row.excerpt || undefined,
			coverImageUrl: row.cover_image_url || undefined,
			headings: extractHeadings(row.content),
		}));

		if (documents.length === 0) {
			return null;
		}

		const tree = buildTreeFromRelativePaths(documents);
		const defaultDoc =
			documents.find((doc) => doc.slug.endsWith("/index")) ||
			documents.find((doc) => doc.slug === "index") ||
			documents[0];

		return {
			rootTitle: "Quy Trình, Quy Định K12 Teaching",
			tree,
			documents,
			defaultSlug: defaultDoc?.slug || "",
		};
	} finally {
		if (!releasedEarly) {
			client.release();
		}
	}
}

export async function loadK12Docs(): Promise<K12DocsPayload> {
	try {
		const dbDocs = await loadK12DocsFromDatabase();
		if (dbDocs) {
			return dbDocs;
		}
	} catch (error) {
		console.error("Failed loading K12 docs from database, fallback to filesystem:", error);
	}

	const documents: K12DocItem[] = [];
	const tree = await walkDirectory(DOCS_ROOT, "", documents);

	const defaultDoc =
		documents.find((doc) => doc.slug.endsWith("/index")) ||
		documents.find((doc) => doc.slug === "index") ||
		documents[0];

	return {
		rootTitle: "Quy Trình, Quy Định K12 Teaching",
		tree,
		documents,
		defaultSlug: defaultDoc?.slug || "",
	};
}
