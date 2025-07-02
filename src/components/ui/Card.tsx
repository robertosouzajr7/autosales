import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  border?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  padding = "md",
  hover = false,
  border = true,
}) => {
  const paddingClasses = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  const baseClasses = "bg-white rounded-lg shadow-sm";
  const borderClass = border ? "border border-gray-200" : "";
  const hoverClass = hover
    ? "hover:shadow-md transition-shadow duration-200"
    : "";

  return (
    <div
      className={`${baseClasses} ${borderClass} ${hoverClass} ${paddingClasses[padding]} ${className}`}
    >
      {children}
    </div>
  );
};
