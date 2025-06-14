import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Assuming Select is available
import { NewModpackData, ModpackVisibilityEnum } from '@/types/modpacks';
import { createModpack, ApiError } from '@/services/userModpacks';
import { useToast } from "@/components/ui/use-toast";
import { Label } from '@/components/ui/label'; // Assuming Label is available

interface CreateModpackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const createModpackFormSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100),
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  publisherId: z.string().uuid('Invalid Publisher ID format'), // Basic UUID check
  shortDescription: z.string().max(200).optional(),
  description: z.string().optional(),
  iconUrl: z.string().url('Invalid Icon URL').min(1, "Icon URL is required"),
  bannerUrl: z.string().url('Invalid Banner URL').min(1, "Banner URL is required"),
  visibility: z.nativeEnum(ModpackVisibilityEnum),
  // Optional fields can be added here if desired
  // trailerUrl: z.string().url().optional().or(z.literal('')),
  // password: z.string().optional(),
});

type CreateModpackFormValues = z.infer<typeof createModpackFormSchema>;

export const CreateModpackDialog: React.FC<CreateModpackDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { control, handleSubmit, register, formState: { errors }, reset, setError: setFormError } = useForm<CreateModpackFormValues>({
    resolver: zodResolver(createModpackFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      publisherId: '', // User should input this for now
      shortDescription: '',
      description: '',
      iconUrl: '',
      bannerUrl: '',
      visibility: ModpackVisibilityEnum.PRIVATE,
    },
  });

  useEffect(() => {
    if (isOpen) {
      reset(); // Reset form when dialog opens
      setServerError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: CreateModpackFormValues) => {
    setIsSubmitting(true);
    setServerError(null);
    try {
      // Construct the data object for the API
      const newModpackPayload: NewModpackData = {
        name: data.name,
        slug: data.slug,
        publisherId: data.publisherId,
        shortDescription: data.shortDescription,
        description: data.description,
        iconUrl: data.iconUrl,
        bannerUrl: data.bannerUrl,
        visibility: data.visibility,
      };
      await createModpack(newModpackPayload);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Create modpack error:", error);
      if (error instanceof ApiError) {
        if (error.field && Object.keys(errors).includes(error.field)) {
          setFormError(error.field as keyof CreateModpackFormValues, { type: 'server', message: error.message });
        } else {
          setServerError(error.message || 'An unknown error occurred.');
        }
        toast({ title: "Creation Failed", description: error.message, variant: "destructive" });
      } else {
        setServerError('An unexpected error occurred. Please try again.');
        toast({ title: "Creation Failed", description: 'An unexpected error occurred.', variant: "destructive" });
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
          <DialogTitle>Create New Modpack</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          {serverError && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{serverError}</p>}

          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register('name')} placeholder="My Awesome Modpack" />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" {...register('slug')} placeholder="my-awesome-modpack" />
            {errors.slug && <p className="text-sm text-red-500 mt-1">{errors.slug.message}</p>}
          </div>

          <div>
            <Label htmlFor="publisherId">Publisher ID</Label>
            <Input id="publisherId" {...register('publisherId')} placeholder="Enter Publisher UUID" />
            {/* TODO: Replace with a dropdown fetching user's publishers */}
            {errors.publisherId && <p className="text-sm text-red-500 mt-1">{errors.publisherId.message}</p>}
          </div>

          <div>
            <Label htmlFor="iconUrl">Icon URL</Label>
            <Input id="iconUrl" type="url" {...register('iconUrl')} placeholder="https://example.com/icon.png" />
            {errors.iconUrl && <p className="text-sm text-red-500 mt-1">{errors.iconUrl.message}</p>}
          </div>

          <div>
            <Label htmlFor="bannerUrl">Banner URL</Label>
            <Input id="bannerUrl" type="url" {...register('bannerUrl')} placeholder="https://example.com/banner.png" />
            {errors.bannerUrl && <p className="text-sm text-red-500 mt-1">{errors.bannerUrl.message}</p>}
          </div>

          <div>
            <Label htmlFor="visibility">Visibility</Label>
            <Controller
              name="visibility"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ModpackVisibilityEnum.PRIVATE}>Private</SelectItem>
                    <SelectItem value={ModpackVisibilityEnum.PUBLIC}>Public</SelectItem>
                    <SelectItem value={ModpackVisibilityEnum.PATREON}>Patreon-only (if applicable)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.visibility && <p className="text-sm text-red-500 mt-1">{errors.visibility.message}</p>}
          </div>

          <div>
            <Label htmlFor="shortDescription">Short Description (Optional)</Label>
            <Textarea id="shortDescription" {...register('shortDescription')} placeholder="A brief summary of your modpack (max 200 chars)" />
            {errors.shortDescription && <p className="text-sm text-red-500 mt-1">{errors.shortDescription.message}</p>}
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea id="description" {...register('description')} placeholder="A full description of your modpack" rows={5} />
            {errors.description && <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Modpack'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
