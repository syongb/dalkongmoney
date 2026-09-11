import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "우리 가계부",
  description: "부부가 함께 쓰는 단순한 가계부",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
