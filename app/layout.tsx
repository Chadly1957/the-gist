import type { Metadata } from "next";
import Script from "next/script";
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
  const themeVars = {
    "--gist-primary": workspace.primaryColor,
    "--gist-secondary": workspace.secondaryColor,
  } as React.CSSProperties;
  return <html lang="en"><body style={themeVars}>
    {/* Meta Pixel ("The Gist", 1151230177367290): base code site-wide so ad
        clicks can be attributed to signups. The Lead event fires on /join
        signup success in app/join/page.tsx. Pixel ID is public by design
        (it ships in page source), so it is inlined rather than env-gated. */}
    <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '1151230177367290');fbq('track', 'PageView');`}</Script>
    <noscript><img height="1" width="1" style={{ display: "none" }} src="https://www.facebook.com/tr?id=1151230177367290&ev=PageView&noscript=1" alt="" /></noscript>
    <WorkspaceProvider workspace={workspace} prefix={prefix}>{children}</WorkspaceProvider></body></html>;
}
