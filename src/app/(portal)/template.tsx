// Re-mounts on every navigation so each portal page slides in.
export default function PortalTemplate({children}: {children: React.ReactNode}) {
  return <div className="page-enter">{children}</div>;
}
