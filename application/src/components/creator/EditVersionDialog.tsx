import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ModpackVersion, NewModpackVersionData } from '@/types/modpacks'; // Reusing NewModpackVersionData for partial type
import { updateModpackVersion, ApiError, UpdateModpackVersionData } from '@/services/userModpacks';
import { Label } from '@/components/ui/label';
import { toast } from "sonner";

interface EditVersionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  modpackVersion: ModpackVersion | null;
}

// Schema for editable fields. Version string is not editable here.
export const editVersionFormSchema = z.object({
  mcVersion: z.string().min(1, "Minecraft version is required").max(30),
  forgeVersion: z.string().max(30).optional().nullable(),
  changelog: z.string().min(10, "Changelog must be at least 10 characters"),
});

// This type will be used for form values
type EditVersionFormValues = z.infer<typeof editVersionFormSchema>;

export const EditVersionDialog: React.FC<EditVersionDialogProps> = ({ isOpen, onClose, onSuccess, modpackVersion }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, setError: setFormError } = useForm<EditVersionFormValues>({
    resolver: zodResolver(editVersionFormSchema),
    defaultValues: {
      mcVersion: '',
      forgeVersion: '',
      changelog: '',
    },
  });

  useEffect(() => {
    if (isOpen && modpackVersion) {
      reset({
        mcVersion: modpackVersion.mcVersion,
        forgeVersion: modpackVersion.forgeVersion || '',
        changelog: modpackVersion.changelog,
      });
      setServerError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, modpackVersion, reset]);

  const onSubmit = async (data: EditVersionFormValues) => {
    if (!modpackVersion) return;

    if (modpackVersion.status !== 'draft') {
      toast.error("Error", {
        description: "Only draft versions can be edited.",
      });
      onClose();
      return;
    }

    setIsSubmitting(true);
    setServerError(null);
    try {
      const updatePayload: UpdateModpackVersionData = {
        mcVersion: data.mcVersion,
        forgeVersion: data.forgeVersion || null,
        changelog: data.changelog,
      };

      await updateModpackVersion(modpackVersion.id, updatePayload);
      onSuccess();
      onClose();
      toast.success(`Version ${modpackVersion.version} has been updated successfully.`);
    } catch (error: any) {
      console.error("Update version error:", error);
      if (error instanceof ApiError) {
        if (error.field && Object.keys(errors).includes(error.field)) {
          setFormError(error.field as keyof EditVersionFormValues, { type: 'server', message: error.message });
        } else {
          setServerError(error.message || 'An unknown error occurred.');
        }
        toast.error(error.message);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
        toast.error('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !modpackVersion) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Edit Version: {modpackVersion.version}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          {serverError && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{serverError}</p>}

          <div>
            <Label htmlFor="edit-version-number">Version Number (Read-only)</Label>
            <Input id="edit-version-number" value={modpackVersion.version} readOnly disabled className="bg-gray-100" />
          </div>

          <div>
            <Label htmlFor="edit-version-mcVersion">Minecraft Version</Label>
            <Input id="edit-version-mcVersion" {...register('mcVersion')} />
            {errors.mcVersion && <p className="text-sm text-red-500 mt-1">{errors.mcVersion.message}</p>}
          </div>

          <div>
            <Label htmlFor="edit-version-forgeVersion">Forge Version (Optional)</Label>
            <Input id="edit-version-forgeVersion" {...register('forgeVersion')} />
            {errors.forgeVersion && <p className="text-sm text-red-500 mt-1">{errors.forgeVersion.message}</p>}
          </div>

          <div>
            <Label htmlFor="edit-version-changelog">Changelog</Label>
            <Textarea id="edit-version-changelog" {...register('changelog')} rows={6} />
            {errors.changelog && <p className="text-sm text-red-500 mt-1">{errors.changelog.message}</p>}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting || modpackVersion.status !== 'draft'}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
          {modpackVersion.status !== 'draft' && (
            <p className="text-xs text-center text-gray-500 pt-2">Only draft versions can be edited.</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};
