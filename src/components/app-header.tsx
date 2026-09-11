export function AppHeader() {
  return (
    <div className="sk-header">
      <div className="sk-header__brand">
        <svg
          width="18"
          height="18"
          viewBox="0 0 20 20"
          fill="none"
          stroke="#56D98A"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 6l4 4-4 4" />
          <path d="M11 14h6" />
        </svg>
        <span>setting-key</span>
      </div>
      <div className="sk-header__note">
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <rect x="3" y="7" width="10" height="6.5" rx="1" />
          <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
        </svg>
        <span>Nothing is stored on the server</span>
      </div>
    </div>
  );
}
