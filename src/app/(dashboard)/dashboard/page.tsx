import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [archives, signed, signatories, audit] = await Promise.all([
    prisma.archive.count(),
    prisma.archiveSignature.count({ where: { revokedAt: null } }),
    prisma.signatory.count({ where: { deletedAt: null } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-slate-500">
            Quick view of your archives and signature activity.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/dashboard/archives">
            <Button>New archive</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Archives" value={archives} />
        <Stat label="Active signatures" value={signed} />
        <Stat label="Signatories" value={signatories} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Last 8 events from the audit log.</CardDescription>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {audit.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={badgeForAction(log.action)}>{log.action}</Badge>
                      <span className="font-medium">{log.entityType}</span>
                      <span className="break-all text-xs text-slate-400">
                        {log.entityId}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      by {log.user?.name || log.user?.email || "system"}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-slate-500">
                    {formatDateTime(log.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-semibold">{value}</p>
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
    default:
      return "default" as const;
  }
}
