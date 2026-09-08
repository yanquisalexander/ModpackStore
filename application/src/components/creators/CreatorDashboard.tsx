import React, { useState, useEffect } from "react";
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
import { API_ENDPOINT } from "@/consts";

interface CreatorDashboardProps {
  teams: any[];
  accessToken?: string;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  subtext
}: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  subtext?: string;
}) {
  return (
    <Card className="border-border bg-card hover:border-border/80 transition-all">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn("size-11 rounded-lg flex items-center justify-center shrink-0", color)}>
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
          {subtext && <div className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{subtext}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export const CreatorDashboard: React.FC<CreatorDashboardProps> = ({ teams, accessToken }) => {
  const [totalModpacks, setTotalModpacks] = useState(0);
  const [totalVersions, setTotalVersions] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);
  const totalTeams = teams.length;
  const approvedTeams = teams.filter((t: any) => t.status === "approved").length;

  useEffect(() => {
    if (!accessToken || teams.length === 0) return;

    let isMounted = true;
    const fetchAllModpacks = async () => {
      setLoadingStats(true);
      let modpackCount = 0;
      let versionCount = 0;

      for (const team of teams) {
        try {
          const res = await fetch(`${API_ENDPOINT}/creators/${team.id}/modpacks`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (!res.ok) continue;
          const data = await res.json();
          // API returns an array directly: [...] or an object with { modpacks: [...] }
          const modpacks = Array.isArray(data) ? data : (data.modpacks || []);
          modpackCount += modpacks.length;

          // Check if versions are embedded, or fetch them if needed
          for (const mp of modpacks) {
            if (Array.isArray(mp.versions)) {
              versionCount += mp.versions.length;
            } else {
              try {
                const vRes = await fetch(`${API_ENDPOINT}/creators/${team.id}/modpacks/${mp.id}/versions`, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (vRes.ok) {
                  const vData = await vRes.json();
                  const versions = Array.isArray(vData) ? vData : (vData.versions || []);
                  versionCount += versions.length;
                }
              } catch {
                // Ignore version fetch errors per modpack
              }
            }
          }
        } catch {
          // Skip failed teams
        }
      }

      if (isMounted) {
        setTotalModpacks(modpackCount);
        setTotalVersions(versionCount);
        setLoadingStats(false);
      }
    };

    fetchAllModpacks();
    return () => {
      isMounted = false;
    };
  }, [teams, accessToken]);

  return (
    <div className="space-y-6">
      {/* Page Header (Consistent with Admin Layout) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <LucideSparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Panel de Creadores</h1>
            <p className="text-sm text-muted-foreground">Resumen global de tu actividad y proyectos</p>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={LucidePackage}
          label="Modpacks"
          value={loadingStats ? "..." : totalModpacks}
          color="bg-blue-500/10 text-blue-500"
          subtext="En todas tus organizaciones"
        />
        <StatCard
          icon={LucideLayers}
          label="Versiones"
          value={loadingStats ? "..." : totalVersions}
          color="bg-emerald-500/10 text-emerald-500"
          subtext="Lanzamientos registrados"
        />
        <StatCard
          icon={LucideUsers}
          label="Organizaciones"
          value={totalTeams}
          color="bg-amber-500/10 text-amber-500"
          subtext="Equipos a los que perteneces"
        />
        <StatCard
          icon={LucideSparkles}
          label="Aprobadas"
          value={approvedTeams}
          color="bg-purple-500/10 text-purple-500"
          subtext="Listas para publicar"
        />
      </div>

      {/* Teams Section */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LucideBuilding2 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-base">Tus Organizaciones</h2>
          </div>
          <Badge variant="outline" className="text-xs">
            {teams.length} {teams.length === 1 ? "Organización" : "Organizaciones"}
          </Badge>
        </div>

        {teams.length === 0 ? (
          <div className="p-12 text-center">
            <div className="size-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
              <LucideBuilding2 size={24} />
            </div>
            <h3 className="text-base font-medium mb-1">No tienes organizaciones</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Crea o únete a un equipo de creadores para empezar a publicar y gestionar modpacks.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {teams.map((team: any) => (
              <Link
                key={team.id}
                to={`/creators/org/${team.id}`}
                className="group flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors"
              >
                <div className="size-11 rounded-lg bg-muted/60 border border-border/80 flex items-center justify-center shrink-0 overflow-hidden">
                  {team.logoUrl ? (
                    <img src={team.logoUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <LucideBuilding2 size={20} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {team.displayName || team.publisherName || "Sin nombre"}
                    </span>
                    <Badge
                      variant={
                        team.status === "approved"
                          ? "default"
                          : team.status === "rejected"
                          ? "destructive"
                          : "secondary"
                      }
                      className="text-[10px] px-2 py-0.5"
                    >
                      {team.status === "approved"
                        ? "Activo"
                        : team.status === "rejected"
                        ? "Rechazado"
                        : "Pendiente"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {team.description || "Sin descripción proporcionada"}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  <span>Administrar</span>
                  <LucideArrowRight size={15} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
