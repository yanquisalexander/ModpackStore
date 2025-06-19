import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from "sonner";
import { ModpackVisibilityEnum } from '@/types/modpacks.d';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createModpack, ApiError } from '@/services/userModpacks';
import { Textarea } from "../ui/textarea";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage
} from "../ui/form";

interface CreateModpackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organizationId?: string;
}

const createModpackFormSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100),
  publisherId: z.string().uuid('Invalid Publisher ID format'),
  shortDescription: z.string().max(200).optional(),
  description: z.string().optional(),
  iconUrl: z.string().url('Invalid Icon URL').min(1, "Icon URL is required"),
  bannerUrl: z.string().url('Invalid Banner URL').min(1, "Banner URL is required"),
  visibility: z.nativeEnum(ModpackVisibilityEnum),
});

type CreateModpackFormValues = z.infer<typeof createModpackFormSchema>;

export const CreateModpackDialog: React.FC<CreateModpackDialogProps> = ({ isOpen, onClose, onSuccess, organizationId }) => {
  const [serverError, setServerError] = useState<string | null>(null);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const form = useForm<CreateModpackFormValues>({
    resolver: zodResolver(createModpackFormSchema),
    defaultValues: {
      name: '',
      publisherId: '',
      shortDescription: '',
      description: '',
      iconUrl: '',
      bannerUrl: '',
      visibility: ModpackVisibilityEnum.PRIVATE,
    },
  });
  const { handleSubmit, reset, setError: setFormError, control, formState: { isSubmitting } } = form;

  useEffect(() => {
    if (iconFile) {
      const url = URL.createObjectURL(iconFile);
      setIconPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setIconPreview(null);
    }
  }, [iconFile]);
  useEffect(() => {
    if (bannerFile) {
      const url = URL.createObjectURL(bannerFile);
      setBannerPreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setBannerPreview(null);
    }
  }, [bannerFile]);

  useEffect(() => {
    if (isOpen) {
      reset();
      setServerError(null);
      setIconFile(null);
      setBannerFile(null);
      setIconPreview(null);
      setBannerPreview(null);
      if (organizationId) {
        reset({ publisherId: organizationId });
      }
    }
  }, [isOpen, reset, organizationId]);

  const onSubmit = async (data: CreateModpackFormValues) => {
    setServerError(null);
    try {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('publisherId', organizationId || data.publisherId);
      if (data.shortDescription) formData.append('shortDescription', data.shortDescription);
      if (data.description) formData.append('description', data.description);
      formData.append('visibility', data.visibility);
      if (iconFile) formData.append('icon', iconFile);
      if (bannerFile) formData.append('banner', bannerFile);
      if (!iconFile && data.iconUrl) formData.append('iconUrl', data.iconUrl);
      if (!bannerFile && data.bannerUrl) formData.append('bannerUrl', data.bannerUrl);
      await createModpack(formData as any);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Create modpack error:", error);
      if (error instanceof ApiError) {
        if (error.field && typeof error.field === 'string') {
          setFormError(error.field as keyof CreateModpackFormValues, { type: 'server', message: error.message });
        } else {
          setServerError(error.message || 'An unknown error occurred.');
        }
        toast.error("Creation Failed", { description: error.message });
      } else {
        setServerError('An unexpected error occurred. Please try again.');
        toast.error("Creation Failed", { description: 'An unexpected error occurred.' });
      }
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[525px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Modpack</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            {serverError && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md">{serverError}</p>}

            <FormField name="name" control={control} render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="My Awesome Modpack" autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {!organizationId && (
              <FormField name="publisherId" control={control} render={({ field }) => (
                <FormItem>
                  <FormLabel>Publisher ID</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter Publisher UUID" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <FormItem>
              <FormLabel>Icono</FormLabel>
              <FormControl>
                <Input id="iconFile" type="file" accept="image/*" onChange={e => {
                  const file = e.target.files?.[0] || null;
                  setIconFile(file);
                }} />
              </FormControl>
              {iconPreview && <img src={iconPreview} alt="Icon preview" className="mt-2 w-16 h-16 object-cover rounded" />}
            </FormItem>

            <FormItem>
              <FormLabel>Banner</FormLabel>
              <FormControl>
                <Input id="bannerFile" type="file" accept="image/*" onChange={e => {
                  const file = e.target.files?.[0] || null;
                  setBannerFile(file);
                }} />
              </FormControl>
              {bannerPreview && <img src={bannerPreview} alt="Banner preview" className="mt-2 w-full max-h-32 object-cover rounded" />}
            </FormItem>

            <FormField name="visibility" control={control} render={({ field }) => (
              <FormItem>
                <FormLabel>Visibility</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ModpackVisibilityEnum.PRIVATE}>Private</SelectItem>
                      <SelectItem value={ModpackVisibilityEnum.PUBLIC}>Public</SelectItem>
                      <SelectItem value={ModpackVisibilityEnum.PATREON}>Patreon-only (if applicable)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="shortDescription" control={control} render={({ field }) => (
              <FormItem>
                <FormLabel>Short Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="A brief summary of your modpack (max 200 chars)" className="w-full border rounded px-2 py-1" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField name="description" control={control} render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="A full description of your modpack" rows={5} className="w-full border rounded px-2 py-1" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

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
        </Form>
      </DialogContent>
    </Dialog>
  );
};
