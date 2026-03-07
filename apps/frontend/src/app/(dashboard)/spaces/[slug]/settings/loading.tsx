export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="mb-6 h-9 w-48 animate-pulse rounded bg-muted" />
      <div className="space-y-6">
        <div className="h-64 animate-pulse rounded-lg border bg-muted/50" />
        <div className="h-48 animate-pulse rounded-lg border bg-muted/50" />
      </div>
    </div>
  );
}
