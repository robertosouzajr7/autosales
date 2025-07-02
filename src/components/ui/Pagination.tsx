import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showPrevNext?: boolean;
  showFirstLast?: boolean;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  showPrevNext = true,
  showFirstLast = true,
  className = "",
}) => {
  const generatePages = () => {
    const pages = [];
    const showPages = 5; // Mostrar 5 páginas por vez

    let startPage = Math.max(1, currentPage - Math.floor(showPages / 2));
    let endPage = Math.min(totalPages, startPage + showPages - 1);

    if (endPage - startPage + 1 < showPages) {
      startPage = Math.max(1, endPage - showPages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  const pages = generatePages();

  return (
    <div className={`flex items-center justify-center space-x-1 ${className}`}>
      {showFirstLast && currentPage > 1 && (
        <Button variant="outline" size="sm" onClick={() => onPageChange(1)}>
          Primeira
        </Button>
      )}

      {showPrevNext && currentPage > 1 && (
        <Button
          variant="outline"
          size="sm"
          icon={ChevronLeft}
          onClick={() => onPageChange(currentPage - 1)}
        />
      )}

      {pages.map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? "primary" : "outline"}
          size="sm"
          onClick={() => onPageChange(page)}
        >
          {page}
        </Button>
      ))}

      {showPrevNext && currentPage < totalPages && (
        <Button
          children="Próxima"
          variant="outline"
          size="sm"
          icon={ChevronRight}
          onClick={() => onPageChange(currentPage + 1)}
        />
      )}

      {showFirstLast && currentPage < totalPages && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
        >
          Última
        </Button>
      )}
    </div>
  );
};
