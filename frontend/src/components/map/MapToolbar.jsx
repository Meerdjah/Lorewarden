import { useState, useRef } from 'react'

const TOOLS = [
    { id: 'select', icon: 'fa-mouse-pointer', label: 'Select' },
    { id: 'pan', icon: 'fa-hand-paper', label: 'Pan' },
    { id: 'fog', icon: 'fa-cloud', label: 'Fog', gmOnly: true },
]

const TOKEN_COLORS = ['#d4a840', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#06b6d4']

export default function MapToolbar({
    selectedTool, setSelectedTool, isGM,
    onUploadMap, onAddToken, onClearFog,
    gridConfig, onGridToggle, onGridSizeChange,
}) {
    const fileRef = useRef(null)
    const [addingToken, setAddingToken] = useState(false)
    const [tokenLabel, setTokenLabel] = useState('')
    const [tokenColor, setTokenColor] = useState('#d4a840')
    const [tokenSize, setTokenSize] = useState(40)

    function handleFileUpload(e) {
        const file = e.target.files[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => onUploadMap(ev.target.result)
        reader.readAsDataURL(file)
        e.target.value = ''
    }

    function submitToken() {
        if (!tokenLabel.trim()) return
        onAddToken({ label: tokenLabel, color: tokenColor, size: tokenSize, x: 200, y: 200 })
        setTokenLabel('')
        setAddingToken(false)
    }

    const inp = "bg-bg-input border border-border rounded-lg px-2 py-1.5 text-xs text-gray-200 outline-none focus:border-gold"
    const btn = (active) => `w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer transition-all ${active ? 'bg-gold/20 text-gold border border-gold/40' : 'text-gray-400 hover:text-gold hover:bg-white/5 border border-transparent'}`

    return (
        <div className="w-56 bg-bg-card border-r border-border p-3 flex flex-col gap-4 overflow-y-auto shrink-0">
            {/* Tools */}
            <div>
                <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wider">Tools</p>
                <div className="flex gap-1 flex-wrap">
                    {TOOLS.filter(t => !t.gmOnly || isGM).map(t => (
                        <button key={t.id} onClick={() => setSelectedTool(t.id)} className={btn(selectedTool === t.id)} title={t.label}>
                            <i className={`fas ${t.icon} text-sm`}></i>
                        </button>
                    ))}
                </div>
            </div>

            {/* Map Upload (GM only) */}
            {isGM && (
                <div>
                    <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wider">Map</p>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    <button onClick={() => fileRef.current?.click()} className="w-full text-xs py-2 px-3 rounded-lg bg-gradient-to-r from-gold to-gold-dark text-white font-semibold hover:from-gold-light hover:to-gold cursor-pointer transition-all">
                        <i className="fas fa-upload mr-1"></i> Upload Map
                    </button>
                </div>
            )}

            {/* Grid */}
            <div>
                <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wider">Grid</p>
                <div className="flex items-center gap-2 mb-2">
                    <button onClick={onGridToggle} className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer border transition-all ${gridConfig.enabled ? 'border-gold bg-gold/10 text-gold' : 'border-border text-gray-500'}`}>
                        {gridConfig.enabled ? 'ON' : 'OFF'}
                    </button>
                    <input type="number" value={gridConfig.size} onChange={e => onGridSizeChange(parseInt(e.target.value) || 50)} className={`${inp} w-16 text-center`} min="20" max="200" />
                    <span className="text-xs text-gray-600">px</span>
                </div>
            </div>

            {/* Add Token */}
            <div>
                <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wider">Tokens</p>
                {!addingToken ? (
                    <button onClick={() => setAddingToken(true)} className="w-full text-xs py-2 px-3 rounded-lg bg-blue-950 text-blue-300 font-semibold hover:bg-blue-900 cursor-pointer transition-all">
                        <i className="fas fa-plus mr-1"></i> Add Token
                    </button>
                ) : (
                    <div className="space-y-2 p-2 rounded-lg bg-bg-input border border-border">
                        <input value={tokenLabel} onChange={e => setTokenLabel(e.target.value)} className={`${inp} w-full`} placeholder="Token name" autoFocus onKeyDown={e => e.key === 'Enter' && submitToken()} />
                        <div className="flex gap-1 flex-wrap">
                            {TOKEN_COLORS.map(c => (
                                <div key={c} onClick={() => setTokenColor(c)} className={`w-5 h-5 rounded-full cursor-pointer border-2 transition-all ${tokenColor === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ background: c }}></div>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Size:</span>
                            <input type="range" min="20" max="80" value={tokenSize} onChange={e => setTokenSize(parseInt(e.target.value))} className="flex-1" />
                            <span className="text-xs text-gray-400 w-6">{tokenSize}</span>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setAddingToken(false)} className="flex-1 text-xs py-1.5 rounded-lg bg-white/5 border border-border text-gray-400 cursor-pointer">Cancel</button>
                            <button onClick={submitToken} className="flex-1 text-xs py-1.5 rounded-lg bg-gold/20 text-gold font-semibold border border-gold/30 cursor-pointer">Add</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Fog Controls (GM only) */}
            {isGM && (
                <div>
                    <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wider">Fog of War</p>
                    <p className="text-xs text-gray-600 mb-2">Select Fog tool then draw on map. Click fog to toggle visibility.</p>
                    <button onClick={onClearFog} className="w-full text-xs py-1.5 rounded-lg bg-red-950 text-red-300 hover:bg-red-900 cursor-pointer transition-all">
                        <i className="fas fa-eraser mr-1"></i> Clear All Fog
                    </button>
                </div>
            )}

            {/* Help */}
            <div className="mt-auto pt-3 border-t border-border">
                <p className="text-xs text-gray-600 leading-relaxed">
                    <strong className="text-gray-400">Scroll</strong> to zoom<br />
                    <strong className="text-gray-400">Pan tool</strong> to drag map<br />
                    <strong className="text-gray-400">Select</strong> to drag tokens
                </p>
            </div>
        </div>
    )
}
