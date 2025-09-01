import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
    LucideUsers, 
    LucideActivity, 
    LucideSettings, 
    LucideShield,
    LucideChevronRight
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';
import { ManageUsersView } from '@/views/admin/ManageUsersView';
import { AuditLogsView } from '@/views/admin/AuditLogsView';

interface AdminLayoutProps {
    children?: React.ReactNode;
}

// Navigation items for admin sidebar
const adminNavItems = [
    {
        path: '/admin/users',
        label: 'User Management',
        icon: LucideUsers,
        description: 'Manage users, roles, and permissions'
    },
    {
        path: '/admin/audit',
        label: 'Audit Logs',
        icon: LucideActivity,
        description: 'View system activity and security logs'
    },
    {
        path: '/admin/settings',
        label: 'Settings',
        icon: LucideSettings,
        description: 'System configuration and preferences',
        disabled: true // Not implemented yet
    }
];

// Sidebar Navigation Component
const AdminSidebar: React.FC = () => {
    const location = useLocation();
    const { session } = useAuthentication();

    return (
        <Card className="h-fit">
            <CardContent className="p-6">
                <div className="space-y-6">
                    {/* Admin Header */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <LucideShield className="h-5 w-5 text-primary" />
                            <h2 className="font-semibold">Admin Panel</h2>
                            <Badge variant="secondary" className="text-xs">
                                {session?.role?.toUpperCase()}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Administrative tools and system management
                        </p>
                    </div>

                    <Separator />

                    {/* Navigation */}
                    <nav className="space-y-2">
                        {adminNavItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            const isDisabled = item.disabled;

                            return (
                                <div key={item.path}>
                                    {isDisabled ? (
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 opacity-50 cursor-not-allowed">
                                            <Icon className="h-4 w-4" />
                                            <div className="flex-1">
                                                <div className="font-medium text-sm">{item.label}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {item.description}
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="text-xs">
                                                Soon
                                            </Badge>
                                        </div>
                                    ) : (
                                        <Link
                                            to={item.path}
                                            className={`
                                                flex items-center gap-3 p-3 rounded-lg transition-colors
                                                ${isActive 
                                                    ? 'bg-primary text-primary-foreground' 
                                                    : 'hover:bg-muted/50'
                                                }
                                            `}
                                        >
                                            <Icon className="h-4 w-4" />
                                            <div className="flex-1">
                                                <div className="font-medium text-sm">{item.label}</div>
                                                <div className={`text-xs ${
                                                    isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                                }`}>
                                                    {item.description}
                                                </div>
                                            </div>
                                            {isActive && <LucideChevronRight className="h-4 w-4" />}
                                        </Link>
                                    )}
                                </div>
                            );
                        })}
                    </nav>
                </div>
            </CardContent>
        </Card>
    );
};

// Main Admin Layout Component
export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
    const { session, loading } = useAuthentication();

    // Show loading while auth is being checked
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Loading...</p>
                </div>
            </div>
        );
    }

    // Check if user has admin privileges
    if (!session?.isAdmin?.()) {
        return (
            <div className="container mx-auto p-4 text-center">
                <Card>
                    <CardContent className="p-8">
                        <LucideShield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                        <p className="text-muted-foreground mb-4">
                            You don't have permission to access the admin panel.
                        </p>
                        <Button asChild>
                            <Link to="/">Return to Home</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar */}
                <div className="lg:col-span-1">
                    <AdminSidebar />
                </div>

                {/* Main Content */}
                <div className="lg:col-span-3">
                    {children || (
                        <Routes>
                            <Route path="/users" element={<ManageUsersView />} />
                            <Route path="/audit" element={<AuditLogsView />} />
                            <Route path="*" element={<ManageUsersView />} /> {/* Default to users */}
                        </Routes>
                    )}
                </div>
            </div>
        </div>
    );
};