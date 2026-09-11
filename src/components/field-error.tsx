/**
 * Inline, persistent validation error beneath a single field (spec
 * "Inline validation errors" — no modal, no auto-dismissing notification).
 * `role="alert"` makes this an implicit assertive live region, so a newly
 * appearing or changing message is announced without any extra wiring
 * (spec "Error announced").
 */
export function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}) {
  if (!message) {
    return null;
  }
  return (
    <span id={id} className="sk-error" role="alert">
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3.5" />
        <path d="M8 11h.01" />
      </svg>
      <span>{message}</span>
    </span>
  );
}
