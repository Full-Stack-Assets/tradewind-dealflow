"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Brand } from "./Brand";
import { LocalDataProvider } from "./LocalDataProvider";

const navigation = [
  { href: "/dashboard", label: "Dashboard", glyph: "⌂" },
  { href: "/deal-lab", label: "Deal Lab", glyph: "◇" },
  { href: "/pipeline", label: "Pipeline", glyph: "↗" },
  { href: "/buyers", label: "Buyers", glyph: "◎" },
  { href: "/academy", label: "Academy", glyph: "▤" },
  { href: "/compliance", label: "Compliance", glyph: "✓" },
  { href: "/resources", label: "Resources", glyph: "⌘" },
  { href: "/deal-desk", label: "Deal Desk", glyph: "□" },
] as const;

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <LocalDataProvider>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="app-frame">
        <aside className="sidebar" aria-label="Primary">
          <div className="sidebar-brand">
            <Brand />
            <span className="product-kicker">New England Wholesale OS</span>
          </div>
          <nav className="sidebar-nav">
            {navigation.map((item) => (
              <Link
                className={pathname === item.href ? "nav-link active" : "nav-link"}
                href={item.href}
                key={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
              >
                <span className="nav-glyph" aria-hidden="true">
                  {item.glyph}
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="sidebar-foot">
            <span className="status-dot" aria-hidden="true" />
            <div>
              <strong>Local-first mode</strong>
              <small>No live outreach or backend sync</small>
            </div>
          </div>
        </aside>

        <div className="workspace-column">
          <header className="mobile-header">
            <Brand compact />
            <span className="mobile-mode">Local mode</span>
          </header>
          <nav className="mobile-nav" aria-label="Workspace">
            {navigation.map((item) => (
              <Link
                className={pathname === item.href ? "mobile-nav-link active" : "mobile-nav-link"}
                href={item.href}
                key={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <main id="main-content" className="workspace-main">
            {children}
          </main>
          <footer className="workspace-footer">
            <span>Tradewind DealFlow · Local-first release</span>
            <span>
              Educational and operational software—not legal, tax, financial,
              brokerage, appraisal, or investment advice.
            </span>
          </footer>
        </div>
      </div>
    </LocalDataProvider>
  );
}

export function WorkspaceHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="workspace-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="workspace-action">{action}</div>}
    </header>
  );
}

export function LocalDataNotice() {
  return (
    <aside className="local-notice" aria-label="Local data notice">
      <span className="local-notice-icon" aria-hidden="true">
        ◌
      </span>
      <p>
        <strong>Your records are stored only in this browser.</strong> Clearing
        browser storage can erase them. Export a backup from Pipeline after
        meaningful changes.
      </p>
    </aside>
  );
}

export function EmptyState({
  eyebrow = "Clean slate",
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-compass" aria-hidden="true">
        <span />
      </div>
      <div>
        <span className="mini-label">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{children}</p>
        {action}
      </div>
    </div>
  );
}

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warning" | "blocked";
  children: ReactNode;
}) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}
