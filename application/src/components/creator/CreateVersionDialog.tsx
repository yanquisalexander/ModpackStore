import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NewModpackVersionData } from '@/types/modpacks';
import { createModpackVersion, ApiError } from '@/services/userModpacks'; // Assuming ApiError is exported
import { Label } from '@/components/ui/label';
import { toast } from "sonner";

interface CreateVersionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  modpackId: string;
  modpackName?: string; // Optional: to display in the dialog title
}

export const createVersionFormSchema = z.object({
  version: z.string().min(1, "Version string is required").max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Version can only contain letters, numbers, underscores, hyphens, and periods."),
  mcVersion: z.string().min(1, "Minecraft version is required").max(30),
  forgeVersion: z.string().max(30).optional().nullable(), // Allow empty string, then convert to null if needed by API
  changelog: z.string().min(10, "Changelog must be at least 10 characters"),
});

type CreateVersionFormValues = z.infer<typeof createVersionFormSchema>;

export const CreateVersionDialog: React.FC<CreateVersionDialogProps> = ({ isOpen, onClose, onSuccess, modpackId, modpackName }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, setError: setFormError } = useForm<CreateVersionFormValues>({
    resolver: zodResolver(createVersionFormSchema),
    defaultValues: {
      version: '',
      mcVersion: '',
      forgeVersion: '',
      changelog: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset();
      setServerError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: CreateVersionFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const versionPayload: NewModpackVersionData = {
        version: data.version,
        mcVersion: data.mcVersion,
        forgeVersion: data.forgeVersion || null, // Ensure null if empty string
        changelog: data.changelog,
      };
      await createModpackVersion(modpackId, versionPayload);
      onSuccess();
      onClose();
      toast.success(`Version ${data.version} has been created successfully for ${modpackName || 'the modpack'}.`);
    } catch (error: any) {
      console.error("Create version error:", error);
      if (error instanceof ApiError) {
        if (error.field && Object.keys(errors).includes(error.field)) {
          setFormError(error.field as keyof CreateVersionFormValues, { type: 'server', message: error.message });
        } else {
          setServerError(error.message || 'An unknown error occurred.');
        }
        toast.error("Creation Failed", {
          description: error.message,
        });
      } else {
        setServerError('An unexpected error occurred. Please try again.');
        toast.error("Creation Failed", {
          description: 'An unexpected error occurred.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create New Version {modpackName ? `for ${modpackName}` : ''}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          {serverError && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{serverError}</p>}

          <div>
            <Label htmlFor="version-number">Version Number</Label>
            <Input id="version-number" {...register('version')} placeholder="e.g., 1.0.0 or 1.0.0-beta" />
            {errors.version && <p className="text-sm text-red-500 mt-1">{errors.version.message}</p>}
          </div>

          <div>
            <Label htmlFor="version-mcVersion">Minecraft Version</Label>
            <Input id="version-mcVersion" {...register('mcVersion')} placeholder="e.g., 1.19.2" />
            {errors.mcVersion && <p className="text-sm text-red-500 mt-1">{errors.mcVersion.message}</p>}
          </div>

          <div>
            <Label htmlFor="version-forgeVersion">Forge Version (Optional)</Label>
            <Input id="version-forgeVersion" {...register('forgeVersion')} placeholder="e.g., 43.2.0" />
            {errors.forgeVersion && <p className="text-sm text-red-500 mt-1">{errors.forgeVersion.message}</p>}
          </div>

          <div>
            <Label htmlFor="version-changelog">Changelog</Label>
            <Textarea id="version-changelog" {...register('changelog')} placeholder="Describe the changes in this version..." rows={6} />
            {errors.changelog && <p className="text-sm text-red-500 mt-1">{errors.changelog.message}</p>}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Version'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
