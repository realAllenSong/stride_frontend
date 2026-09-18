export function AccessNotice({ status }: { status: 401 | 403 | 503 }) {
  return (
    <main className="access-notice">
      <p className="eyebrow">STRIDE</p>
      <h1>
        {status === 503
          ? "Workspace temporarily unavailable"
          : status === 401
            ? "Sign in through your company gateway"
            : "This view is not shared with you"}
      </h1>
      <p>
        {status === 503
          ? "The data snapshot or deployment configuration could not be verified. Contact your workspace administrator."
          : status === 401
            ? "Open STRIDE from your company’s authenticated app portal. No work data has been loaded into this page."
            : "Ask your workspace administrator to review your project access. No restricted work data is shown."}
      </p>
      <Link className="button secondary" href="/">
        Try again
      </Link>
    </main>
  );
}
import Link from "next/link";
