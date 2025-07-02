export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface FormFieldProps {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type BadgeVariant = "default" | "success" | "warning" | "error" | "info";
export type ToastType = "success" | "error" | "warning" | "info";
