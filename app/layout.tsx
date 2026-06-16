import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Gist Decatur: Your Daily Local Briefing",
  description:
    "Stay in the know. The Gist Decatur delivers the stories that matter from around Decatur, straight to your inbox, every morning.",
  openGraph: {
    title: "The Gist Decatur",
    description: "Your daily local briefing from Decatur.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
