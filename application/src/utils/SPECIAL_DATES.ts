// Utilities to detect special dates: Halloween, Christmas, Christmas week, New Year's Eve, New Year's Day, Valentine's, etc.
// Exports: isHalloween(date?), isChristmas(date?), isChristmasWeek(date?), isNewYearsEve(date?), isNewYearsDay(date?), isValentines(date?), getSpecialFlags(date?)

export type SpecialFlags = {
    halloween: boolean
    christmas: boolean
    christmasWeek: boolean
    newYearsEve: boolean
    newYearsDay: boolean
    valentines: boolean
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export function isHalloween(date?: Date): boolean {
    const d = date ? new Date(date) : new Date()
    const m = d.getMonth() // 0-based
    const day = d.getDate()
    return m === 9 && day === 31 // October 31
}

export function isValentines(date?: Date): boolean {
    const d = date ? new Date(date) : new Date()
    return d.getMonth() === 1 && d.getDate() === 14 // Feb 14
}

export function isNewYearsEve(date?: Date): boolean {
    const d = date ? new Date(date) : new Date()
    return d.getMonth() === 11 && d.getDate() === 31 // Dec 31
}

export function isNewYearsDay(date?: Date): boolean {
    const d = date ? new Date(date) : new Date()
    return d.getMonth() === 0 && d.getDate() === 1 // Jan 1
}

export function isChristmas(date?: Date): boolean {
    const d = date ? new Date(date) : new Date()
    return d.getMonth() === 11 && d.getDate() === 25 // Dec 25
}

export function isChristmasWeek(date?: Date): boolean {
    // Define Christmas week as Dec 24 - Dec 31 inclusive (adjustable)
    const d = date ? new Date(date) : new Date()
    const month = d.getMonth()
    const day = d.getDate()
    if (month !== 11) return false
    return day >= 24 && day <= 31
}

export function getSpecialFlags(date?: Date): SpecialFlags {
    return {
        halloween: isHalloween(date),
        christmas: isChristmas(date),
        christmasWeek: isChristmasWeek(date),
        newYearsEve: isNewYearsEve(date),
        newYearsDay: isNewYearsDay(date),
        valentines: isValentines(date)
    }
}

export default {
    isHalloween,
    isChristmas,
    isChristmasWeek,
    isNewYearsEve,
    isNewYearsDay,
    isValentines,
    getSpecialFlags
}
