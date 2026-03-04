import { Link } from "wouter";
import { ArrowLeft, Mic } from "lucide-react";

export function LegalLayout({ title, lastUpdated, children }: { title: string; lastUpdated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-900 hover:text-amber-500 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <Mic className="text-white w-4 h-4" />
              </div>
              <span className="font-bold text-lg">ScribeAI</span>
            </div>
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2" data-testid="legal-title">{title}</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: {lastUpdated}</p>
        <div className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-600 prose-li:text-gray-600 prose-strong:text-gray-900 prose-a:text-amber-500 hover:prose-a:text-amber-600">
          {children}
        </div>
      </main>

      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} ScribeAI. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy-policy" className="hover:text-amber-500">Privacy Policy</Link>
            <Link href="/terms-of-use" className="hover:text-amber-500">Terms of Use</Link>
            <Link href="/terms-and-conditions" className="hover:text-amber-500">Ts&Cs</Link>
            <Link href="/paia-manual" className="hover:text-amber-500">PAIA Manual</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
