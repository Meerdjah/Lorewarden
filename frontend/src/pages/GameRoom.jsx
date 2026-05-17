import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useToast } from '../components/Toast'
import api from '../api'
import MapCanvas from '../components/map/MapCanvas'
import MapToolbar from '../components/map/MapToolbar'

const SOCKET_URL = import.meta.env.VITE_API_URL || ''

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious']
const STAT_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
const STAT_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
const STAT_COLORS = ['text-stat-str', 'text-stat-dex', 'text-stat-con', 'text-stat-int', 'text-stat-wis', 'text-stat-cha']
const mod = s => Math.floor((s - 10) / 2)
const fm = m => (m >= 0 ? `+${m}` : `${m}`)

// ──────────────────────────────────────────────
// YouTube helpers
// ──────────────────────────────────────────────
function extractVideoId(url) {
    if (!url) return null
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/,
    ]
    for (const p of patterns) { const m = url.match(p); if (m) return m[1] }
    return null
}
function formatTime(s) {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
}

// ──────────────────────────────────────────────
// Tabs
// ──────────────────────────────────────────────
const TABS = [
    { id: 'session', label: 'Session', icon: 'fa-dragon' },
    { id: 'music', label: 'Music', icon: 'fa-music' },
    { id: 'map', label: 'Map', icon: 'fa-map' },
]

// ╔══════════════════════════════════════════════════════════════╗
// ║  MAIN GAME ROOM                                              ║
// ╚══════════════════════════════════════════════════════════════╝
export default function GameRoom() {
    const toast = useToast()
    const socketRef = useRef(null)
    const [phase, setPhase] = useState('lobby')
    const [name, setName] = useState('')
    const [joinCode, setJoinCode] = useState('')
    const [isGM, setIsGM] = useState(false)
    const [roomCode, setRoomCode] = useState('')
    const [activeTab, setActiveTab] = useState('session')
    const [users, setUsers] = useState([])

    // Music state
    const [musicState, setMusicState] = useState({
        queue: [], currentIndex: -1, isPlaying: false, currentTime: 0, repeat: 'none', shuffle: false,
    })

    // Map state
    const [mapState, setMapState] = useState({
        mapImage: null,
        gridConfig: { enabled: true, size: 50, color: 'rgba(255,255,255,0.15)' },
        tokens: [], fogAreas: [],
    })
    const [selectedTool, setSelectedTool] = useState('select')
    const stageRef = useRef(null)

    // Session state
    const [sessionState, setSessionState] = useState({ sessions: [] })

    // ── Socket ──
    useEffect(() => {
        const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
        socketRef.current = s

        s.on('room:state', ({ users: u }) => setUsers(u || []))
        s.on('music:state', (ms) => setMusicState(ms))
        s.on('map:state', (ms) => setMapState(prev => ({ ...prev, ...ms })))
        s.on('map:tokenMoved', ({ tokenId, x, y }) => {
            setMapState(prev => ({
                ...prev,
                tokens: prev.tokens.map(t => t.id === tokenId ? { ...t, x, y } : t),
            }))
        })
        s.on('session:state', (ss) => setSessionState(ss))

        return () => { s.disconnect() }
    }, [])

    // ── Room actions ──
    function createRoom() {
        if (!name.trim()) return toast('Masukkan nama kamu', 'error')
        socketRef.current?.emit('room:create', { name: name.trim() }, (res) => {
            if (res.success) { setRoomCode(res.code); setIsGM(res.isGM); setPhase('room'); toast(`Room dibuat: ${res.code}`) }
            else toast(res.error, 'error')
        })
    }
    function joinRoom() {
        if (!name.trim()) return toast('Masukkan nama kamu', 'error')
        if (!joinCode.trim()) return toast('Masukkan kode room', 'error')
        socketRef.current?.emit('room:join', { code: joinCode.trim().toUpperCase(), name: name.trim() }, (res) => {
            if (res.success) { setRoomCode(res.code); setIsGM(res.isGM); setPhase('room'); toast(`Bergabung ke room ${res.code}`) }
            else toast(res.error, 'error')
        })
    }
    function leaveRoom() {
        socketRef.current?.emit('room:leave')
        setPhase('lobby'); setRoomCode(''); setUsers([])
        setMusicState({ queue: [], currentIndex: -1, isPlaying: false, currentTime: 0, repeat: 'none', shuffle: false })
        setMapState({ mapImage: null, gridConfig: { enabled: true, size: 50, color: 'rgba(255,255,255,0.15)' }, tokens: [], fogAreas: [] })
        setSessionState({ sessions: [] })
    }

    const emit = useCallback((event, data) => socketRef.current?.emit(event, data), [])

    const inp = "w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-gold transition-colors"

    // ── LOBBY ──
    if (phase === 'lobby') {
        return (
            <>
                <div className="px-6 py-7 border-b border-border bg-gradient-to-br from-bg-surface to-bg-card">
                    <h1 className="text-2xl font-bold text-gold" style={{ fontFamily: 'var(--font-display)' }}>Game Room</h1>
                    <p className="text-gray-500 text-sm mt-1">Session tracker, music, dan battle map — semua dalam satu room</p>
                </div>
                <div className="flex items-center justify-center py-16">
                    <div className="w-full max-w-md space-y-6 px-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1 font-medium">Nama Kamu</label>
                            <input value={name} onChange={e => setName(e.target.value)} className={inp} placeholder="Game Master / Player name" />
                        </div>
                        <div className="bg-bg-card border border-border rounded-2xl p-5">
                            <h3 className="text-sm font-semibold text-gold mb-3" style={{ fontFamily: 'var(--font-display)' }}>Buat Room Baru</h3>
                            <p className="text-xs text-gray-500 mb-3">Kamu otomatis menjadi GM dengan akses penuh ke map dan fog.</p>
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

    // ── ROOM VIEW ──
    return (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 60px)' }}>
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-bg-surface border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gold tracking-[3px]">{roomCode}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isGM ? 'bg-gold/20 text-gold' : 'bg-blue-950 text-blue-300'}`}>{isGM ? 'GM' : 'Player'}</span>
                    <span className="text-xs text-gray-500"><i className="fas fa-users mr-1"></i>{users.length}</span>
                </div>
                <div className="flex items-center gap-1">
                    {/* Tabs */}
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${activeTab === t.id ? 'bg-gold/20 text-gold border border-gold/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}>
                            <i className={`fas ${t.icon} mr-1`}></i>{t.label}
                        </button>
                    ))}
                    <div className="w-px h-5 bg-border mx-2"></div>
                    <button onClick={() => { navigator.clipboard.writeText(roomCode); toast('Kode disalin!') }} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-border text-gray-400 hover:bg-white/10 cursor-pointer">
                        <i className="fas fa-copy mr-1"></i>Copy
                    </button>
                    <button onClick={leaveRoom} className="text-xs px-3 py-1.5 rounded-lg bg-red-950 text-red-300 hover:bg-red-900 cursor-pointer">
                        <i className="fas fa-sign-out-alt mr-1"></i>Leave
                    </button>
                </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'session' && <SessionTab emit={emit} sessionState={sessionState} toast={toast} />}
                {activeTab === 'music' && <MusicTab emit={emit} musicState={musicState} users={users} />}
                {activeTab === 'map' && (
                    <div className="flex h-full overflow-hidden">
                        <MapToolbar
                            selectedTool={selectedTool} setSelectedTool={setSelectedTool} isGM={isGM}
                            onUploadMap={(d) => emit('map:setMap', { mapImage: d })}
                            onAddToken={(t) => emit('map:addToken', { token: t })}
                            onClearFog={() => emit('map:clearFog')}
                            gridConfig={mapState.gridConfig}
                            onGridToggle={() => emit('map:gridConfig', { gridConfig: { ...mapState.gridConfig, enabled: !mapState.gridConfig.enabled } })}
                            onGridSizeChange={(s) => emit('map:gridConfig', { gridConfig: { ...mapState.gridConfig, size: s } })}
                        />
                        <MapCanvas
                            mapImage={mapState.mapImage} gridConfig={mapState.gridConfig} tokens={mapState.tokens} fogAreas={mapState.fogAreas}
                            isGM={isGM} selectedTool={selectedTool} stageRef={stageRef}
                            onTokenMove={(id, x, y) => emit('map:moveToken', { tokenId: id, x, y })}
                            onAddFog={(f) => emit('map:addFog', { fog: f })}
                            onToggleFog={(id) => emit('map:toggleFog', { fogId: id })}
                        />
                    </div>
                )}
            </div>

            {/* Users overlay */}
            <div className="absolute right-3 top-32 w-40 bg-bg-card/90 border border-border rounded-xl p-3 backdrop-blur-sm z-10">
                <p className="text-xs text-gray-500 font-semibold mb-1.5 uppercase tracking-wider">Online</p>
                {users.map((u, i) => (
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

// ╔══════════════════════════════════════════════════════════════╗
// ║  SESSION TAB                                                 ║
// ╚══════════════════════════════════════════════════════════════╝
function SessionTab({ emit, sessionState, toast }) {
    const [allKarakter, setAllKarakter] = useState([])
    const [selectedId, setSelectedId] = useState('')
    const [session, setSession] = useState(null)
    const [karakter, setKarakter] = useState(null)
    const [hpAmount, setHpAmount] = useState(5)
    const [inspiration, setInspiration] = useState(false)
    const [exhaustion, setExhaustion] = useState(0)
    const [customSlotLevel, setCustomSlotLevel] = useState(1)
    const [customSlotAmount, setCustomSlotAmount] = useState(2)

    useEffect(() => {
        api.getKarakter().then(r => setAllKarakter(r.data)).catch(() => { })
    }, [])

    // Sync from Socket session state (show all loaded characters)
    const loadedSessions = sessionState?.sessions || []

    async function startSession(force) {
        if (!selectedId) return toast('Pilih karakter terlebih dahulu', 'error')
        try {
            const res = await api.startSession(selectedId, force)
            toast(res.message)
            const kRes = await api.getKarakterById(selectedId)
            setKarakter(kRes.data)
            setSession(res.data)
            setInspiration(res.data.inspiration)
            setExhaustion(res.data.exhaustion)
            // Broadcast to room
            emit('session:loadCharacter', {
                karakter: {
                    karakterId: parseInt(selectedId),
                    nama: res.data.nama, class: res.data.class, level: res.data.level,
                    hp: res.data.hp, spell_slots: res.data.spell_slots,
                    conditions: res.data.conditions, death_saves: res.data.death_saves,
                    inspiration: res.data.inspiration, exhaustion: res.data.exhaustion,
                }
            })
        } catch (e) { toast(e.message, 'error') }
    }

    async function endSession() {
        if (!selectedId || !confirm('Akhiri sesi bermain?')) return
        try {
            await api.endSession(selectedId)
            emit('session:removeCharacter', { karakterId: parseInt(selectedId) })
            setSession(null); setKarakter(null)
            toast('Sesi berakhir')
        } catch (e) { toast(e.message, 'error') }
    }

    async function doUpdateHP(type) {
        const amt = hpAmount
        if (amt <= 0 && type !== 'set') return toast('Masukkan jumlah yang valid', 'error')
        try {
            const res = await api.updateHP(selectedId, amt, type)
            setSession(res.data)
            emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { hp: res.data.hp } })
            if (type === 'damage' && res.data.hp.current === 0) toast('HP mencapai 0! Karakter pingsan!', 'error')
            else if (type === 'heal') toast(`+${amt} HP dipulihkan`)
            else if (type === 'temp') toast(`+${amt} Temporary HP ditambahkan`)
        } catch (e) { toast(e.message, 'error') }
    }

    async function doSetHP() {
        if (isNaN(hpAmount)) return toast('Masukkan nilai HP', 'error')
        try {
            const res = await api.updateHP(selectedId, hpAmount, 'set')
            setSession(res.data)
            emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { hp: res.data.hp } })
            toast(`HP diset ke ${hpAmount}`)
        } catch (e) { toast(e.message, 'error') }
    }

    async function clickSlot(level, isFilled) {
        try {
            await api.updateSpellSlot(selectedId, level, isFilled ? 'use' : 'restore', 1)
            const res = await api.getSession(selectedId)
            setSession(res.data)
            emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { spell_slots: res.data.spell_slots } })
        } catch (e) { toast(e.message, 'error') }
    }

    async function restoreAll() {
        try {
            for (const level of Object.keys(session?.spell_slots || {})) {
                await api.updateSpellSlot(selectedId, parseInt(level), 'restore_all', 0)
            }
            const res = await api.getSession(selectedId)
            setSession(res.data)
            emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { spell_slots: res.data.spell_slots } })
            toast('Semua spell slots dipulihkan')
        } catch (e) { toast(e.message, 'error') }
    }

    async function setCustomSlot() {
        try {
            await api.updateSpellSlot(selectedId, customSlotLevel, 'set_max', customSlotAmount)
            const res = await api.getSession(selectedId)
            setSession(res.data)
            emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { spell_slots: res.data.spell_slots } })
            toast(`Spell slot level ${customSlotLevel} diset ke ${customSlotAmount}`)
        } catch (e) { toast(e.message, 'error') }
    }

    async function toggleCondition(cond) {
        const active = session?.conditions || []
        const action = active.includes(cond) ? 'remove' : 'add'
        try {
            const res = await api.updateCondition(selectedId, cond, action)
            setSession(res.data)
            emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { conditions: res.data.conditions } })
        } catch (e) { toast(e.message, 'error') }
    }

    async function clearConditions() {
        try { const res = await api.updateCondition(selectedId, '', 'clear'); setSession(res.data); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { conditions: res.data.conditions } }) } catch (e) { toast(e.message, 'error') }
    }

    async function addDeathSave(type) {
        try { const res = await api.updateDeathSave(selectedId, type, 'add'); setSession(res.data); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { death_saves: res.data.death_saves } }) } catch (e) { toast(e.message, 'error') }
    }
    async function resetDeathSaves() {
        try { const res = await api.updateDeathSave(selectedId, '', 'reset'); setSession(res.data); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { death_saves: res.data.death_saves } }) } catch (e) { toast(e.message, 'error') }
    }

    async function toggleInspiration() {
        const next = !inspiration; setInspiration(next)
        try { await api.updateMisc(selectedId, { inspiration: next }); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { inspiration: next } }); toast(next ? 'Inspiration diperoleh!' : 'Inspiration digunakan') } catch (e) { toast(e.message, 'error') }
    }

    async function changeExhaustion(d) {
        const next = Math.max(0, Math.min(6, exhaustion + d)); setExhaustion(next)
        try { await api.updateMisc(selectedId, { exhaustion: next }); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { exhaustion: next } }); if (next === 6) toast('Exhaustion Level 6 — Karakter Mati!', 'error') } catch (e) { toast(e.message, 'error') }
    }

    const hp = session?.hp || { current: 0, max: 0, temp: 0 }
    const hpPct = hp.max > 0 ? Math.round((hp.current / hp.max) * 100) : 0
    const hpColor = hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-red-500'
    const spellEntries = Object.entries(session?.spell_slots || {})
    const deaths = session?.death_saves || { successes: 0, failures: 0 }
    const inp = "bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-gold transition-colors"
    const btn = (base) => `px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all ${base}`

    return (
        <div className="overflow-y-auto h-full">
            {/* Selector bar */}
            <div className="flex gap-3 items-end flex-wrap px-6 py-4 bg-bg-surface border-b border-border">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-gray-400 mb-1 font-medium">Pilih Karakter</label>
                    <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={`${inp} w-full`}>
                        <option value="">— Pilih Karakter —</option>
                        {allKarakter.map(k => <option key={k.id} value={k.id}>{k.nama_karakter} ({k.race} {k.class} Lv.{k.level})</option>)}
                    </select>
                </div>
                <button onClick={() => startSession(false)} className={btn('bg-gradient-to-r from-gold to-gold-dark text-white hover:from-gold-light hover:to-gold shadow-md')}><i className="fas fa-play mr-2"></i>Mulai Sesi</button>
                <button onClick={() => startSession(true)} className={btn('bg-blue-950 text-blue-300 hover:bg-blue-900')}><i className="fas fa-redo mr-2"></i>Restart</button>
                <button onClick={endSession} className={btn('bg-red-950 text-red-300 hover:bg-red-900')}><i className="fas fa-stop mr-2"></i>Akhiri</button>
            </div>

            {/* Other players' sessions */}
            {loadedSessions.length > 0 && (
                <div className="px-6 py-3 bg-bg-surface border-b border-border">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Active Characters in Room</p>
                    <div className="flex flex-wrap gap-3">
                        {loadedSessions.map(s => (
                            <div key={s.karakterId} className="flex items-center gap-2 bg-bg-card border border-border rounded-xl px-3 py-2">
                                <span className="text-sm font-semibold text-gold-light">{s.nama}</span>
                                <span className="text-xs text-gray-500">{s.class} Lv.{s.level}</span>
                                {s.hp && (
                                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${s.hp.current > s.hp.max * 0.5 ? 'bg-green-950 text-green-300' : s.hp.current > s.hp.max * 0.25 ? 'bg-amber-950 text-amber-300' : 'bg-red-950 text-red-300'}`}>
                                        {s.hp.current}/{s.hp.max}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!session ? (
                <div className="text-center py-20 text-gray-700">
                    <i className="fas fa-dragon text-6xl mb-4 block opacity-40"></i>
                    <p className="text-lg">Pilih karakter dan klik <span className="text-gold font-semibold">Mulai Sesi</span> untuk memulai</p>
                    <p className="text-sm mt-2 text-gray-600">Status sesi disimpan di Redis dan akan aktif selama 24 jam</p>
                </div>
            ) : (
                <div className="px-6 py-5 space-y-5">
                    {/* Header */}
                    <div className="bg-bg-card border border-border rounded-2xl p-5">
                        <div className="flex items-center gap-4">
                            {karakter?.gambar_url
                                ? <img src={karakter.gambar_url} className="w-16 h-16 rounded-xl object-cover border-2 border-gold-dark" />
                                : <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl bg-bg-input text-gray-600">⚔</div>
                            }
                            <div className="flex-1 min-w-0">
                                <div className="text-xl font-bold text-gold-light" style={{ fontFamily: 'var(--font-display)' }}>{session.nama}</div>
                                <div className="text-sm text-gray-400">{session.class} · Level {session.level}</div>
                            </div>
                            <button onClick={toggleInspiration} className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer border transition-all ${inspiration ? 'border-gold bg-gold/10 text-gold-light font-semibold' : 'border-border text-gray-600'}`}>✦ Inspiration</button>
                        </div>
                        {karakter?.strength != null && (
                            <div className="grid grid-cols-6 gap-2 mt-4">
                                {STAT_KEYS.map((s, i) => (
                                    <div key={s} className="bg-bg-input rounded-lg p-2 text-center">
                                        <div className={`text-[10px] font-bold ${STAT_COLORS[i]}`}>{STAT_LABELS[i]}</div>
                                        <div className="text-base font-bold mt-0.5">{karakter[s] ?? '—'}</div>
                                        <div className="text-xs text-gray-500">{karakter[s] != null ? fm(mod(karakter[s])) : '—'}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* HP */}
                    <div className="bg-bg-card border border-border rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-gold mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}><i className="fas fa-heart text-red-400"></i> Hit Points</h3>
                        <div className="flex items-center gap-4 mb-3">
                            <div className="text-3xl font-bold">{hp.current}</div>
                            <div className="text-lg text-gray-500">/ {hp.max}</div>
                            {hp.temp > 0 && <div className="text-sm text-blue-400">+{hp.temp} Temp</div>}
                        </div>
                        <div className="h-5 rounded-full bg-bg-input overflow-hidden mb-4">
                            <div className={`h-full rounded-full transition-all duration-500 relative ${hpColor}`} style={{ width: `${Math.max(0, Math.min(100, hpPct))}%` }}>
                                <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent rounded-full"></div>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <input type="number" value={hpAmount} onChange={e => setHpAmount(parseInt(e.target.value) || 0)} className={`${inp} w-20 text-center`} min="0" />
                            <button onClick={() => doUpdateHP('damage')} className={`${btn('bg-red-950 text-red-300 hover:bg-red-900')} flex-1`}><i className="fas fa-skull mr-1"></i>Damage</button>
                            <button onClick={() => doUpdateHP('heal')} className={`${btn('bg-green-950 text-green-300 hover:bg-green-900')} flex-1`}><i className="fas fa-plus-circle mr-1"></i>Heal</button>
                            <button onClick={() => doUpdateHP('temp')} className={btn('bg-blue-950 text-blue-300 hover:bg-blue-900')}><i className="fas fa-shield-alt mr-1"></i>Temp HP</button>
                            <button onClick={doSetHP} className={btn('bg-white/5 border border-border text-gray-400 hover:bg-white/10')}>Set HP</button>
                        </div>
                    </div>

                    {/* Spell Slots */}
                    <div className="bg-bg-card border border-border rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-gold mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                            <i className="fas fa-magic text-purple-400"></i> Spell Slots
                            <button onClick={restoreAll} className="ml-auto text-xs px-3 py-1 rounded-lg bg-purple-950 text-purple-300 hover:bg-purple-900 cursor-pointer">Restore All</button>
                        </h3>
                        <div className="space-y-3">
                            {spellEntries.length === 0 ? (
                                <p className="text-sm text-gray-600">Tidak ada spell slots. Gunakan panel di bawah untuk menambah custom slots.</p>
                            ) : spellEntries.map(([level, { current, max }]) => (
                                <div key={level} className="flex items-center gap-3">
                                    <span className="text-xs text-purple-300 w-14 shrink-0 font-semibold">Level {level}</span>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {Array.from({ length: max }, (_, i) => (
                                            <div key={i} onClick={() => clickSlot(parseInt(level), i < current)} title={i < current ? 'Klik untuk gunakan' : 'Klik untuk pulihkan'}
                                                className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-all hover:scale-110 ${i < current ? 'border-purple-400 bg-purple-600 shadow-[0_0_8px_rgba(124,58,237,0.4)]' : 'border-purple-900 bg-transparent'}`}></div>
                                        ))}
                                    </div>
                                    <span className="text-xs text-gray-600">{current}/{max}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 pt-4 border-t border-border">
                            <p className="text-xs text-gray-600 mb-2">Set custom max slots:</p>
                            <div className="flex gap-2 flex-wrap">
                                <select value={customSlotLevel} onChange={e => setCustomSlotLevel(parseInt(e.target.value))} className={`${inp} w-24`}>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => <option key={l} value={l}>Level {l}</option>)}
                                </select>
                                <input type="number" value={customSlotAmount} onChange={e => setCustomSlotAmount(parseInt(e.target.value) || 0)} className={`${inp} w-16 text-center`} min="0" max="10" />
                                <button onClick={setCustomSlot} className={btn('bg-purple-950 text-purple-300 hover:bg-purple-900')}>Set Max</button>
                            </div>
                        </div>
                    </div>

                    {/* Conditions */}
                    <div className="bg-bg-card border border-border rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-gold mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                            <i className="fas fa-biohazard text-amber-400"></i> Conditions
                            <button onClick={clearConditions} className="ml-auto text-xs px-3 py-1 rounded-lg bg-white/5 border border-border text-gray-500 hover:bg-white/10 cursor-pointer">Clear All</button>
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {CONDITIONS.map(c => {
                                const on = (session?.conditions || []).includes(c)
                                return (
                                    <button key={c} onClick={() => toggleCondition(c)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs cursor-pointer border transition-all ${on ? 'bg-red-950 border-red-500 text-red-300' : 'bg-bg-input border-border text-gray-400 hover:border-gray-500'}`}>
                                        <i className={`fas ${on ? 'fa-times-circle' : 'fa-circle text-gray-700'}`} style={on ? {} : { fontSize: '6px' }}></i>
                                        {c}
                                    </button>
                                )
                            })}
                        </div>
                        <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs text-gray-600 mb-2">Exhaustion Level: <span className="text-gold font-bold">{exhaustion}</span>/6</p>
                            <div className="flex gap-2">
                                <button onClick={() => changeExhaustion(-1)} className={btn('bg-blue-950 text-blue-300 hover:bg-blue-900 text-xs')}>−</button>
                                <button onClick={() => changeExhaustion(1)} className={btn('bg-red-950 text-red-300 hover:bg-red-900 text-xs')}>+</button>
                            </div>
                        </div>
                    </div>

                    {/* Death Saves */}
                    <div className="bg-bg-card border border-border rounded-2xl p-5">
                        <h3 className="text-sm font-semibold text-gold mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                            <i className="fas fa-skull-crossbones text-gray-400"></i> Death Saving Throws
                            <button onClick={resetDeathSaves} className="ml-auto text-xs px-3 py-1 rounded-lg bg-white/5 border border-border text-gray-500 hover:bg-white/10 cursor-pointer">Reset</button>
                        </h3>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-sm text-green-400 mb-2">Successes</p>
                                <div className="flex gap-2">
                                    {[0, 1, 2].map(i => (
                                        <div key={i} onClick={() => addDeathSave('success')} className={`w-7 h-7 rounded-full border-2 border-green-500 cursor-pointer transition-all hover:scale-110 ${i < deaths.successes ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : ''}`}></div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-sm text-red-400 mb-2">Failures</p>
                                <div className="flex gap-2">
                                    {[0, 1, 2].map(i => (
                                        <div key={i} onClick={() => addDeathSave('failure')} className={`w-7 h-7 rounded-full border-2 border-red-500 cursor-pointer transition-all hover:scale-110 ${i < deaths.failures ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : ''}`}></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {deaths.failures >= 3 && <div className="mt-3 text-sm text-red-400 font-bold">Karakter Mati! ☠</div>}
                        {deaths.successes >= 3 && <div className="mt-3 text-sm text-green-400 font-bold">Stabil! Karakter selamat.</div>}
                    </div>
                </div>
            )}
        </div>
    )
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  MUSIC TAB                                                   ║
// ╚══════════════════════════════════════════════════════════════╝
function VisualizerBars({ active }) {
    return (
        <div className="flex items-end gap-[3px] h-5">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="w-[3px] rounded-full transition-all"
                    style={{ backgroundColor: 'var(--color-gold)', height: active ? `${8 + Math.random() * 12}px` : '4px', animation: active ? `barPulse ${0.4 + i * 0.1}s ease-in-out infinite alternate` : 'none' }} />
            ))}
        </div>
    )
}

function MusicTab({ emit, musicState, users: roomUsers }) {
    const playerRef = useRef(null)
    const playerContainerRef = useRef(null)
    const progressInterval = useRef(null)
    const ignoreNextStateChange = useRef(false)
    const lastSyncedIndex = useRef(-1)

    const [urlInput, setUrlInput] = useState('')
    const [volume, setVolume] = useState(80)
    const [progress, setProgress] = useState(0)
    const [duration, setDuration] = useState(0)
    const [error, setError] = useState('')
    const [videoTitle, setVideoTitle] = useState('')

    const { queue, currentIndex, isPlaying, repeat: repeatMode, shuffle } = musicState
    const currentTrack = queue[currentIndex]

    // YouTube IFrame API
    useEffect(() => {
        if (window.YT && window.YT.Player) return
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        document.head.appendChild(tag)
    }, [])

    const createPlayer = useCallback((videoId) => {
        if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null }
        if (!videoId || !playerContainerRef.current) return
        const waitForYT = () => {
            if (window.YT && window.YT.Player) {
                playerRef.current = new window.YT.Player(playerContainerRef.current, {
                    height: '180', width: '320', videoId,
                    playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1 },
                    events: {
                        onReady: (e) => e.target.setVolume(volume),
                        onStateChange: (e) => {
                            if (ignoreNextStateChange.current) { ignoreNextStateChange.current = false; return }
                            if (e.data === window.YT.PlayerState.ENDED) emit('playback:ended')
                        },
                    },
                })
            } else setTimeout(waitForYT, 200)
        }
        waitForYT()
    }, [volume, emit])

    // Sync player with state
    useEffect(() => {
        if (!currentTrack) { if (playerRef.current) playerRef.current.stopVideo?.(); setVideoTitle(''); return }
        const videoId = currentTrack.videoId

        if (lastSyncedIndex.current !== currentIndex || !playerRef.current) {
            lastSyncedIndex.current = currentIndex; setVideoTitle(currentTrack.title)
            if (!playerRef.current) createPlayer(videoId)
            else { ignoreNextStateChange.current = true; playerRef.current.loadVideoById(videoId, musicState.currentTime || 0) }
            if (!isPlaying && playerRef.current) setTimeout(() => playerRef.current?.pauseVideo?.(), 500)
            return
        }

        if (playerRef.current?.getPlayerState) {
            const ytState = playerRef.current.getPlayerState()
            if (isPlaying && ytState !== 1) playerRef.current.playVideo()
            else if (!isPlaying && ytState === 1) playerRef.current.pauseVideo()
            const playerTime = playerRef.current.getCurrentTime?.() || 0
            if (Math.abs(playerTime - musicState.currentTime) > 3) playerRef.current.seekTo(musicState.currentTime, true)
        }
        setVideoTitle(currentTrack.title)
    }, [musicState, createPlayer])

    // Progress tracking
    useEffect(() => {
        if (progressInterval.current) clearInterval(progressInterval.current)
        progressInterval.current = setInterval(() => {
            if (playerRef.current?.getCurrentTime && playerRef.current?.getDuration) {
                setProgress(playerRef.current.getCurrentTime())
                setDuration(playerRef.current.getDuration())
            }
        }, 500)
        return () => clearInterval(progressInterval.current)
    }, [])

    useEffect(() => { if (playerRef.current?.setVolume) playerRef.current.setVolume(volume) }, [volume])

    const addToQueue = async () => {
        const videoId = extractVideoId(urlInput.trim())
        if (!videoId) { setError('Invalid YouTube URL'); return }
        setError('')
        let title = 'YouTube Video'
        try { const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`); const data = await res.json(); if (data.title) title = data.title } catch { }
        emit('queue:add', { videoId, title })
        setUrlInput('')
    }

    const inp = "bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-gold transition-colors"

    return (
        <div className="overflow-y-auto h-full">
            <style>{`@keyframes barPulse { 0% { transform: scaleY(0.4); } 100% { transform: scaleY(1); } }`}</style>
            <div className="px-6 py-5 space-y-5">
                {/* Add URL */}
                <div className="bg-bg-card border border-border rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-gold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                        <i className="fas fa-plus-circle text-gold"></i> Add Music
                    </h3>
                    <div className="flex gap-2">
                        <input value={urlInput} onChange={e => { setUrlInput(e.target.value); setError('') }} placeholder="Paste YouTube URL here..." className={`${inp} flex-1`} onKeyDown={e => e.key === 'Enter' && addToQueue()} />
                        <button onClick={addToQueue} className="px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer bg-gradient-to-r from-gold to-gold-dark text-white hover:from-gold-light hover:to-gold shadow-md transition-all"><i className="fas fa-plus mr-1"></i>Add</button>
                    </div>
                    {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                </div>

                {/* Now Playing */}
                <div className="bg-bg-card border border-border-gold rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-gold mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}><i className="fas fa-play-circle text-gold"></i> Now Playing</h3>
                    <div className="flex gap-5 flex-wrap items-start">
                        <div className="rounded-xl overflow-hidden border-2 border-gold-dark/40 shadow-lg bg-black flex-shrink-0" style={{ width: 320, height: 180 }}>
                            <div ref={playerContainerRef}></div>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <div className="flex items-center gap-3 mb-3">
                                <VisualizerBars active={isPlaying} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-lg font-semibold text-gold-light truncate" style={{ fontFamily: 'var(--font-display)' }}>{currentTrack ? videoTitle || currentTrack.title : 'No track selected'}</p>
                                    {currentTrack && <p className="text-xs text-gray-500 mt-0.5">Added by {currentTrack.addedBy}</p>}
                                </div>
                            </div>
                            {/* Progress */}
                            <div className="mb-4">
                                <input type="range" min={0} max={duration || 1} value={progress} step={0.5}
                                    onChange={e => { const t = parseFloat(e.target.value); setProgress(t); emit('playback:seek', { time: t }) }}
                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                    style={{ background: `linear-gradient(to right, var(--color-gold) ${(progress / (duration || 1)) * 100}%, var(--color-border) ${(progress / (duration || 1)) * 100}%)` }} />
                                <div className="flex justify-between text-[10px] text-gray-600 mt-1"><span>{formatTime(progress)}</span><span>{formatTime(duration)}</span></div>
                            </div>
                            {/* Controls */}
                            <div className="flex items-center justify-center gap-3">
                                <button onClick={() => emit('playback:shuffle', { enabled: !shuffle })} className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all text-xs ${shuffle ? 'text-gold bg-gold/10' : 'text-gray-600 hover:text-gray-400'}`}><i className="fas fa-random"></i></button>
                                <button onClick={() => emit('playback:skip', { direction: 'prev' })} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer text-gray-300 hover:text-gold transition-colors"><i className="fas fa-step-backward"></i></button>
                                <button onClick={() => emit(isPlaying ? 'playback:pause' : 'playback:play', isPlaying ? { currentTime: progress } : undefined)}
                                    className="w-12 h-12 rounded-full flex items-center justify-center cursor-pointer bg-gradient-to-br from-gold to-gold-dark text-white shadow-lg hover:from-gold-light hover:to-gold transition-all hover:scale-105 active:scale-95">
                                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} ${isPlaying ? '' : 'ml-0.5'}`}></i>
                                </button>
                                <button onClick={() => emit('playback:skip', { direction: 'next' })} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer text-gray-300 hover:text-gold transition-colors"><i className="fas fa-step-forward"></i></button>
                                <button onClick={() => { const modes = ['none', 'all', 'one']; const next = modes[(modes.indexOf(repeatMode) + 1) % 3]; emit('playback:repeat', { mode: next }) }}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all text-xs relative ${repeatMode !== 'none' ? 'text-gold bg-gold/10' : 'text-gray-600 hover:text-gray-400'}`}>
                                    <i className="fas fa-redo"></i>{repeatMode === 'one' && <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold text-gold">1</span>}
                                </button>
                            </div>
                            {/* Volume */}
                            <div className="flex items-center gap-2 mt-4">
                                <i className={`fas ${volume === 0 ? 'fa-volume-mute' : volume < 50 ? 'fa-volume-down' : 'fa-volume-up'} text-gray-500 text-xs cursor-pointer`} onClick={() => setVolume(v => v === 0 ? 80 : 0)}></i>
                                <input type="range" min={0} max={100} value={volume} onChange={e => setVolume(parseInt(e.target.value))}
                                    className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                                    style={{ background: `linear-gradient(to right, var(--color-gold) ${volume}%, var(--color-border) ${volume}%)` }} />
                                <span className="text-[10px] text-gray-600 w-7 text-right">{volume}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Queue */}
                <div className="bg-bg-card border border-border rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-gold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                        <i className="fas fa-list text-gold"></i> Queue ({queue.length})
                        {queue.length > 0 && <button onClick={() => emit('queue:clear')} className="ml-auto text-xs px-3 py-1 rounded-lg bg-white/5 border border-border text-gray-500 hover:bg-white/10 cursor-pointer transition-all">Clear All</button>}
                    </h3>
                    {queue.length === 0 ? (
                        <div className="text-center py-10 text-gray-700"><i className="fas fa-music text-4xl mb-3 block opacity-30"></i><p className="text-sm">Queue is empty — add a YouTube link above</p></div>
                    ) : (
                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                            {queue.map((track, i) => (
                                <div key={`${track.videoId}-${track.addedAt}-${i}`} onClick={() => emit('playback:select', { index: i })}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all group ${i === currentIndex ? 'bg-gold/10 border border-gold/30' : 'hover:bg-white/5 border border-transparent'}`}>
                                    <div className="w-7 text-center">{i === currentIndex && isPlaying ? <VisualizerBars active /> : <span className="text-xs text-gray-600 font-mono">{i + 1}</span>}</div>
                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-bg-input flex-shrink-0"><img src={`https://img.youtube.com/vi/${track.videoId}/default.jpg`} alt="" className="w-full h-full object-cover" /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm truncate ${i === currentIndex ? 'text-gold-light font-semibold' : 'text-gray-300'}`}>{track.title}</p>
                                        <p className="text-[10px] text-gray-600">by {track.addedBy}</p>
                                    </div>
                                    <button onClick={e => { e.stopPropagation(); emit('queue:remove', { index: i }) }}
                                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-950/50 cursor-pointer transition-all">
                                        <i className="fas fa-times text-xs"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
