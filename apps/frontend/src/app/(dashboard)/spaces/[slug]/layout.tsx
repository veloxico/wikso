// Space layout — sidebar is now handled by UnifiedSidebar in the parent dashboard layout.
// This layout is a pass-through that just renders children.
export default function SpaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
