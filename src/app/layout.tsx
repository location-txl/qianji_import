import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "钱迹账簿整理台",
  description: "在本机将支付宝与微信账单整理为钱迹导入模板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
