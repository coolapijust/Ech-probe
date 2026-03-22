'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <h2 className="text-xl font-semibold text-foreground">出现了一些问题</h2>
          <p className="text-muted-foreground text-sm">{error.message}</p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
