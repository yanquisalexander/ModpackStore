import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
    LucideLoader, 
    LucideSearch, 
    LucideRefreshCw,
    LucideCalendar,
    LucideUser,
    LucideActivity
} from 'lucide-react';
import { useAuthentication } from '@/stores/AuthContext';

// Types
interface AuditLog {
    id: string;
    action: string;
    userId: string | null;
    targetUserId: string | null;
    targetResourceId: string | null;
    details: Record<string, any> | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    user?: {
        id: string;
        username: string;
        email: string;
    } | null;
}

interface PaginatedAuditLogs {
    logs: AuditLog[];
    total: number;
    page: number;
    totalPages: number;
}

// API Service
class AuditAPI {
    private static baseUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/v1/admin/audit`;

    static async fetchLogs(params: {
        page?: number;
        limit?: number;
        userId?: string;
        action?: string;
        startDate?: string;
        endDate?: string;
    } = {}, accessToken: string): Promise<PaginatedAuditLogs> {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== '') {
                queryParams.set(key, value.toString());
            }
        });

        const response = await fetch(`${this.baseUrl}?${queryParams}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch audit logs');
        }

        return response.json();
    }

    static async getActions(accessToken: string): Promise<{ actions: string[] }> {
        const response = await fetch(`${this.baseUrl}/actions`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch audit actions');
        }

        return response.json();
    }
}

// Action Badge Component
const ActionBadge: React.FC<{ action: string }> = ({ action }) => {
    const getBadgeVariant = (action: string) => {
        if (action.includes('delete') || action.includes('logout')) return 'destructive';
        if (action.includes('create') || action.includes('login')) return 'default';
        if (action.includes('update') || action.includes('change')) return 'secondary';
        return 'outline';
    };

    const formatAction = (action: string) => {
        return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    return (
        <Badge variant={getBadgeVariant(action) as any} className="text-xs">
            {formatAction(action)}
        </Badge>
    );
};

// Main Component
export const AuditLogsView: React.FC = () => {
    const [logsData, setLogsData] = useState<PaginatedAuditLogs>({
        logs: [],
        total: 0,
        page: 1,
        totalPages: 0
    });
    const [availableActions, setAvailableActions] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userIdFilter, setUserIdFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    
    const { toast } = useToast();
    const { session, sessionTokens } = useAuthentication();

    const loadLogs = async () => {
        if (!sessionTokens?.accessToken) {
            setError('No access token available');
            return;
        }

        setIsLoading(true);
        setError(null);
        
        try {
            const data = await AuditAPI.fetchLogs({
                page: currentPage,
                limit: 20,
                userId: userIdFilter || undefined,
                action: actionFilter || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            }, sessionTokens.accessToken);
            
            setLogsData(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load audit logs');
            toast({
                title: 'Error',
                description: 'Failed to load audit logs',
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const loadActions = async () => {
        if (!sessionTokens?.accessToken) {
            return;
        }

        try {
            const { actions } = await AuditAPI.getActions(sessionTokens.accessToken);
            setAvailableActions(actions);
        } catch (err) {
            console.error('Failed to load actions:', err);
        }
    };

    useEffect(() => {
        if (sessionTokens?.accessToken) {
            loadActions();
        }
    }, [sessionTokens?.accessToken]);

    useEffect(() => {
        if (sessionTokens?.accessToken) {
            loadLogs();
        }
    }, [currentPage, userIdFilter, actionFilter, startDate, endDate, sessionTokens?.accessToken]);

    const resetFilters = () => {
        setUserIdFilter('');
        setActionFilter('all');
        setStartDate('');
        setEndDate('');
        setCurrentPage(1);
    };

    const formatDetails = (details: Record<string, any> | null) => {
        if (!details) return null;
        
        return Object.entries(details).map(([key, value]) => (
            <div key={key} className="text-xs">
                <span className="font-medium">{key}:</span> {JSON.stringify(value)}
            </div>
        ));
    };

    // Prevent non-admin users from accessing this view
    if (!session?.isAdmin?.()) {
        return (
            <div className="container mx-auto p-4 text-center">
                <Alert>
                    <AlertDescription>
                        You do not have permission to access this page.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <LucideActivity className="h-6 w-6" />
                            <span>Audit Logs</span>
                        </div>
                        <Button variant="outline" onClick={resetFilters}>
                            Clear Filters
                        </Button>
                    </CardTitle>
                </CardHeader>
                
                <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">User ID</label>
                            <div className="relative">
                                <LucideUser className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Filter by user ID..."
                                    value={userIdFilter}
                                    onChange={(e) => setUserIdFilter(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-1">Action</label>
                            <Select value={actionFilter} onValueChange={setActionFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filter by action" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Actions</SelectItem>
                                    {availableActions.map((action) => (
                                        <SelectItem key={action} value={action}>
                                            {action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-1">Start Date</label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-1">End Date</label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        
                        <div className="flex items-end">
                            <Button variant="outline" onClick={loadLogs} disabled={isLoading} className="w-full">
                                <LucideRefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </Button>
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Audit Logs Table */}
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Timestamp</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Target</TableHead>
                                    <TableHead>IP Address</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            <LucideLoader className="h-6 w-6 animate-spin mx-auto" />
                                            <p className="mt-2 text-muted-foreground">Loading audit logs...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : logsData.logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No audit logs found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logsData.logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="font-mono text-sm">
                                                <div>{new Date(log.createdAt).toLocaleDateString()}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(log.createdAt).toLocaleTimeString()}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <ActionBadge action={log.action} />
                                            </TableCell>
                                            <TableCell>
                                                {log.user ? (
                                                    <div>
                                                        <div className="font-medium">{log.user.username}</div>
                                                        <div className="text-xs text-muted-foreground font-mono">
                                                            {log.user.id}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">Unknown</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {log.targetUserId ? (
                                                    <div className="font-mono text-xs">{log.targetUserId}</div>
                                                ) : log.targetResourceId ? (
                                                    <div className="font-mono text-xs">{log.targetResourceId}</div>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">
                                                {log.ipAddress || '-'}
                                            </TableCell>
                                            <TableCell>
                                                {log.details ? (
                                                    <div className="max-w-xs overflow-hidden">
                                                        {formatDetails(log.details)}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    {logsData.totalPages > 1 && (
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, logsData.total)} of {logsData.total} audit logs
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </Button>
                                <span className="flex items-center px-3 text-sm">
                                    Page {currentPage} of {logsData.totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(logsData.totalPages, p + 1))}
                                    disabled={currentPage === logsData.totalPages}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};