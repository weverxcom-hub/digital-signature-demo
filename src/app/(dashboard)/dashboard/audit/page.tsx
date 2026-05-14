import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>Last 200 events.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {logs.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No events recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Entity</th>
                  <th className="px-4 py-2">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={badgeForAction(log.action)}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-medium">{log.entityType}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {log.entityId}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {log.user?.name || log.user?.email || (
                        <span className="text-slate-400">system</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function badgeForAction(action: string) {
  switch (action) {
    case "SIGN":
      return "success" as const;
    case "SIGN_REVOKE":
      return "danger" as const;
    case "DELETE":
      return "danger" as const;
    case "CREATE":
      return "info" as const;
    case "PROFILE_UPDATE":
      return "warning" as const;
    case "LOGIN":
      return "default" as const;
    default:
      return "default" as const;
  }
}
