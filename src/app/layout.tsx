import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ForkedTales",
  description: "Publish and read branching visual-novel stories.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">{children}</div>
      </body>
    </html>
  );
}
