import type { Metadata } from "next";
import { cookies } from "next/headers";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist/700.css";
import "react-day-picker/style.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "STRIDE | Work, with context",
  description:
    "A read-only, evidence-backed view of shared project progress. Open-source-ready reference with illustrative data.",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme =
    (await cookies()).get("stride-theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang="en">
      <body data-theme={theme}>{children}</body>
    </html>
  );
}
