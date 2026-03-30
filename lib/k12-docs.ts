import { promises as fs } from "fs";
import path from "path";

export interface K12DocItem {
	slug: string;
	title: string;
	relativePath: string;
	content: string;
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

function prettifyName(filename: string) {
	const noExt = filename.replace(/\.md$/i, "");
	return noExt
		.replace(/^[ivxlcdm]+\.-?/i, "")
		.replace(/^[0-9]+\.-?/i, "")
		.replace(/[._-]+/g, " ")
		.trim();
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

export async function loadK12Docs(): Promise<K12DocsPayload> {
	const documents: K12DocItem[] = [];
	const tree = await walkDirectory(DOCS_ROOT, "", documents);

	const defaultDoc =
		documents.find((doc) => doc.slug.endsWith("/index")) ||
		documents.find((doc) => doc.slug === "index") ||
		documents[0];

	return {
		rootTitle: "Quy trình quy định K12 Teaching",
		tree,
		documents,
		defaultSlug: defaultDoc?.slug || "",
	};
}
