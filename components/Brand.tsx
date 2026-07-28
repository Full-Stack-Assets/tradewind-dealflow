import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Tradewind DealFlow home">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        <strong>Tradewind</strong>
        {!compact && <small>DealFlow</small>}
      </span>
    </Link>
  );
}
