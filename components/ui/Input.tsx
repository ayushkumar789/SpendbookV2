"use client";

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/helpers";

interface FieldWrapProps {
  label?: string;
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FieldWrap({ label, error, hint, children, className }: FieldWrapProps) {
  return (
    <div className={cn("group flex flex-col gap-1.5", className)}>
      {label ? (
        <label className="label-caps transition-colors group-focus-within:text-brand-deep">{label}</label>
      ) : null}
      {children}
      {error ? (
        <p className="animate-fade-in text-[13px] font-medium text-rose">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-ink3">{hint}</p>
      ) : null}
    </div>
  );
}

const fieldClasses =
  "w-full rounded-xl border border-line bg-card px-4 py-3 text-[15px] text-ink placeholder:text-ink3 shadow-none transition-all duration-200 focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, ...rest },
  ref
) {
  return (
    <FieldWrap label={label} error={error} hint={hint} className={className}>
      <input ref={ref} className={cn(fieldClasses, error && "border-rose focus:border-rose focus:ring-rose-soft")} {...rest} />
    </FieldWrap>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, ...rest },
  ref
) {
  return (
    <FieldWrap label={label} error={error} hint={hint} className={className}>
      <textarea
        ref={ref}
        className={cn(fieldClasses, "min-h-[96px] resize-y", error && "border-rose focus:border-rose focus:ring-rose-soft")}
        {...rest}
      />
    </FieldWrap>
  );
});
