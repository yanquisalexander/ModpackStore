import React from "react";
import { Link } from "react-router-dom";
import {
  LucidePackage,
  LucideLayers,
  LucideUsers,
  LucideSparkles,
  LucideArrowRight,
  LucideBuilding2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CreatorDashboardProps {
  teams: any[];
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("size-9 rounded-md flex items-center justify-center shrink-0", color)}>
          <Icon size={16} />
        </div>
        <div>
          <div className="text-xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export const CreatorDashboard: React.FC<CreatorDashboardProps> = ({ teams }) => {
  const totalModpacks = 0;
  const totalVersions = 0;
  const totalTeams = teams.length;
  const approvedTeams = teams.filter((t: any) => t.status === "approved").length;

  return (
    <div className="space-y-6">
      <div className="space-y-0.5">
        <h1 className="text-lg font-semibold text-white">Dashboard</h1>
        <p className="text-sm text-neutral-500">Resumen de tu actividad como creador</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={LucidePackage}
          label="Modpacks"
          value={totalModpacks}
          color="bg-indigo-500/20 text-indigo-400"
        />
        <StatCard
          icon={LucideLayers}
          label="Versiones"
          value={totalVersions}
          color="bg-emerald-500/20 text-emerald-400"
        />
        <StatCard
          icon={LucideUsers}
          label="Equipos"
          value={totalTeams}
          color="bg-amber-500/20 text-amber-400"
        />
        <StatCard
          icon={LucideSparkles}
          label="Aprobados"
          value={approvedTeams}
          color="bg-purple-500/20 text-purple-400"
        />
      </div>

      {teams.length === 0 ? (
        <div className="bg-black/20 border border-white/[0.04] rounded-lg p-10 text-center">
          <div className="size-10 rounded-md bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
            <LucideBuilding2 size={18} className="text-neutral-500" />
          </div>
          <h3 className="text-sm font-semibold text-white/70">No tienes equipos</h3>
          <p className="text-xs text-neutral-600 mt-1 max-w-sm mx-auto">
            Crea o únete a un equipo de creadores para empezar a publicar modpacks.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-xs font-medium text-neutral-600 uppercase tracking-wider">Tus equipos</h2>
          <div className="space-y-1.5">
            {teams.map((team: any) => (
              <Link
                key={team.id}
                to={`/creators/org/${team.id}`}
                className="group flex items-center gap-3 bg-black/20 border border-white/[0.04] hover:border-white/10 rounded-lg p-3.5 transition-colors"
              >
                <div className="size-9 rounded-md bg-black/20 ring-1 ring-white/[0.04] flex items-center justify-center shrink-0 overflow-hidden">
                  {team.logoUrl ? (
                    <img src={team.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <LucideBuilding2 size={16} className="text-neutral-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {team.displayName || team.publisherName || "Sin nombre"}
                  </div>
                  <div className="text-xs text-neutral-600 truncate">
                    {team.description || "Sin descripción"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-md",
                    team.status === "approved"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : team.status === "rejected"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-amber-500/10 text-amber-400"
                  )}>
                    {team.status === "approved" ? "Activo" : team.status === "rejected" ? "Rechazado" : "Pendiente"}
                  </span>
                  <LucideArrowRight size={14} className="text-neutral-600 group-hover:text-neutral-400 transition-colors shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
