export const tryParseJSON = (jsonString: string): any => {
    try {
        return JSON.parse(jsonString);
    } catch {
        return null;
    }
};
