import type { Metadata } from "next";
import { headers } from "next/headers";
import { getWorkspace } from "@/lib/workspace";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceProvider";
import "./globals.css";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const ws = await getWorkspace();
  return { title: `${ws.name}: Your Daily Local Briefing`, description: `Your daily local briefing from ${ws.area}.`, openGraph: { title: ws.name, description: `Your daily local briefing from ${ws.area}.`, type: "website" } };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getWorkspace();
  const prefix = headers().get("x-gist-workspace") ? `/w/${workspace.slug}` : "";
  return <html lang="en"><body><WorkspaceProvider workspace={workspace} prefix={prefix}>{children}</WorkspaceProvider></body></html>;
}
