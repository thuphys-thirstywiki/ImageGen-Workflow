import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ImageGen Workflow",
  description: "Prompt → 生图 → VLM 评审 → 选方案再迭代",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full overflow-hidden antialiased">{children}</body>
    </html>
  );
}
