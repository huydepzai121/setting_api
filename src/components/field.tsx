import type { ReactNode } from "react";
import { FieldError } from "./field-error";

/** A labeled field wrapper: label<->input association plus its persistent inline error. */
export function Field({
  label,
  htmlFor,
  error,
  errorId,
  children,
  headerExtra,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  errorId: string;
  children: ReactNode;
  headerExtra?: ReactNode;
}) {
  return (
    <div className="sk-field">
      <div className="sk-field__row">
        <label htmlFor={htmlFor} className="sk-label">
          {label}
        </label>
        {headerExtra}
      </div>
      {children}
      <FieldError id={errorId} message={error} />
    </div>
  );
}
