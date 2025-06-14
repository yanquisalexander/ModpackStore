import React, { useState, useEffect, FC, ChangeEvent } from 'react';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch'; // Using Switch instead of Checkbox
import { Textarea } from '../../../components/ui/textarea';
import { PublisherData, NewPublisherData, UpdatePublisherData } from '../../../services/adminPublishers';

interface OrganizationFormProps {
    organizationToEdit?: PublisherData;
    onSubmit: (data: NewPublisherData | UpdatePublisherData) => Promise<void>;
    isSubmitting: boolean;
    onCancel?: () => void;
}

const initialFormData: NewPublisherData = {
    publisherName: '',
    tosUrl: '',
    privacyUrl: '',
    bannerUrl: '',
    logoUrl: '',
    description: '',
    websiteUrl: '',
    discordUrl: '',
    banned: false,
    verified: false,
    partnered: false,
    isHostingPartner: false,
};

const OrganizationForm: FC<OrganizationFormProps> = ({ organizationToEdit, onSubmit, isSubmitting, onCancel }) => {
    const [formData, setFormData] = useState<NewPublisherData | UpdatePublisherData>(initialFormData);

    useEffect(() => {
        if (organizationToEdit) {
            // Ensure optional fields are defaulted if null/undefined in organizationToEdit
            setFormData({
                publisherName: organizationToEdit.publisherName || '',
                tosUrl: organizationToEdit.tosUrl || '',
                privacyUrl: organizationToEdit.privacyUrl || '',
                bannerUrl: organizationToEdit.bannerUrl || '',
                logoUrl: organizationToEdit.logoUrl || '',
                description: organizationToEdit.description || '',
                websiteUrl: organizationToEdit.websiteUrl || '',
                discordUrl: organizationToEdit.discordUrl || '',
                banned: organizationToEdit.banned || false,
                verified: organizationToEdit.verified || false,
                partnered: organizationToEdit.partnered || false,
                isHostingPartner: organizationToEdit.isHostingPartner || false,
            });
        } else {
            setFormData(initialFormData);
        }
    }, [organizationToEdit]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (name: keyof (NewPublisherData | UpdatePublisherData), checked: boolean) => {
        setFormData(prev => ({ ...prev, [name]: checked }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Text Inputs */}
                <div>
                    <Label htmlFor="publisherName">Organization Name</Label>
                    <Input id="publisherName" name="publisherName" value={formData.publisherName} onChange={handleChange} required />
                </div>
                <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" value={formData.description} onChange={handleChange} required />
                </div>
                <div>
                    <Label htmlFor="tosUrl">Terms of Service URL</Label>
                    <Input id="tosUrl" name="tosUrl" type="url" value={formData.tosUrl} onChange={handleChange} required />
                </div>
                <div>
                    <Label htmlFor="privacyUrl">Privacy Policy URL</Label>
                    <Input id="privacyUrl" name="privacyUrl" type="url" value={formData.privacyUrl} onChange={handleChange} required />
                </div>
                <div>
                    <Label htmlFor="bannerUrl">Banner URL</Label>
                    <Input id="bannerUrl" name="bannerUrl" type="url" value={formData.bannerUrl} onChange={handleChange} required />
                </div>
                <div>
                    <Label htmlFor="logoUrl">Logo URL</Label>
                    <Input id="logoUrl" name="logoUrl" type="url" value={formData.logoUrl} onChange={handleChange} required />
                </div>
                <div>
                    <Label htmlFor="websiteUrl">Website URL (Optional)</Label>
                    <Input id="websiteUrl" name="websiteUrl" type="url" value={formData.websiteUrl || ''} onChange={handleChange} />
                </div>
                <div>
                    <Label htmlFor="discordUrl">Discord URL (Optional)</Label>
                    <Input id="discordUrl" name="discordUrl" type="url" value={formData.discordUrl || ''} onChange={handleChange} />
                </div>
            </div>

            {/* Boolean Switches */}
            <div className="space-y-4">
                <div className="flex items-center space-x-2">
                    <Switch id="banned" checked={!!formData.banned} onCheckedChange={(checked) => handleCheckboxChange('banned', checked)} />
                    <Label htmlFor="banned">Banned</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch id="verified" checked={!!formData.verified} onCheckedChange={(checked) => handleCheckboxChange('verified', checked)} />
                    <Label htmlFor="verified">Verified</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch id="partnered" checked={!!formData.partnered} onCheckedChange={(checked) => handleCheckboxChange('partnered', checked)} />
                    <Label htmlFor="partnered">Partnered</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch id="isHostingPartner" checked={!!formData.isHostingPartner} onCheckedChange={(checked) => handleCheckboxChange('isHostingPartner', checked)} />
                    <Label htmlFor="isHostingPartner">Hosting Partner</Label>
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
                {onCancel && (
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                        Cancel
                    </Button>
                )}
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (organizationToEdit ? 'Saving...' : 'Creating...') : (organizationToEdit ? 'Save Changes' : 'Create Organization')}
                </Button>
            </div>
        </form>
    );
};

export default OrganizationForm;
