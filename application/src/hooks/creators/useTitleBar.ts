// hooks/useTitleBar.ts
import { useEffect } from "react";
import { LucidePencilRuler, Users } from "lucide-react";
import { useGlobalContext } from "@/stores/GlobalContext";

export const useTitleBar = (isOrgRoute: boolean, teams: any[], orgId?: string) => {
    const { setTitleBarState } = useGlobalContext();

    useEffect(() => {
        if (isOrgRoute) {

            const currentTeam = teams.find(team => team.id === orgId);
            setTitleBarState({
                title: `Administrando ${currentTeam?.publisherName}`,
                canGoBack: { history: true },
                opaque: true,
                icon: Users,
                customIconClassName: "text-green-500",
            });
        } else {
            setTitleBarState({
                title: "Creators Dashboard",
                canGoBack: true,
                opaque: true,
                icon: LucidePencilRuler,
                customIconClassName: "text-blue-500",
            });
        }
    }, [isOrgRoute, orgId, setTitleBarState]);
};