"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Custom hook for debounced search input
 * @param delay - debounce delay in ms (default 300ms per NFR)
 */
export function useDebouncedSearch(delay = 300) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchTerm, delay]);

  return { searchTerm, setSearchTerm, debouncedTerm };
}

/**
 * Custom hook for pagination
 */
export function usePagination(totalItems: number, pageSize = 25) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp during render instead of resetting through an effect, so a shrinking
  // result set cannot leave the table on an out-of-range page.
  const safePage = Math.min(currentPage, totalPages);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages]
  );

  const nextPage = useCallback(() => goToPage(safePage + 1), [safePage, goToPage]);
  const prevPage = useCallback(() => goToPage(safePage - 1), [safePage, goToPage]);

  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  return {
    currentPage: safePage,
    totalPages,
    pageSize,
    startIndex,
    endIndex,
    goToPage,
    nextPage,
    prevPage,
    setCurrentPage,
  };
}
