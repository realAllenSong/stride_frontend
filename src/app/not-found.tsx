import Link from "next/link";
export default function NotFound() {
  return (
    <main className="boot-screen">
      <h1>This page is not available.</h1>
      <Link className="button primary" href="/">
        Back to projects
      </Link>
    </main>
  );
}
