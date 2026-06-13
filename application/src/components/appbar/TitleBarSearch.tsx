import { LucideSearch, LucideX } from "lucide-react"
import { useSearchBar } from "@/stores/SearchBarContext"

export const TitleBarSearch = () => {
    const { query, setQuery, isFocused, setIsFocused } = useSearchBar()

    return (
        <div
            className={`
                flex items-center gap-1.5 h-7 w-64
                rounded-md border px-2
                transition-all duration-200
                ${isFocused
                    ? "bg-black/40 border-[#bcfe47]/40"
                    : "bg-black/20 border-white/[0.06]"
                }
            `}
        >
            <LucideSearch className={`size-3.5 flex-shrink-0 transition-colors ${isFocused ? "text-[#bcfe47]" : "text-neutral-500"}`} />
            <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Buscar modpacks..."
                className="
                    flex-1 bg-transparent text-xs text-white
                    placeholder-neutral-600
                    focus:outline-none
                "
            />
            {query && (
                <button
                    onClick={() => setQuery("")}
                    className="flex items-center justify-center text-neutral-600 hover:text-neutral-400 transition-colors"
                >
                    <LucideX className="size-3" />
                </button>
            )}
        </div>
    )
}
