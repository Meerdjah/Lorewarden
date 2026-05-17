export default function Modal({ open, onClose, title, children, wide }) {
    if (!open) return null
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-[fadeIn_0.2s_ease] overflow-y-auto"
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div
                className={`bg-bg-card border border-border-gold rounded-2xl p-7 w-full shadow-2xl animate-[slideUp_0.3s_ease] max-h-[90vh] overflow-y-auto ${wide ? 'max-w-[640px]' : 'max-w-[520px]'
                    }`}
            >
                {title && (
                    <h3 className="text-xl font-semibold text-gold mb-5" style={{ fontFamily: 'var(--font-display)' }}>
                        {title}
                    </h3>
                )}
                {children}
            </div>
        </div>
    )
}
