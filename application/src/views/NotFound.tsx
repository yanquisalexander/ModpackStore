import { Link } from "react-router-dom"
import { LucideHome, LucideArrowLeft } from "lucide-react"
import { getSpecialFlags } from "@/utils/SPECIAL_DATES"
import { StreamlineUltimateHalloweenCandy } from "@/icons/StreamlineUltimateHalloweenCandy"

const NotFoundIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => {
    const { halloween } = getSpecialFlags()
    if (halloween) {
        return <StreamlineUltimateHalloweenCandy {...props} />
    }
    return null
}

export const NotFound = () => {
    return (
        <div className="h-full flex flex-col items-center justify-center px-4">
            <NotFoundIcon className="w-10 h-10 text-neutral-600 mb-5" />

            <h1 className="text-base font-semibold text-white/80">
                Sección no encontrada
            </h1>

            <p className="text-sm text-neutral-600 mt-1 max-w-xs text-center leading-relaxed">
                La sección que buscas no existe o ha sido movida.
            </p>

            <div className="flex items-center gap-3 mt-8">
                <Link
                    to="/"
                    className="flex items-center gap-1.5 bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white/90 transition-colors active:scale-95"
                >
                    <LucideHome className="w-4 h-4" />
                    Ir al inicio
                </Link>
                <button
                    onClick={() => window.history.back()}
                    className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 px-4 py-2 rounded-lg hover:text-neutral-300 hover:bg-white/[0.04] transition-colors"
                >
                    <LucideArrowLeft className="w-4 h-4" />
                    Volver
                </button>
            </div>
        </div>
    )
}
