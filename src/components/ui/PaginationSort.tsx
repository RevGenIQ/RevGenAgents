"use client";

import React, { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";

export interface SortOption {
  value: string;
  label: string;
}

export interface UsePaginationOptions<T> {
  items: T[];
  pageSize?: number;
  initialSortKey?: string;
  sortFn?: (items: T[], sortKey: string) => T[];
}

export interface UsePaginationResult<T> {
  paginatedItems: T[];
  sortedItems: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  pageSize: number;
  sortKey: string;
  setSortKey: (key: string) => void;
  goToPage: (page: number) => void;
  setCurrentPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  canNext: boolean;
  canPrev: boolean;
  pageNumbers: number[];
}

/**
 * Reusable hook for sorting and 5-item pagination.
 * Resets to page 1 whenever items array changes or sortKey changes.
 */
export function usePagination<T>({
  items,
  pageSize = 5,
  initialSortKey = "",
  sortFn,
}: UsePaginationOptions<T>): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState(initialSortKey);

  // Reset to page 1 when the source list or filter count changes
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length, sortKey]);

  // Sort items
  const sortedItems = useMemo(() => {
    if (!sortFn || !sortKey) return items;
    return sortFn([...items], sortKey);
  }, [items, sortKey, sortFn]);

  const totalItems = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Ensure current page does not exceed bounds
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = totalItems === 0 ? 0 : (validPage - 1) * pageSize + 1;
  const endIndex = Math.min(validPage * pageSize, totalItems);

  const paginatedItems = useMemo(() => {
    const from = (validPage - 1) * pageSize;
    return sortedItems.slice(from, from + pageSize);
  }, [sortedItems, validPage, pageSize]);

  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = Math.max(1, validPage - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    const pages: number[] = [];
    for (let p = start; p <= end; p++) {
      pages.push(p);
    }
    return pages;
  }, [validPage, totalPages]);

  const goTo = (page: number) => setCurrentPage(Math.min(Math.max(1, page), totalPages));

  return {
    paginatedItems,
    sortedItems,
    currentPage: validPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    pageSize,
    sortKey,
    setSortKey,
    goToPage: goTo,
    setCurrentPage: goTo,
    nextPage: () => setCurrentPage((p) => Math.min(p + 1, totalPages)),
    prevPage: () => setCurrentPage((p) => Math.max(p - 1, 1)),
    canNext: validPage < totalPages,
    canPrev: validPage > 1,
    pageNumbers,
  };
}

/**
 * Reusable compact Pagination Controls (Showing 1-5 of N, Prev, compact page numbers, Next)
 */
export interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex?: number;
  endIndex?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  pageSize = 5,
  onPageChange,
  className = "",
}: PaginationControlsProps) {
  if (totalItems === 0) return null;

  const actualStart =
    typeof startIndex === "number"
      ? startIndex
      : totalItems === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;
  const actualEnd =
    typeof endIndex === "number"
      ? endIndex
      : Math.min(currentPage * pageSize, totalItems);

  const maxButtons = 5;
  let start = Math.max(1, currentPage - 2);
  let end = Math.min(totalPages, start + maxButtons - 1);
  if (end - start + 1 < maxButtons) {
    start = Math.max(1, end - maxButtons + 1);
  }
  const pages: number[] = [];
  for (let p = start; p <= end; p++) {
    pages.push(p);
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 pt-3 pb-1 border-t border-[var(--line)] text-xs text-[var(--ink3)] flex-wrap ${className}`}
    >
      <div className="font-mono text-[11px] text-[var(--ink2)]">
        Showing <span className="font-bold text-[var(--ink)]">{actualStart}-{actualEnd}</span> of{" "}
        <span className="font-bold text-[var(--ink)]">{totalItems}</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous Page"
          className="px-2.5 py-1 rounded-lg border border-[var(--line)] bg-[var(--bg-card)] text-[var(--ink2)] hover:text-[var(--ink)] hover:border-[var(--brand)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 font-medium text-[11px]"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Prev</span>
        </button>

        <div className="flex items-center gap-1">
          {pages.map((p) => {
            const isActive = p === currentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`w-7 h-7 rounded-lg text-xs font-mono font-semibold transition-all ${
                  isActive
                    ? "bg-brand text-white shadow-xs border border-brand"
                    : "border border-[var(--line)] bg-[var(--bg-card)] text-[var(--ink2)] hover:text-[var(--ink)] hover:border-[var(--line-brand)]"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next Page"
          className="px-2.5 py-1 rounded-lg border border-[var(--line)] bg-[var(--bg-card)] text-[var(--ink2)] hover:text-[var(--ink)] hover:border-[var(--brand)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 font-medium text-[11px]"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Reusable Sort Selector dropdown
 */
export interface SortSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SortOption[];
  className?: string;
  label?: string;
}

export function SortSelect({
  value,
  onChange,
  options,
  className = "",
  label = "Sort by",
}: SortSelectProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--ink3)] flex items-center gap-1">
        <ArrowUpDown className="w-3 h-3 text-[var(--brand)]" />
        {label}:
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-[var(--bg-card)] border border-[var(--line)] text-[var(--ink)] hover:border-[var(--brand)] focus:outline-hidden focus:border-[var(--brand)] transition-colors cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
