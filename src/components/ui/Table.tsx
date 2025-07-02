import React from "react";

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

export const Table: React.FC<TableProps> = ({ children, className = "" }) => (
  <div className="overflow-x-auto">
    <table className={`w-full ${className}`}>{children}</table>
  </div>
);

export const TableHeader: React.FC<TableHeaderProps> = ({
  children,
  className = "",
}) => <thead className={`bg-gray-50 ${className}`}>{children}</thead>;

export const TableBody: React.FC<TableBodyProps> = ({
  children,
  className = "",
}) => (
  <tbody className={`divide-y divide-gray-200 ${className}`}>{children}</tbody>
);

export const TableRow: React.FC<TableRowProps> = ({
  children,
  className = "",
  onClick,
}) => (
  <tr
    className={`${
      onClick ? "cursor-pointer hover:bg-gray-50" : ""
    } ${className}`}
    onClick={onClick}
  >
    {children}
  </tr>
);

export const TableCell: React.FC<TableCellProps> = ({
  children,
  className = "",
  align = "left",
}) => {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <td className={`py-3 px-4 ${alignClasses[align]} ${className}`}>
      {children}
    </td>
  );
};

export const TableHeaderCell: React.FC<TableCellProps> = ({
  children,
  className = "",
  align = "left",
}) => {
  const alignClasses = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };

  return (
    <th
      className={`py-3 px-4 text-sm font-medium text-gray-700 ${alignClasses[align]} ${className}`}
    >
      {children}
    </th>
  );
};
