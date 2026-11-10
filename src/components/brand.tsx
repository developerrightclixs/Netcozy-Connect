import Link from "next/link";
export function Brand({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link className="brand brand-reference" href={href}>
      <span className="brand-monogram" aria-hidden="true">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 18V6l12 12V6" />
        </svg>
      </span>
      <span>
        Netcozy <span className="brand-light">Connect</span>
      </span>
    </Link>
  );
}
export function NavIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dashboard: "M3 11l9-7 9 7v9H15v-6H9v6H3z",
    onboarding:
      "M20 21v-2a6 6 0 0 0-12 0v2M14 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 8v6M1 11h6",
    matches:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 21v-2a4 4 0 0 0-3-4M16 3a4 4 0 0 1 0 8",
    outreach: "M21 3 9 15M21 3l-7 18-5-6-6-5z",
    pipeline: "M3 8h18v12H3zM7 8V4h10v4M3 13h18M10 13v3h4v-3",
    properties: "M4 21V3h10v18M14 9h6v12M2 21h20M8 7h2M8 11h2M8 15h2",
    settings:
      "M4 4v6M4 14v6M12 4v10M12 18v2M20 4v2M20 10v10M1 10h6M9 14h6M17 6h6",
    admin: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6zM9 12l2 2 4-4",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.properties} />
    </svg>
  );
}
