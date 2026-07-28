import { WorkspaceShell } from "@/components/WorkspaceShell";

export default function AppWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
