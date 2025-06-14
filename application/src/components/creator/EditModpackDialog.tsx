import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Modpack, NewModpackData, ModpackVisibilityEnum } from '@/types/modpacks'; // Assuming NewModpackData can be used for partial updates
import { updateModpack, ApiError } from '@/services/userModpacks';
import { useToast } from "@/components/ui/use-toast";
import { Label } from '@/components/ui/label';

interface EditModpackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  modpack: Modpack | null; // Modpack to edit
}

// Schema for editable fields. Slug and publisherId are not editable here.
export const editModpackFormSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100),
  shortDescription: z.string().max(200).optional(),
  description: z.string().optional(),
  iconUrl: z.string().url('Invalid Icon URL').min(1, "Icon URL is required"),
  bannerUrl: z.string().url('Invalid Banner URL').min(1, "Banner URL is required"),
  visibility: z.nativeEnum(ModpackVisibilityEnum),
  trailerUrl: z.string().url('Invalid Trailer URL (must be empty or a valid URL)').optional().or(z.literal('')),
  password: z.string().optional(),
  // showUserAsPublisher: z.boolean().optional(), // Backend might not support updating this field or it has specific logic
});

type EditModpackFormValues = z.infer<typeof editModpackFormSchema>;

export const EditModpackDialog: React.FC<EditModpackDialogProps> = ({ isOpen, onClose, onSuccess, modpack }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit, register, formState: { errors }, reset, setError: setFormError } = useForm<EditModpackFormValues>({
    resolver: zodResolver(editModpackFormSchema),
    defaultValues: {
      name: '',
      shortDescription: '',
      description: '',
      iconUrl: '',
      bannerUrl: '',
      visibility: ModpackVisibilityEnum.PRIVATE,
      trailerUrl: '',
      password: '',
    },
  });

  useEffect(() => {
    if (isOpen && modpack) {
      reset({
        name: modpack.name,
        shortDescription: modpack.shortDescription || '',
        description: modpack.description || '',
        iconUrl: modpack.iconUrl || '',
        bannerUrl: modpack.bannerUrl || '',
        visibility: modpack.visibility as ModpackVisibilityEnum, // Cast if Modpack type uses string literals
        // trailerUrl: modpack.trailerUrl || '', // Assuming these fields exist on Modpack type
        // password: modpack.password || '',
      });
      setServerError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, modpack, reset]);

  const onSubmit = async (data: EditModpackFormValues) => {
    if (!modpack) return;

    setIsSubmitting(true);
    setServerError(null);
    try {
      // Construct the data object for the API, ensure only editable fields are sent
      // Backend handles non-updatable fields like slug, publisherId, status
      const updatePayload: Partial<NewModpackData> = {
        name: data.name,
        shortDescription: data.shortDescription,
        description: data.description,
        iconUrl: data.iconUrl,
        bannerUrl: data.bannerUrl,
        visibility: data.visibility,
        trailerUrl: data.trailerUrl,
        password: data.password,
      };

      await updateModpack(modpack.id, updatePayload);
      onSuccess();
      onClose();
      toast({ title: "Modpack Updated", description: "Your modpack has been updated successfully." });
    } catch (error: any) {
      console.error("Update modpack error:", error);
      if (error instanceof ApiError) {
        if (error.field && Object.keys(errors).includes(error.field)) {
          setFormError(error.field as keyof EditModpackFormValues, { type: 'server', message: error.message });
        } else {
          setServerError(error.message || 'An unknown error occurred.');
        }
        toast({ title: "Update Failed", description: error.message, variant: "destructive" });
      } else {
        setServerError('An unexpected error occurred. Please try again.');
        toast({ title: "Update Failed", description: 'An unexpected error occurred.', variant: "destructive" });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !modpack) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Edit Modpack: {modpack.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          {serverError && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{serverError}</p>}

          <div>
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" {...register('name')} />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          {/* Slug and Publisher ID are typically not editable or shown here as they are fixed */}
          <p className="text-sm text-gray-600">Slug: {modpack.slug} (read-only)</p>
          <p className="text-sm text-gray-600">Publisher ID: {modpack.publisherId} (read-only)</p>

          <div>
            <Label htmlFor="edit-iconUrl">Icon URL</Label>
            <Input id="edit-iconUrl" type="url" {...register('iconUrl')} />
            {errors.iconUrl && <p className="text-sm text-red-500 mt-1">{errors.iconUrl.message}</p>}
          </div>

          <div>
            <Label htmlFor="edit-bannerUrl">Banner URL</Label>
            <Input id="edit-bannerUrl" type="url" {...register('bannerUrl')} />
            {errors.bannerUrl && <p className="text-sm text-red-500 mt-1">{errors.bannerUrl.message}</p>}
          </div>

          <div>
            <Label htmlFor="edit-visibility">Visibility</Label>
            <Controller
              name="visibility"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ModpackVisibilityEnum.PRIVATE}>Private</SelectItem>
                    <SelectItem value={ModpackVisibilityEnum.PUBLIC}>Public</SelectItem>
                    <SelectItem value={ModpackVisibilityEnum.PATREON}>Patreon-only</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.visibility && <p className="text-sm text-red-500 mt-1">{errors.visibility.message}</p>}
          </div>

          <div>
            <Label htmlFor="edit-shortDescription">Short Description (Optional)</Label>
            <Textarea id="edit-shortDescription" {...register('shortDescription')} />
            {errors.shortDescription && <p className="text-sm text-red-500 mt-1">{errors.shortDescription.message}</p>}
          </div>

          <div>
            <Label htmlFor="edit-description">Description (Optional)</Label>
            <Textarea id="edit-description" {...register('description')} rows={5} />
            {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>}
          </div>

          <div>
            <Label htmlFor="edit-trailerUrl">Trailer URL (Optional)</Label>
            <Input id="edit-trailerUrl" type="url" {...register('trailerUrl')} placeholder="https://youtube.com/watch?v=example" />
            {errors.trailerUrl && <p className="text-sm text-red-500 mt-1">{errors.trailerUrl.message}</p>}
          </div>

          <div>
            <Label htmlFor="edit-password">Password (Optional)</Label>
            <Input id="edit-password" {...register('password')} placeholder="Leave empty if no password" />
            {errors.password && <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
