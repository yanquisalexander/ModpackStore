import React, { useCallback, useRef } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';

const HCAPTCHA_SITE_KEY = '862e6a5a-dd90-4652-bbfe-b216b6a44af2';

interface HCaptchaWrapperProps {
    onVerify: (token: string) => void;
    onExpire?: () => void;
    onError?: (error: string) => void;
    theme?: 'light' | 'dark';
    size?: 'normal' | 'compact';
    className?: string;
}

export const HCaptchaWrapper: React.FC<HCaptchaWrapperProps> = ({
    onVerify,
    onExpire,
    onError,
    theme = 'dark',
    size = 'normal',
    className,
}) => {
    const captchaRef = useRef<HCaptcha>(null);

    const handleVerify = useCallback((token: string) => {
        onVerify(token);
    }, [onVerify]);

    const handleExpire = useCallback(() => {
        onExpire?.();
    }, [onExpire]);

    const handleError = useCallback((err: string) => {
        onError?.(err);
    }, [onError]);

    return (
        <div className={className}>
            <HCaptcha
                ref={captchaRef}
                sitekey={HCAPTCHA_SITE_KEY}
                onVerify={handleVerify}
                onExpire={handleExpire}
                onError={handleError}
                theme={theme}
                size={size}
            />
        </div>
    );
};

export const HCaptcha_HEADER = 'x-hcaptcha-response';
