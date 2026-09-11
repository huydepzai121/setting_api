import type { ReactNode } from "react";

/**
 * A checkbox or radio input, visually hidden but kept in the accessibility
 * tree and natively focusable/operable, paired with a styled visible label
 * (spec "Keyboard-only operation" — native inputs give correct semantics
 * and keyboard behavior, including radio-group arrow-key navigation, for
 * free; no ARIA re-implementation needed).
 */
export function Choice({
  type,
  name,
  id,
  checked,
  onChange,
  onBlur,
  label,
  className,
  describedBy,
}: {
  type: "checkbox" | "radio";
  name?: string;
  id: string;
  checked: boolean;
  onChange: () => void;
  onBlur?: () => void;
  label: ReactNode;
  className?: string;
  describedBy?: string;
}) {
  return (
    <span className={`sk-choice${className ? ` ${className}` : ""}`}>
      <input
        type={type}
        id={id}
        name={name}
        checked={checked}
        onChange={onChange}
        onBlur={onBlur}
        aria-describedby={describedBy}
        className="sk-choice__input"
      />
      <label htmlFor={id} className="sk-choice__box">
        {label}
      </label>
    </span>
  );
}
