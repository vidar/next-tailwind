import "../../styles/global.css";
import { Metadata, Viewport } from "next";
import Link from "next/link";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "chessmoments.com",
  description: "Chess game analysis and visualization",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-background">
          <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo and Brand */}
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <svg
                    className="w-7 h-7 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {/* Knight chess piece simplified */}
                    <path d="M8 21h8" />
                    <path d="M7 21v-3l1-1" />
                    <path d="M17 21v-3l-1-1" />
                    <path d="M8 17h8" />
                    <path d="M7 10l1-1h8l1 1" />
                    <path d="M7 10v4l1 3h8l1-3v-4" />
                    <path d="M9 9l1-6 3 2 2-2v5" />
                    <circle cx="11" cy="5" r="1" />
                  </svg>
                </div>
                <span className="font-bold text-xl text-gray-900 dark:text-white">
                  chessmoments
                </span>
              </Link>

              {/* Navigation Links */}
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  href="/"
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 font-medium transition-colors"
                >
                  Home
                </Link>
                <Link
                  href="/import"
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 font-medium transition-colors"
                >
                  Import Games
                </Link>
                <Link
                  href="/analyzed_games"
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 font-medium transition-colors"
                >
                  Analyzed Games
                </Link>
                <Link
                  href="/tournaments"
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 font-medium transition-colors"
                >
                  Tournaments
                </Link>
              </nav>

              {/* Auth Buttons */}
              <div className="flex items-center gap-3 md:gap-4">
                <SignedOut>
                  <SignInButton>
                    <button className="text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 font-medium transition-colors text-sm md:text-base">
                      Sign In
                    </button>
                  </SignInButton>
                  <SignUpButton>
                    <button className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-sm px-3 md:px-4 h-9 transition-colors">
                      Sign Up
                    </button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <UserButton />
                </SignedIn>
              </div>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
    </ClerkProvider>
  );
}
