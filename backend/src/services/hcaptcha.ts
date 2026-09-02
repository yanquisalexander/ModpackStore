const HCAPTCHA_SECRET = Deno.env.get("HCAPTCHA_SECRET") ?? "";
const HCAPTCHA_VERIFY_URL = "https://api.hcaptcha.com/siteverify";

export interface HCaptchaResult {
    success: boolean;
    errorCodes?: string[];
}

export async function verifyHCaptcha(token: string, ip?: string): Promise<HCaptchaResult> {
    if (!HCAPTCHA_SECRET) {
        console.warn("[hCaptcha] HCAPTCHA_SECRET not configured, skipping verification");
        return { success: true };
    }

    if (!token) {
        return { success: false, errorCodes: ["missing-input-response"] };
    }

    try {
        const formData = new URLSearchParams();
        formData.append("response", token);
        formData.append("secret", HCAPTCHA_SECRET);
        if (ip) {
            formData.append("remoteip", ip);
        }

        const res = await fetch(HCAPTCHA_VERIFY_URL, {
            method: "POST",
            body: formData,
        });

        const data = await res.json();

        return {
            success: data.success === true,
            errorCodes: data["error-codes"] ?? [],
        };
    } catch (error) {
        console.error("[hCaptcha] Verification request failed:", error);
        return { success: false, errorCodes: ["network-error"] };
    }
}
