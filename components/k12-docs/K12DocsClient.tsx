"use client";

import { PageContainer } from "@/components/PageContainer";
import { cn } from "@/lib/utils";
import { ChevronRight, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

export interface K12ClientDocItem {
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
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [expandedLevelOne, setExpandedLevelOne] = useState<Record<string, boolean>>({});
  const [isMiniToc, setIsMiniToc] = useState(false);

  const selectedDoc = useMemo(() => {
    const effective = selectedSlug || defaultSlug;
    return documents.find((doc) => doc.slug === effective) || documents[0];
  }, [documents, selectedSlug, defaultSlug]);

  const selectedRootNodeId = useMemo(() => {
    const targetSlug = selectedDoc?.slug;
    if (!targetSlug) return null;

    const findRootBySlug = (nodes: K12ClientDocNode[], rootId: string | null): string | null => {
      for (const node of nodes) {
        const nextRootId = rootId ?? (!node.slug && node.children?.length ? node.id : null);

        if (node.slug === targetSlug) {
          return nextRootId;
        }

        if (node.children?.length) {
          const found = findRootBySlug(node.children, nextRootId);
          if (found) return found;
        }
      }

      return null;
    };

    return findRootBySlug(tree, null);
  }, [selectedDoc?.slug, tree]);

  useEffect(() => {
    const initial: Record<string, boolean> = {};

    tree.forEach((node) => {
      if (!node.slug && node.children && node.children.length > 0) {
        initial[node.id] = true;
      }
    });

    setExpandedLevelOne((prev) => ({ ...initial, ...prev }));
  }, [tree]);

  useEffect(() => {
    if (!selectedRootNodeId) return;
    setExpandedLevelOne((prev) => ({ ...prev, [selectedRootNodeId]: true }));
  }, [selectedRootNodeId]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return documents
      .filter((doc) => {
        return (
          doc.title.toLowerCase().includes(normalizedQuery) ||
          doc.content.toLowerCase().includes(normalizedQuery)
        );
      })
      .slice(0, 10);
  }, [documents, query]);

  const searchInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    if (showSearchResults) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSearchResults]);

  const normalizedContent = useMemo(() => {
    if (!selectedDoc) return "";
    return normalizeGitbookMarkdown(selectedDoc.content);
  }, [selectedDoc]);

  const heroImage = selectedDoc?.coverImageUrl || "";
  const heroTopic = selectedDoc?.topic || pageTitle;
  const heroExcerpt = selectedDoc?.excerpt || "";

  const renderTree = (nodes: K12ClientDocNode[], depth = 0) => {
    return nodes
      .map((node) => {
        const hasChildren = Boolean(node.children && node.children.length > 0);
        const isDoc = Boolean(node.slug);
        const renderedChildren = hasChildren ? renderTree(node.children as K12ClientDocNode[], depth + 1) : [];

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
                <span
                  className={cn(
                    isMiniToc ? "line-clamp-1 text-[11px] font-medium" : "line-clamp-2"
                  )}
                  title={node.title}
                >
                  {node.title}
                </span>
              </Link>
            ) : depth === 0 && hasChildren ? (
              <button
                type="button"
                onClick={() =>
                  setExpandedLevelOne((prev) => ({
                    ...prev,
                    [node.id]: !prev[node.id],
                  }))
                }
                className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-100"
                style={{ paddingLeft: `${8 + depth * 14}px` }}
              >
                <ChevronRight
                  className={cn(
                    "mr-1 h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform",
                    expandedLevelOne[node.id] ? "rotate-90" : "rotate-0"
                  )}
                />
                <span className="line-clamp-1" title={node.title}>{node.title}</span>
              </button>
            ) : (
              <div
                className="px-2 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
                style={{ paddingLeft: `${8 + depth * 14}px` }}
                title={node.title}
              >
                <span className={cn(isMiniToc ? "line-clamp-1 text-[11px]" : "line-clamp-2")}>{node.title}</span>
              </div>
            )}
            {depth === 0 && hasChildren && !expandedLevelOne[node.id] ? null : renderedChildren}
          </div>
        );
        })
        .filter(Boolean);
  };

  return (
    <PageContainer>
      {/* Custom Header with Title and Search */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-2">
          <div className="flex-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {pageTitle}
            </h1>
          </div>
          <div className="shrink-0 lg:w-80">
            <label className="sr-only" htmlFor="k12-doc-search">
              Tìm tài liệu
            </label>
            <div className="relative" ref={searchInputRef}>
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <input
                id="k12-doc-search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSearchResults(e.target.value.length > 0);
                }}
                onFocus={() => query.length > 0 && setShowSearchResults(true)}
                placeholder="Tìm theo tiêu đề hoặc nội dung"
                className="w-full rounded-md border border-gray-300 py-2 pl-8 pr-2 text-sm focus:border-[#a1001f] focus:outline-none"
              />
              
              {/* Search Results Dropdown */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="flex flex-col gap-y-1 p-2">
                    {searchResults.map((doc) => (
                      <Link
                        key={doc.slug}
                        href={`${basePath}?doc=${encodeURIComponent(doc.slug)}`}
                        onClick={() => setShowSearchResults(false)}
                        className="flex items-start gap-3 px-3 py-2 hover:bg-gray-50 transition-colors rounded-md text-sm border-b last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 line-clamp-2">
                            {doc.title}
                          </p>
                          <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                            {doc.content
                              .substring(0, 100)
                              .replace(/<[^>]+>/g, '')
                              .replace(/^#+\s/gm, '')
                              .replace(/[*_~`-]/g, '')
                              .trim()}...
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="grid grid-cols-1 gap-4 lg:[transition:grid-template-columns_320ms_ease]"
        style={{
          gridTemplateColumns: isMiniToc
            ? "120px minmax(0,1fr) 220px"
            : "300px minmax(0,1fr) 220px",
        }}
      >
        <aside
          className={cn(
            "overflow-x-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm",
            "lg:sticky lg:top-4",
            isMiniToc ? "lg:h-auto lg:overflow-hidden" : "lg:h-[calc(100vh-120px)] lg:overflow-y-auto"
          )}
        >
          <div className="mb-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Mục lục</h2>
              <button
                type="button"
                onClick={() => setIsMiniToc((prev) => !prev)}
                className="inline-flex items-center rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 transition-all duration-300 hover:bg-gray-50"
                title={isMiniToc ? "Mở rộng mục lục" : "Thu gọn mục lục"}
              >
                <span className="inline-flex transition-transform duration-300">
                  {isMiniToc ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
                </span>
              </button>
            </div>

          </div>
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-out",
              isMiniToc ? "max-h-0 opacity-0 -translate-y-1" : "max-h-500 opacity-100 translate-y-0"
            )}
          >
            <div className="space-y-1">{renderTree(tree)}</div>
          </div>
        </aside>

        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {selectedDoc ? (
            <>
              <div className="mb-5 overflow-hidden rounded-2xl border border-gray-200 bg-linear-to-br from-white to-gray-50 shadow-sm">
                <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="relative min-h-48 bg-gray-100">
                    {heroImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={heroImage}
                        alt={selectedDoc.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-48 items-end bg-linear-to-br from-[#a1001f] via-[#c41230] to-[#f2b705] p-5 text-white">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
                            {heroTopic}
                          </p>
                          <h1 className="mt-2 text-2xl font-black leading-tight">
                            {selectedDoc.title}
                          </h1>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col justify-center p-5 lg:p-6">
                    <h1 className="text-2xl font-black text-gray-900 lg:text-3xl">{selectedDoc.title}</h1>
                    {heroExcerpt && <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600">{heroExcerpt}</p>}
                  </div>
                </div>
              </div>
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
