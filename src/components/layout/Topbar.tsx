interface TopbarProps { title: string; }

export default function Topbar({ title }: TopbarProps) {
  return (
    <header className="app-topbar">
      <div>
        <div className="topbar-context">ROBOT CENTER</div>
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-actions">
        <label className="topbar-search">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input type="text" placeholder="Pesquisar no sistema" aria-label="Pesquisar no sistema" />
          <span>⌘ K</span>
        </label>

        <div className="topbar-divider" />
        <div className="topbar-user">
          <span className="topbar-avatar">MS</span>
          <span className="topbar-user-copy">
            <strong>Marcos Souza</strong>
            <small>Administrador</small>
          </span>
        </div>
      </div>
    </header>
  );
}
