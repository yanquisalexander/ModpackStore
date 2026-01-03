import { TauriCommandReturns } from "@/types/TauriCommandReturns"
import { invoke } from "@tauri-apps/api/core"
import { useEffect, useState } from "react"
import { LucideUsers, LucideWifiOff, LucidePlus } from "lucide-react"
import { AccountCard } from "@/components/AccountCard"
import { AddAccountDialog } from "@/components/AddAccountDialog"
import { toast } from "sonner"
import { useGlobalContext } from "@/stores/GlobalContext"
import { useConnection } from "@/utils/ConnectionContext"
import { motion } from "motion/react"

export const AccountsSection = () => {
    const [accounts, setAccounts] = useState<TauriCommandReturns['get_all_accounts']>([])
    const [loading, setLoading] = useState(true)
    const { hasInternetAccess } = useConnection()
    const { setTitleBarState, titleBarState } = useGlobalContext()

    const fetchAccounts = () => {
        setLoading(true)
        invoke<TauriCommandReturns['get_all_accounts']>('get_all_accounts')
            .then((fetchedAccounts) => {
                setAccounts(fetchedAccounts)
            })
            .catch((error) => {
                console.error("Error fetching accounts:", error)
                toast.error("Error al cargar las cuentas")
            })
            .finally(() => {
                setLoading(false)
            })
    }

    useEffect(() => {
        fetchAccounts()
    }, [])

    useEffect(() => {
        setTitleBarState({
            ...titleBarState,
            title: "Gestión de Cuentas",
            icon: LucideUsers,
            canGoBack: true,
            customIconClassName: "bg-purple-500/20 text-purple-400",
            opaque: false,
        })
    }, [])

    const handleRemoveAccount = async (uuid: string) => {
        try {
            await invoke('remove_account', { uuid })
            setAccounts(prev => prev.filter(acc => acc.uuid !== uuid))
            toast.success("Cuenta eliminada correctamente")
        } catch (error) {
            console.error("Error removing account:", error)
            toast.error("No se pudo eliminar la cuenta")
            fetchAccounts()
        }
    }

    // Variantes de animación
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    }

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: "spring" as const, stiffness: 100 }
        }
    }

    return (
        <div className="relative min-h-dvh bg-[#0a0a0a] text-white overflow-hidden">

            {/* Background Glows */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-12 md:px-12 h-full overflow-y-auto custom-scrollbar">

                {/* Header */}
                <header className="mb-12 border-b border-white/5 pb-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <LucideUsers className="w-6 h-6 text-purple-400" />
                        </div>
                        <h1 className="tracking-tight inline font-semibold text-3xl bg-gradient-to-b from-purple-200 to-purple-500 bg-clip-text text-transparent">
                            Mis cuentas
                        </h1>
                    </div>
                    <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
                        Gestiona tus perfiles de Minecraft. Puedes tener múltiples cuentas (Microsoft u Offline) y alternar entre ellas fácilmente.
                    </p>
                </header>

                {/* Content */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-[160px] rounded-xl bg-white/5 animate-pulse border border-white/5" />
                        ))}
                    </div>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    >
                        {/* Lista de Cuentas */}
                        {accounts.map((account) => (
                            <motion.div key={account.uuid} variants={itemVariants}>
                                <AccountCard
                                    account={account}
                                    onRemove={handleRemoveAccount}
                                />
                            </motion.div>
                        ))}

                        {/* Botón de Añadir */}
                        <motion.div variants={itemVariants} className="h-full">
                            {hasInternetAccess ? (
                                <AddAccountDialog onAccountAdded={fetchAccounts} />
                            ) : (
                                <div className="h-[160px] w-full rounded-xl border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center gap-3 text-neutral-500 cursor-not-allowed select-none group hover:bg-red-500/5 hover:border-red-500/20 transition-colors">
                                    <div className="p-3 rounded-full bg-white/5 group-hover:bg-red-500/10 group-hover:text-red-400 transition-colors">
                                        <LucideWifiOff className="h-6 w-6" />
                                    </div>
                                    <span className="text-sm font-medium">Sin conexión</span>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}

                {/* Empty State */}
                {!loading && accounts.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                        className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-purple-900/10 to-blue-900/10 border border-white/5 text-center max-w-md mx-auto"
                    >
                        <h3 className="text-lg font-semibold text-white mb-2">¿Listo para jugar?</h3>
                        <p className="text-sm text-neutral-400 mb-6">
                            Añade tu primera cuenta para acceder a los modpacks y comenzar tu aventura.
                        </p>
                        <div className="text-purple-400 text-sm font-medium flex items-center justify-center gap-2">
                            <LucidePlus className="w-4 h-4" />
                            Usa el botón de arriba
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    )
}