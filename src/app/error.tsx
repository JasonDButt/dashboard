"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p className="font-medium">Something went wrong.</p>
      <p className="mt-1">{error.message}</p>
      <div className="mt-3 flex gap-3">
        <button onClick={reset} className="underline">
          Try again
        </button>
        <Link href="/" className="underline">
          Back to projects
        </Link>
      </div>
    </div>
  );
}
