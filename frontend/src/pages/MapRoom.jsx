import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useToast } from '../components/Toast'
import MapCanvas from '../components/map/MapCanvas'
import MapToolbar from '../components/map/MapToolbar'

const SOCKET_URL = import.meta.env.VITE_API_URL || ''

export default function MapRoom() {
    const toast = useToast()
    const socketRef = useRef(null)
    const stageRef = useRef(null)

    const [phase, setPhase] = useState('lobby') // lobby | room
    const [name, setName] = useState('')
    const [joinCode, setJoinCode] = useState('')
    const [isGM, setIsGM] = useState(false)
    const [roomCode, setRoomCode] = useState('')
    const [selectedTool, setSelectedTool] = useState('select')

    // Room state
    const [state, setState] = useState({
        users: [],
        mapImage: null,
        gridConfig: { enabled: true, size: 50, color: 'rgba(255,255,255,0.15)' },
        tokens: [],
        fogAreas: [],
    })

    // Connect socket
    useEffect(() => {
        const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
        socketRef.current = socket

        socket.on('map:state', (s) => {
            setState(prev => ({
                ...prev,
                users: s.users || [],
                mapImage: s.mapImage ?? prev.mapImage,
                gridConfig: s.gridConfig || prev.gridConfig,
                tokens: s.tokens || [],
                fogAreas: s.fogAreas || [],
            }))
        })

        socket.on('map:tokenMoved', ({ tokenId, x, y }) => {
            setState(prev => ({
                ...prev,
                tokens: prev.tokens.map(t => t.id === tokenId ? { ...t, x, y } : t),
            }))
        })

        return () => { socket.disconnect() }
    }, [])

    function createRoom() {
        if (!name.trim()) return toast('Masukkan nama kamu', 'error')
        socketRef.current?.emit('map:create', { name: name.trim() }, (res) => {
            if (res.success) {
                setRoomCode(res.code)
                setIsGM(res.isGM)
                setPhase('room')
                toast(`Room dibuat: ${res.code}`)
            } else toast(res.error, 'error')
        })
    }

    function joinRoom() {
        if (!name.trim()) return toast('Masukkan nama kamu', 'error')
        if (!joinCode.trim()) return toast('Masukkan kode room', 'error')
        socketRef.current?.emit('map:join', { code: joinCode.trim().toUpperCase(), name: name.trim() }, (res) => {
            if (res.success) {
                setRoomCode(res.code)
                setIsGM(res.isGM)
                setPhase('room')
                toast(`Bergabung ke room ${res.code}`)
            } else toast(res.error, 'error')
        })
    }

    function leaveRoom() {
        socketRef.current?.emit('map:leave')
        setPhase('lobby')
        setRoomCode('')
        setState({ users: [], mapImage: null, gridConfig: { enabled: true, size: 50, color: 'rgba(255,255,255,0.15)' }, tokens: [], fogAreas: [] })
    }

    // Handlers
    const handleUploadMap = useCallback((dataUrl) => {
        socketRef.current?.emit('map:setMap', { mapImage: dataUrl })
    }, [])

    const handleAddToken = useCallback((token) => {
        socketRef.current?.emit('map:addToken', { token })
    }, [])

    const handleTokenMove = useCallback((tokenId, x, y) => {
        socketRef.current?.emit('map:moveToken', { tokenId, x, y })
    }, [])

    const handleAddFog = useCallback((fog) => {
        socketRef.current?.emit('map:addFog', { fog })
    }, [])

    const handleToggleFog = useCallback((fogId) => {
        socketRef.current?.emit('map:toggleFog', { fogId })
    }, [])

    const handleClearFog = useCallback(() => {
        socketRef.current?.emit('map:clearFog')
    }, [])

    const handleGridToggle = useCallback(() => {
        const next = { ...state.gridConfig, enabled: !state.gridConfig.enabled }
        socketRef.current?.emit('map:gridConfig', { gridConfig: next })
    }, [state.gridConfig])

    const handleGridSizeChange = useCallback((size) => {
        const next = { ...state.gridConfig, size }
        socketRef.current?.emit('map:gridConfig', { gridConfig: next })
    }, [state.gridConfig])

    const inp = "w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-gold transition-colors"

    // --- Lobby Phase ---
    if (phase === 'lobby') {
        return (
            <>
                <div className="px-6 py-7 border-b border-border bg-gradient-to-br from-bg-surface to-bg-card">
                    <h1 className="text-2xl font-bold text-gold" style={{ fontFamily: 'var(--font-display)' }}>Battle Map</h1>
                    <p className="text-gray-500 text-sm mt-1">Collaborative virtual tabletop — upload maps, place tokens, reveal fog of war</p>
                </div>
                <div className="flex items-center justify-center py-16">
                    <div className="w-full max-w-md space-y-6 px-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1 font-medium">Nama Kamu</label>
                            <input value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="Game Master / Player name" />
                        </div>

                        <div className="bg-bg-card border border-border rounded-2xl p-5">
                            <h3 className="text-sm font-semibold text-gold mb-3" style={{ fontFamily: 'var(--font-display)' }}>Buat Room Baru</h3>
                            <p className="text-xs text-gray-500 mb-3">Kamu otomatis menjadi GM (Game Master) dengan akses penuh.</p>
                            <button onClick={createRoom} className="w-full py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-gold to-gold-dark text-white hover:from-gold-light hover:to-gold cursor-pointer transition-all shadow-md">
                                <i className="fas fa-plus mr-2"></i>Buat Room
                            </button>
                        </div>

                        <div className="bg-bg-card border border-border rounded-2xl p-5">
                            <h3 className="text-sm font-semibold text-gold mb-3" style={{ fontFamily: 'var(--font-display)' }}>Gabung Room</h3>
                            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} className={`${inp} mb-3 tracking-[4px] text-center font-bold text-lg`} placeholder="KODE" maxLength={5} onKeyDown={e => e.key === 'Enter' && joinRoom()} />
                            <button onClick={joinRoom} className="w-full py-2.5 rounded-lg text-sm font-semibold bg-blue-950 text-blue-300 hover:bg-blue-900 cursor-pointer transition-all">
                                <i className="fas fa-sign-in-alt mr-2"></i>Gabung
                            </button>
                        </div>
                    </div>
                </div>
            </>
        )
    }

    // --- Room Phase ---
    return (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 60px)' }}>
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-bg-surface border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gold tracking-[3px]">{roomCode}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isGM ? 'bg-gold/20 text-gold' : 'bg-blue-950 text-blue-300'}`}>{isGM ? 'GM' : 'Player'}</span>
                    <span className="text-xs text-gray-500"><i className="fas fa-users mr-1"></i>{state.users.length}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(roomCode); toast('Kode disalin!') }} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-border text-gray-400 hover:bg-white/10 cursor-pointer">
                        <i className="fas fa-copy mr-1"></i>Copy Code
                    </button>
                    <button onClick={leaveRoom} className="text-xs px-3 py-1.5 rounded-lg bg-red-950 text-red-300 hover:bg-red-900 cursor-pointer">
                        <i className="fas fa-sign-out-alt mr-1"></i>Leave
                    </button>
                </div>
            </div>

            {/* Main area */}
            <div className="flex flex-1 overflow-hidden">
                <MapToolbar
                    selectedTool={selectedTool}
                    setSelectedTool={setSelectedTool}
                    isGM={isGM}
                    onUploadMap={handleUploadMap}
                    onAddToken={handleAddToken}
                    onClearFog={handleClearFog}
                    gridConfig={state.gridConfig}
                    onGridToggle={handleGridToggle}
                    onGridSizeChange={handleGridSizeChange}
                />
                <MapCanvas
                    mapImage={state.mapImage}
                    gridConfig={state.gridConfig}
                    tokens={state.tokens}
                    fogAreas={state.fogAreas}
                    isGM={isGM}
                    selectedTool={selectedTool}
                    onTokenMove={handleTokenMove}
                    onAddFog={handleAddFog}
                    onToggleFog={handleToggleFog}
                    stageRef={stageRef}
                />
            </div>

            {/* Users sidebar */}
            <div className="absolute right-3 top-32 w-40 bg-bg-card/90 border border-border rounded-xl p-3 backdrop-blur-sm z-10 pointer-events-auto">
                <p className="text-xs text-gray-500 font-semibold mb-1.5 uppercase tracking-wider">Online</p>
                {state.users.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-1">
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        <span className={u.isGM ? 'text-gold font-semibold' : 'text-gray-300'}>{u.name}</span>
                        {u.isGM && <span className="text-gold/60 text-[10px]">GM</span>}
                    </div>
                ))}
            </div>
        </div>
    )
}
