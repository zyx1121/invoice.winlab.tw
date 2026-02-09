import "@/app/globals.css";
import { Account } from "@/components/account";
import { AuthProvider } from "@/components/auth-context";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Instrument_Serif, Noto_Serif_TC } from "next/font/google";

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  variable: "--font-instrument-serif",
  subsets: ["latin"],
});

const notoSerifTC = Noto_Serif_TC({
  weight: ["400", "700"],
  variable: "--font-noto-serif-tc",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Invoice | Winlab",
  description: "Invoice management system for Winlab.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${instrumentSerif.variable} ${notoSerifTC.variable} antialiased select-none`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AuthProvider>
            <Header />
            <Account />
            {children}
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
