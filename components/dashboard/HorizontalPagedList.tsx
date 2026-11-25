'use client';

import React, { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type HorizontalPagedListProps<T> = {
  items: T[];
  renderPage: (items: T[], pageIndex: number) => ReactNode;
  pageSize?: number;
  className?: string;
  /** Server pagination: items already contain this page only. */
  pagination?: { page: number; total: number; onPageChange: (page: number) => void };
};

export function HorizontalPagedList<T>({
  items,
  renderPage,
  pageSize = 5,
  className = '',
  pagination,
}: HorizontalPagedListProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil((pagination?.total ?? items.length) / pageSize));
  const safePage = Math.min(pagination?.page ?? currentPage, totalPages);
  const pageItems = pagination ? items : items.slice((safePage - 1) * pageSize, safePage * pageSize);
  const changePage = pagination?.onPageChange ?? setCurrentPage;

  const visiblePages = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (page) =>
      totalPages <= 7 ||
      page === 1 ||
      page === totalPages ||
      Math.abs(page - safePage) <= 1,
  );

  return (
    <div className={className}>
      <div className="w-full">{renderPage(pageItems, safePage - 1)}</div>
      {pagination && pageItems.length > 0 && (
        <p className="border-t border-gray-100 px-5 py-3 text-center text-xs text-gray-500">
          Нийт {pagination.total} бүртгэл · {(safePage - 1) * pageSize + 1}–{(safePage - 1) * pageSize + pageItems.length}
        </p>
      )}

      {totalPages > 1 && (
        <nav
          className="flex min-h-16 flex-wrap items-center justify-center gap-2 border-t border-gray-100 px-4 py-3"
          aria-label="Хуудас сонгох"
        >
          <button
          
            type="button"
            onClick={() => changePage(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Өмнөх хуудас"
            title="Өмнөх хуудас"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          {visiblePages.map((page, index) => {
            const previousPage = visiblePages[index - 1];
            const hasGap = previousPage && page - previousPage > 1;

            return (
              <span key={page} className="contents">
                {hasGap && <span className="px-1 text-sm font-bold text-gray-400">...</span>}
                <button
                  type="button"
                  onClick={() => changePage(page)}
                  aria-current={safePage === page ? 'page' : undefined}
                  className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-black transition-colors ${
                    safePage === page
                      ? 'border-orange-600 bg-orange-600 text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              </span>
            );
          })}

          <button
            type="button"
            onClick={() => changePage(Math.min(totalPages, safePage + 1))}
            disabled={safePage === totalPages}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Дараагийн хуудас"
            title="Дараагийн хуудас"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </nav>
      )}
    </div>
  );
}
