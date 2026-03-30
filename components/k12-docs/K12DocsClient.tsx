"use client";

import { PageContainer } from "@/components/PageContainer";
import { cn } from "@/lib/utils";
import { ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

export interface K12ClientDocItem {
  slug: string;
  title: string;
  relativePath: string;
  content: string;
  headings: Array<{ id: string; text: string; level: number }>;
}

export interface K12ClientDocNode {
  id: string;
  title: string;
  children?: K12ClientDocNode[];
  slug?: string;
}

interface Props {
  basePath: string;
  pageTitle: string;
  tree: K12ClientDocNode[];
  documents: K12ClientDocItem[];
  selectedSlug: string;
  defaultSlug: string;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function normalizeGitbookMarkdown(raw: string) {
  let content = raw;

  // Convert GitBook hint blocks to quote blocks so they remain readable in markdown.
  content = content.replace(
    /\{\%\s*hint\s+style="([^"]+)"\s*\%\}([\s\S]*?)\{\%\s*endhint\s*\%\}/g,
    (_all, style: string, body: string) => {
      const title = style.toUpperCase();
      const lines = body
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      return `> ${title}\n${lines}`;
    }
  );

  // Keep only the markdown link content from content-ref blocks.
  content = content.replace(/\{\%\s*content-ref[\s\S]*?\%\}/g, "");
  content = content.replace(/\{\%\s*endcontent-ref\s*\%\}/g, "");

  // Convert embed tags to normal links.
  content = content.replace(
    /\{\%\s*embed\s+url="([^"]+)"\s*\%\}/g,
    (_all, url: string) => `[Mở nội dung nhúng](${url})`
  );

  return content;
}

function mapGitbookHref(href: string, basePath: string) {
  const prefix = "quy-trinh-quy-dinh-danh-cho-giao-vien/";

  const fromRoot = "/quy-trinh-quy-dinh-danh-cho-giao-vien/";
  if (href.startsWith(fromRoot)) {
    const slug = href.slice(fromRoot.length).replace(/\.md$/i, "");
    return `${basePath}?doc=${encodeURIComponent(slug)}`;
  }

  const marker = "cxohok12.gitbook.io/quy-trinh-quy-dinh-danh-cho-giao-vien/";
  const markerIndex = href.indexOf(marker);
  if (markerIndex >= 0) {
    const slug = href.slice(markerIndex + marker.length).replace(/\.md$/i, "");
    return `${basePath}?doc=${encodeURIComponent(slug)}`;
  }

  if (href.startsWith(prefix)) {
    const slug = href.slice(prefix.length).replace(/\.md$/i, "");
    return `${basePath}?doc=${encodeURIComponent(slug)}`;
  }

  return href;
}

export default function K12DocsClient({
  basePath,
  pageTitle,
  tree,
  documents,
  selectedSlug,
  defaultSlug,
}: Props) {
  const [query, setQuery] = useState("");

  const selectedDoc = useMemo(() => {
    const effective = selectedSlug || defaultSlug;
    return documents.find((doc) => doc.slug === effective) || documents[0];
  }, [documents, selectedSlug, defaultSlug]);

  const filteredSlugs = useMemo(() => {
    if (!query.trim()) {
      return new Set<string>(documents.map((doc) => doc.slug));
    }

    const normalizedQuery = query.trim().toLowerCase();
    return new Set(
      documents
        .filter((doc) => {
          return (
            doc.title.toLowerCase().includes(normalizedQuery) ||
            doc.content.toLowerCase().includes(normalizedQuery)
          );
        })
        .map((doc) => doc.slug)
    );
  }, [documents, query]);

  const normalizedContent = useMemo(() => {
    if (!selectedDoc) return "";
    return normalizeGitbookMarkdown(selectedDoc.content);
  }, [selectedDoc]);

  const renderTree = (nodes: K12ClientDocNode[], depth = 0) => {
    return nodes
      .map((node) => {
        const hasChildren = Boolean(node.children && node.children.length > 0);
        const isDoc = Boolean(node.slug);
        const isVisibleDoc = !isDoc || filteredSlugs.has(node.slug as string);
        const renderedChildren = hasChildren ? renderTree(node.children as K12ClientDocNode[], depth + 1) : [];
        const hasVisibleChildren = renderedChildren.length > 0;

        if (!isVisibleDoc && !hasVisibleChildren) {
          return null;
        }

        const isActive = node.slug && selectedDoc?.slug === node.slug;
        return (
          <div key={node.id} className="space-y-1">
            {node.slug ? (
              <Link
                href={`${basePath}?doc=${encodeURIComponent(node.slug)}`}
                className={cn(
                  "group flex items-center rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-[#a1001f] text-white"
                    : "text-gray-700 hover:bg-gray-100"
                )}
                style={{ paddingLeft: `${8 + depth * 14}px` }}
              >
                <ChevronRight
                  className={cn(
                    "mr-1 h-3.5 w-3.5 shrink-0",
                    isActive ? "text-white" : "text-gray-400"
                  )}
                />
                <span className="line-clamp-2">{node.title}</span>
              </Link>
            ) : (
              <div
                className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
                style={{ paddingLeft: `${8 + depth * 14}px` }}
              >
                {node.title}
              </div>
            )}
            {renderedChildren}
          </div>
        );
        })
        .filter(Boolean);
  };

  return (
    <PageContainer title={pageTitle} description="Tra cứu quy trình, quy định theo cấu trúc GitBook">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)_220px]">
        <aside className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:h-[calc(100vh-120px)] lg:overflow-y-auto">
          <div className="mb-3">
            <label className="sr-only" htmlFor="k12-doc-search">
              Tìm tài liệu
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <input
                id="k12-doc-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo tiêu đề hoặc nội dung"
                className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-2 text-sm focus:border-[#a1001f] focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">{renderTree(tree)}</div>
        </aside>

        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {selectedDoc ? (
            <>
              <h1 className="mb-2 text-2xl font-bold text-gray-900">{selectedDoc.title}</h1>
              <div className="k12-markdown text-gray-800">
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                  components={{
                    a: ({ href, children, ...props }) => {
                      if (!href) {
                        return <a {...props}>{children}</a>;
                      }

                      const mappedHref = mapGitbookHref(href, basePath);
                      const isExternal = /^https?:\/\//.test(mappedHref);

                      if (isExternal) {
                        return (
                          <a href={mappedHref} target="_blank" rel="noreferrer" {...props}>
                            {children}
                          </a>
                        );
                      }

                      return (
                        <a href={mappedHref} {...props}>
                          {children}
                        </a>
                      );
                    },
                    h1: ({ children }) => {
                      const text = String(children);
                      const id = slugify(text);
                      return (
                        <h1 id={id} className="mt-6 scroll-mt-24 text-3xl font-bold text-gray-900">
                          {children}
                        </h1>
                      );
                    },
                    h2: ({ children }) => {
                      const text = String(children);
                      const id = slugify(text);
                      return (
                        <h2 id={id} className="mt-6 scroll-mt-24 text-2xl font-semibold text-gray-900">
                          {children}
                        </h2>
                      );
                    },
                    h3: ({ children }) => {
                      const text = String(children);
                      const id = slugify(text);
                      return (
                        <h3 id={id} className="mt-5 scroll-mt-24 text-xl font-semibold text-gray-900">
                          {children}
                        </h3>
                      );
                    },
                    img: ({ src, alt }) => {
                      if (!src) return null;
                      return (
                        <img
                          src={src}
                          alt={alt || "image"}
                          loading="lazy"
                          className="my-3 max-h-130 w-auto max-w-full rounded-lg border border-gray-200 object-contain"
                        />
                      );
                    },
                    table: ({ children }) => (
                      <div className="my-4 overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full border-collapse text-sm">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-800">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-gray-200 px-3 py-2 align-top">{children}</td>
                    ),
                    details: ({ children }) => (
                      <details className="my-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                        {children}
                      </details>
                    ),
                    summary: ({ children }) => (
                      <summary className="cursor-pointer font-semibold text-gray-900">{children}</summary>
                    ),
                  }}
                >
                  {normalizedContent}
                </Markdown>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">Không tìm thấy tài liệu.</p>
          )}
        </article>

        <aside className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:h-[calc(100vh-120px)] lg:overflow-y-auto">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Mục trong trang</h2>
          {!selectedDoc || selectedDoc.headings.length === 0 ? (
            <p className="text-xs text-gray-500">Trang này chưa có heading để điều hướng.</p>
          ) : (
            <div className="space-y-1">
              {selectedDoc.headings.map((heading) => (
                <a
                  key={`${heading.level}-${heading.id}-${heading.text}`}
                  href={`#${heading.id}`}
                  className="block rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  style={{ paddingLeft: `${8 + (heading.level - 1) * 10}px` }}
                >
                  {heading.text}
                </a>
              ))}
            </div>
          )}
        </aside>
      </div>
    </PageContainer>
  );
}
