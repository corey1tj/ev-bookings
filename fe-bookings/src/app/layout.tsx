import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Future Energy | Book EV Charging",
  description: "Reserve your EV charging session at Future Energy locations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <a href="/" className="text-lg font-semibold">
              Future Energy
            </a>
            <nav className="flex gap-4 text-sm">
              <a href="/sites" className="hover:underline">
                Locations
              </a>
              <a href="/my-bookings" className="hover:underline">
                My Bookings
              </a>
              <a href="/admin" className="hover:underline">
                Admin
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
