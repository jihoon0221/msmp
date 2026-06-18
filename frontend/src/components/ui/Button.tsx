import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
  }
>;

const variants: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-500 shadow-sm",
  secondary: "bg-slate-800 text-white hover:bg-slate-700 shadow-sm",
  danger: "bg-rose-500 text-white hover:bg-rose-400 shadow-sm",
  ghost: "bg-slate-800 text-slate-100 hover:bg-slate-700",
};

export function Button({ children, className = "", variant = "primary", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

