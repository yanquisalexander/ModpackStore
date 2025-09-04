import { Link } from "react-router-dom"
import { LucideFrown, LucideHome, LucideArrowLeft } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const NotFound = () => {
    return (
        <div className="h-[calc(100dvh-2.25rem)] flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                <CardContent className="p-8 text-center">
                    {/* Ícono principal */}
                    <div className="flex justify-center mb-6">
                        <LucideFrown className="w-16 h-16 text-muted-foreground" />
                    </div>

                    {/* Título */}
                    <h1 className="text-2xl font-bold mb-2">
                        Sección no encontrada
                    </h1>

                    {/* Mensaje */}
                    <p className="text-muted-foreground mb-8 leading-relaxed">
                        Lo sentimos, la sección que buscas no existe o ha sido movida.
                    </p>

                    {/* Botones */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button asChild variant="secondary" className="flex items-center gap-2">
                            <Link to="/">
                                <LucideHome className="w-4 h-4" />
                                Ir al inicio
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="flex items-center gap-2">
                            <div onClick={() => window.history.back()}>
                                <LucideArrowLeft className="w-4 h-4" />
                                Volver atrás
                            </div>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
