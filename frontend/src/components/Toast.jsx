import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext()

export function useToast() {
    return useContext(ToastContext)
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const toast = useCallback((msg, type = 'success') => {
        const id = Date.now() + Math.random()
        setToasts(prev => [...prev, { id, msg, type }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
    }, [])

    const colors = {
        success: 'bg-gradient-to-r from-green-950 to-green-900 text-green-300 border border-green-800/50',
        error: 'bg-gradient-to-r from-red-950 to-red-900 text-red-300 border border-red-800/50',
        info: 'bg-gradient-to-r from-blue-950 to-blue-900 text-blue-300 border border-blue-800/50',
    }

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2">
                {toasts.map(t => (
                    <div
                        key={t.id}
                        className={`px-5 py-3 rounded-xl text-sm font-medium shadow-lg max-w-[360px] animate-[slideUp_0.3s_ease] ${colors[t.type] || colors.success}`}
                    >
                        {t.msg}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}
