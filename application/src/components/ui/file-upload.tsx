import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { UploadCloud, File, X } from 'lucide-react';
import { useFileUpload, UseFileUploadOptions } from '@/hooks/useFileUpload';
import { cn } from '@/lib/utils';

interface FileUploadComponentProps extends UseFileUploadOptions {
    title: string;
    description?: string;
    currentFileUrl?: string;
    accept?: string;
    className?: string;
    showProgress?: boolean;
}

export const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
    title,
    description,
    currentFileUrl,
    accept = "image/*",
    className,
    showProgress = true,
    ...uploadOptions
}) => {
    const {
        file,
        preview,
        progress,
        isUploading,
        error,
        selectFile,
        reset,
        formatFileSize,
    } = useFileUpload(uploadOptions);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null;
        selectFile(selectedFile);
    };

    const handleRemoveFile = () => {
        selectFile(null);
    };

    const displayImage = preview || currentFileUrl;
    const hasFile = file || currentFileUrl;

    return (
        <Card className={cn("w-full", className)}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UploadCloud className="w-5 h-5" />
                    {title}
                </CardTitle>
                {description && (
                    <CardDescription>{description}</CardDescription>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Upload Area */}
                <div className="flex items-center gap-4">
                    {/* Preview/Icon Area */}
                    <div className="w-24 h-24 bg-muted border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center overflow-hidden">
                        {displayImage ? (
                            <img
                                src={displayImage}
                                alt="Preview"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <UploadCloud className="w-8 h-8 text-muted-foreground/50" />
                        )}
                    </div>

                    {/* File Info and Actions */}
                    <div className="flex-1 space-y-2">
                        {hasFile && (
                            <div className="flex items-center gap-2 text-sm">
                                <File className="w-4 h-4" />
                                <span className="font-medium">
                                    {file?.name || 'Archivo actual'}
                                </span>
                                {file && (
                                    <span className="text-muted-foreground">
                                        ({formatFileSize(file.size)})
                                    </span>
                                )}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRemoveFile}
                                    className="h-6 w-6 p-0 ml-auto"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        )}

                        {/* Upload Button */}
                        <div className="flex gap-2">
                            <label className="cursor-pointer">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    asChild
                                    disabled={isUploading}
                                >
                                    <span>
                                        Seleccionar archivo
                                    </span>
                                </Button>
                                <input
                                    type="file"
                                    accept={accept}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    disabled={isUploading}
                                />
                            </label>
                        </div>

                        {/* Progress Bar */}
                        {showProgress && isUploading && (
                            <div className="space-y-1">
                                <Progress value={progress} className="h-2" />
                                <div className="text-xs text-muted-foreground">
                                    Subiendo... {progress}%
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="text-sm text-destructive">
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};