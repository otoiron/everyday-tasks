import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "できたよ！TODOリスト",
  description: "自分でやることを管理できるキッズ向けTODOアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body style={{ margin: 0, padding: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
