import React from "react";

interface LoadingProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

export const Loading: React.FC<LoadingProps> = ({
  size = "md",
  className = "",
  text,
}) => {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center space-y-2">
        <div
          className={`${sizes[size]} border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin`}
        />
        {text && <p className="text-sm text-gray-600">{text}</p>}
      </div>
    </div>
  );
};
