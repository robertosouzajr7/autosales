// src/components/ui/Table.tsx
// ✅ VERSÃO CORRIGIDA COM SUBCOMPONENTES

import React from "react";

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
}

interface TableHeaderCellProps {
  children: React.ReactNode;
  className?: string;
}

// Componente principal
const Table: React.FC<TableProps> & {
  Header: React.FC<TableProps>;
  Body: React.FC<TableProps>;
  Row: React.FC<TableRowProps>;
  HeaderCell: React.FC<TableHeaderCellProps>;
  Cell: React.FC<TableCellProps>;
} = ({ children, className = "" }) => (
  <div className="overflow-x-auto">
    <table className={`min-w-full divide-y divide-gray-200 ${className}`}>
      {children}
    </table>
  </div>
);

// Subcomponentes
Table.Header = ({ children, className = "" }) => (
  <thead className={`bg-gray-50 ${className}`}>{children}</thead>
);

Table.Body = ({ children, className = "" }) => (
  <tbody className={`bg-white divide-y divide-gray-200 ${className}`}>
    {children}
  </tbody>
);

Table.Row = ({ children, className = "" }) => (
  <tr className={`hover:bg-gray-50 ${className}`}>{children}</tr>
);

Table.HeaderCell = ({ children, className = "" }) => (
  <th
    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}
  >
    {children}
  </th>
);

Table.Cell = ({ children, className = "" }) => (
  <td className={`px-6 py-4 whitespace-nowrap ${className}`}>{children}</td>
);

export { Table };
