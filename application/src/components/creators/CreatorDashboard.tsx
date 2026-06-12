import React from "react";
import { Link } from "react-router-dom";
import {
  LucidePackage,
  LucideLayers,
  LucideUsers,
  LucideSparkles,
  LucideArrowRight,
  LucideBuilding2,
  LucideClock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatorDashboardProps {
  teams: any[];
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-[#111119] ring-1 ring-white/[0.04] rounded-xl p-5 flex items-center gap-4">
      <div className={cn("size-10 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-xs text-white/40 uppercase tracking-wider mt-0.5">{label}</div>
      </div>
    </div>
  );
}

export const CreatorDashboard: React.FC<CreatorDashboardProps> = ({ teams }) => {
  const totalModpacks = 0;
  const totalVersions = 0;
  const totalTeams = teams.length;
  const approvedTeams = teams.filter((t: any) => t.status === "approved").length;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-white/40 mt-1">Resumen de tu actividad como creador</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="bg-[#111119] ring-1 ring-white/[0.04] rounded-xl p-12 text-center">
          <div className="size-12 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
            <LucideBuilding2 size={24} className="text-white/30" />
          </div>
          <h3 className="text-lg font-semibold text-white/70">No tienes equipos</h3>
          <p className="text-sm text-white/30 mt-1 max-w-sm mx-auto">
            Crea o únete a un equipo de creadores para empezar a publicar modpacks.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white/40 uppercase tracking-wider">Tus equipos</h2>
          <div className="grid gap-3">
            {teams.map((team: any) => (
              <Link
                key={team.id}
                to={`/creators/org/${team.id}`}
                className="group flex items-center gap-4 bg-[#111119] ring-1 ring-white/[0.04] hover:ring-white/[0.08] rounded-xl p-4 transition-all"
              >
                <div className="size-10 rounded-lg bg-gradient-to-br from-neutral-800 to-neutral-900 ring-1 ring-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {team.logoUrl ? (
                    <img src={team.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <LucideBuilding2 size={18} className="text-white/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">
                    {team.displayName || team.publisherName || "Sin nombre"}
                  </div>
                  <div className="text-xs text-white/30 truncate">
                    {team.description || "Sin descripción"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    team.status === "approved"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : team.status === "rejected"
                      ? "bg-red-500/10 text-red-400"
                      : "bg-amber-500/10 text-amber-400"
                  )}>
                    {team.status === "approved" ? "Activo" : team.status === "rejected" ? "Rechazado" : "Pendiente"}
                  </span>
                  <LucideArrowRight size={16} className="text-white/20 group-hover:text-white/50 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
