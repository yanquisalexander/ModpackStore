import React from "react";
import { Route, Switch, Link, useLocation } from "wouter";
import ManageOrganizationsView from "@/views/admin/ManageOrganizationsView";
import { ManageUsersView } from "@/views/admin/ManageUsersView";
// import ManageModpacksView from "@/views/admin/ManageModpacksView"; // futuro
import { LucideUsers, LucideBuilding2, LucideArrowLeft } from "lucide-react";

const AdminSidebar = () => {
    return (
        <aside className="w-64 bg-neutral-900 border-r border-neutral-800 min-h-screen p-6 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-white mb-6">Panel de Admin</h2>
            <nav className="flex flex-col gap-2">
                <Link href="/admin/organizations" className="flex items-center gap-2 text-white hover:bg-neutral-800 rounded px-3 py-2">
                    <LucideBuilding2 size={18} /> Organizaciones
                </Link>
                <Link href="/admin/users" className="flex items-center gap-2 text-white hover:bg-neutral-800 rounded px-3 py-2">
                    <LucideUsers size={18} /> Usuarios
                </Link>
            </nav>
            <div className="mt-auto">
                <Link href="/" className="flex items-center gap-2 text-neutral-400 hover:text-white">
                    <LucideArrowLeft size={16} /> Volver al inicio
                </Link>
            </div>
        </aside>
    );
};

export const AdminLayout = () => {
    const [location] = useLocation();
    return (
        <div className="flex min-h-screen">
            <AdminSidebar />
            <main className="flex-1 bg-neutral-950 p-8 overflow-y-auto">
                <Switch>
                    <Route path="/admin/organizations" component={ManageOrganizationsView} />
                    <Route path="/admin/users" component={ManageUsersView} />
                    {/* <Route path="/admin/modpacks" component={ManageModpacksView} /> */}
                </Switch>
            </main>
        </div>
    );
};
