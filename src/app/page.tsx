import { DashboardApp } from "@/components/dashboard-app";
import { cookies, headers } from "next/headers";
import { loadDashboard } from "@/lib/dashboard-service";
import { AccessError } from "@/lib/access";
import { AccessNotice } from "@/components/access-notice";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let data;
  try {
    data = await loadDashboard(await searchParams, await headers());
  } catch (error) {
    if (error instanceof AccessError)
      return <AccessNotice status={error.status} />;
    throw error;
  }
  const theme =
    (await cookies()).get("stride-theme")?.value === "dark" ? "dark" : "light";
  return <DashboardApp data={data} initialTheme={theme} />;
}
