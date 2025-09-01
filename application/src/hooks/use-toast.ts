import { toast as sonnerToast } from "sonner"

interface ToastProps {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  return {
    toast: ({ title, description, variant = 'default' }: ToastProps) => {
      if (variant === 'destructive') {
        sonnerToast.error(title || 'Error', {
          description
        })
      } else {
        sonnerToast.success(title || 'Success', {
          description
        })
      }
    }
  }
}