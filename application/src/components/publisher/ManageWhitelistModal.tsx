import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    LucideLoader,
    LucideUserPlus,
    LucideTrash2,
    LucideDownload,
    LucideAlertTriangle,
    LucideUsers,
    LucideX
} from 'lucide-react';
import { toast } from 'sonner';
import { whitelistService } from '@/services/whitelist.service';
import { WhitelistUser, WhitelistStats } from '@/types/whitelist';

interface ManageWhitelistModalProps {
    isOpen: boolean;
    onClose: () => void;
    modpackId: string;
    modpackName: string;
    accessToken: string;
}

export const ManageWhitelistModal: React.FC<ManageWhitelistModalProps> = ({
    isOpen,
    onClose,
    modpackId,
    modpackName,
    accessToken
}) => {
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<WhitelistUser[]>([]);
    const [stats, setStats] = useState<WhitelistStats | null>(null);
    const [newUserInput, setNewUserInput] = useState('');
    const [notes, setNotes] = useState('');
    const [addingUser, setAddingUser] = useState(false);
    const [removingUserId, setRemovingUserId] = useState<string | null>(null);
    const [showClearDialog, setShowClearDialog] = useState(false);

    useEffect(() => {
        if (isOpen && modpackId && accessToken) {
            loadWhitelist();
        }
    }, [isOpen, modpackId, accessToken]);

    const loadWhitelist = async () => {
        setLoading(true);
        try {
            const [usersData, statsData] = await Promise.all([
                whitelistService.getWhitelistedUsers(modpackId, accessToken),
                whitelistService.getWhitelistStats(modpackId, accessToken)
            ]);
            setUsers(usersData);
            setStats(statsData);
        } catch (error) {
            console.error('Error loading whitelist:', error);
            toast.error('Failed to load whitelist data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = async () => {
        if (!newUserInput.trim()) {
            toast.error('Please enter a Discord username');
            return;
        }

        // Check if we've reached the limit
        if (stats && stats.remainingSlots <= 0) {
            toast.error('Whitelist is full', {
                description: `Maximum of ${stats.maxAllowed} users allowed`
            });
            return;
        }

        setAddingUser(true);
        try {
            await whitelistService.addToWhitelist(
                modpackId,
                {
                    discordUsername: newUserInput.trim(),
                    notes: notes.trim() || undefined
                },
                accessToken
            );
            
            toast.success('User added to whitelist');
            setNewUserInput('');
            setNotes('');
            await loadWhitelist();
        } catch (error: any) {
            console.error('Error adding user to whitelist:', error);
            const message = error.message || 'Failed to add user to whitelist';
            
            if (message.includes('not found')) {
                toast.error('User not found', {
                    description: 'No user found with that Discord username'
                });
            } else if (message.includes('already')) {
                toast.error('User already in whitelist');
            } else if (message.includes('limit')) {
                toast.error('Whitelist limit reached');
            } else {
                toast.error('Failed to add user', {
                    description: message
                });
            }
        } finally {
            setAddingUser(false);
        }
    };

    const handleRemoveUser = async (userId: string) => {
        setRemovingUserId(userId);
        try {
            await whitelistService.removeFromWhitelist(modpackId, userId, accessToken);
            toast.success('User removed from whitelist');
            await loadWhitelist();
        } catch (error) {
            console.error('Error removing user from whitelist:', error);
            toast.error('Failed to remove user from whitelist');
        } finally {
            setRemovingUserId(null);
        }
    };

    const handleClearWhitelist = async () => {
        try {
            const count = await whitelistService.clearWhitelist(modpackId, accessToken);
            toast.success(`Removed ${count} users from whitelist`);
            setShowClearDialog(false);
            await loadWhitelist();
        } catch (error) {
            console.error('Error clearing whitelist:', error);
            toast.error('Failed to clear whitelist');
        }
    };

    const handleExport = async () => {
        try {
            const exportData = await whitelistService.exportWhitelist(modpackId, accessToken);
            
            // Convert to CSV
            const csvContent = [
                ['Username', 'Discord ID', 'Added At', 'Added By', 'Notes'],
                ...exportData.users.map(u => [
                    u.username,
                    u.discordId || '',
                    new Date(u.addedAt).toISOString(),
                    u.addedBy,
                    u.notes || ''
                ])
            ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

            // Download file
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `whitelist-${modpackName}-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success('Whitelist exported successfully');
        } catch (error) {
            console.error('Error exporting whitelist:', error);
            toast.error('Failed to export whitelist');
        }
    };

    const usagePercentage = stats 
        ? (stats.totalWhitelisted / stats.maxAllowed) * 100
        : 0;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <LucideUsers className="h-5 w-5" />
                            Manage Whitelist
                        </DialogTitle>
                        <DialogDescription>
                            Manage access for "{modpackName}"
                        </DialogDescription>
                    </DialogHeader>

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <LucideLoader className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="space-y-4 flex-1 overflow-y-auto">
                            {/* Stats Card */}
                            {stats && (
                                <Alert>
                                    <LucideUsers className="h-4 w-4" />
                                    <AlertDescription>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <span className="font-semibold">{stats.totalWhitelisted}</span> of{' '}
                                                <span className="font-semibold">{stats.maxAllowed}</span> slots used
                                            </div>
                                            <Badge variant={stats.remainingSlots === 0 ? 'destructive' : 'default'}>
                                                {stats.remainingSlots} remaining
                                            </Badge>
                                        </div>
                                        {stats.remainingSlots === 0 && (
                                            <p className="text-xs text-destructive mt-2">
                                                Whitelist is full. Upgrade your plan or remove users to add more.
                                            </p>
                                        )}
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Add User Form */}
                            <div className="space-y-3 p-4 border rounded-lg">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <LucideUserPlus className="h-4 w-4" />
                                    Add User to Whitelist
                                </h3>
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-sm text-muted-foreground">
                                            Discord Username
                                        </label>
                                        <Input
                                            placeholder="username#1234"
                                            value={newUserInput}
                                            onChange={(e) => setNewUserInput(e.target.value)}
                                            disabled={addingUser || (stats?.remainingSlots === 0)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-muted-foreground">
                                            Notes (optional)
                                        </label>
                                        <Input
                                            placeholder="VIP member, beta tester, etc."
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            disabled={addingUser || (stats?.remainingSlots === 0)}
                                        />
                                    </div>
                                    <Button
                                        onClick={handleAddUser}
                                        disabled={addingUser || !newUserInput.trim() || (stats?.remainingSlots === 0)}
                                        className="w-full"
                                    >
                                        {addingUser ? (
                                            <>
                                                <LucideLoader className="h-4 w-4 mr-2 animate-spin" />
                                                Adding...
                                            </>
                                        ) : (
                                            <>
                                                <LucideUserPlus className="h-4 w-4 mr-2" />
                                                Add User
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Users List */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-semibold">Whitelisted Users ({users.length})</h3>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleExport}
                                            disabled={users.length === 0}
                                        >
                                            <LucideDownload className="h-4 w-4 mr-1" />
                                            Export CSV
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => setShowClearDialog(true)}
                                            disabled={users.length === 0}
                                        >
                                            <LucideX className="h-4 w-4 mr-1" />
                                            Clear All
                                        </Button>
                                    </div>
                                </div>

                                {users.length === 0 ? (
                                    <Alert>
                                        <LucideAlertTriangle className="h-4 w-4" />
                                        <AlertDescription>
                                            No users in whitelist yet. Add users above to grant access.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <div className="border rounded-lg">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Username</TableHead>
                                                    <TableHead>Discord ID</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {users.map((user) => (
                                                    <TableRow key={user.id}>
                                                        <TableCell className="flex items-center gap-2">
                                                            {user.avatarUrl && (
                                                                <img
                                                                    src={user.avatarUrl}
                                                                    alt={user.username}
                                                                    className="h-8 w-8 rounded-full"
                                                                />
                                                            )}
                                                            <span className="font-medium">{user.username}</span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <code className="text-xs">{user.discordId || 'N/A'}</code>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleRemoveUser(user.id)}
                                                                disabled={removingUserId === user.id}
                                                            >
                                                                {removingUserId === user.id ? (
                                                                    <LucideLoader className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <LucideTrash2 className="h-4 w-4 text-destructive" />
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Clear Confirmation Dialog */}
            <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Clear Entire Whitelist?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove all {users.length} users from the whitelist.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearWhitelist} className="bg-destructive">
                            Clear All
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
