import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useToast } from '../components/Toast'
import api from '../api'
import MapCanvas from '../components/map/MapCanvas'
import MapToolbar from '../components/map/MapToolbar'

const SOCKET_URL = import.meta.env.VITE_API_URL || ''

// ── Constants ──
const CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious']
const STAT_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
const STAT_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
const STAT_COLORS = ['text-stat-str', 'text-stat-dex', 'text-stat-con', 'text-stat-int', 'text-stat-wis', 'text-stat-cha']
const mod = s => Math.floor((s - 10) / 2)
const fm = m => (m >= 0 ? `+${m}` : `${m}`)

function extractVideoId(url) {
    if (!url) return null
    const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/, /^([a-zA-Z0-9_-]{11})$/]
    for (const p of patterns) { const m = url.match(p); if (m) return m[1] }
    return null
}
function formatTime(s) { if (!s || isNaN(s)) return '0:00'; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}` }

// ╔══════════════════════════════════════════════════════╗
// ║  MAIN GAME ROOM                                      ║
// ╚══════════════════════════════════════════════════════╝
export default function GameRoom() {
    const toast = useToast()
    const socketRef = useRef(null)
    const [phase, setPhase] = useState('lobby')
    const [name, setName] = useState('')
    const [joinCode, setJoinCode] = useState('')
    const [isGM, setIsGM] = useState(false)
    const [roomCode, setRoomCode] = useState('')
    const [usersOpen, setUsersOpen] = useState(true)
    const [rightPanel, setRightPanel] = useState('session') // session | music

    // Music state
    const [musicState, setMusicState] = useState({ queue: [], currentIndex: -1, isPlaying: false, currentTime: 0, repeat: 'none', shuffle: false })
    // Map state
    const [mapState, setMapState] = useState({ mapImage: null, gridConfig: { enabled: true, size: 50, color: 'rgba(255,255,255,0.15)' }, tokens: [], fogAreas: [] })
    const [selectedTool, setSelectedTool] = useState('select')
    const stageRef = useRef(null)
    // Session state
    const [sessionState, setSessionState] = useState({ sessions: [] })
    // Users
    const [users, setUsers] = useState([])

    // ── Socket ──
    useEffect(() => {
        const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
        socketRef.current = s
        s.on('room:state', ({ users: u }) => setUsers(u || []))
        s.on('music:state', (ms) => setMusicState(ms))
        s.on('map:state', (ms) => setMapState(prev => ({ ...prev, ...ms })))
        s.on('map:tokenMoved', ({ tokenId, x, y }) => setMapState(prev => ({ ...prev, tokens: prev.tokens.map(t => t.id === tokenId ? { ...t, x, y } : t) })))
        s.on('session:state', (ss) => setSessionState(ss))
        return () => { s.disconnect() }
    }, [])

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

    // ── ROOM VIEW (everything always mounted) ──
    return (
        <div className="flex flex-col" style={{ height: 'calc(100vh - 60px)' }}>
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-bg-surface border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gold tracking-[3px]">{roomCode}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isGM ? 'bg-gold/20 text-gold' : 'bg-blue-950 text-blue-300'}`}>{isGM ? 'GM' : 'Player'}</span>
                    <button onClick={() => setUsersOpen(p => !p)} className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer transition-colors">
                        <i className="fas fa-users mr-1"></i>{users.length} online
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    {/* Right panel toggle */}
                    <button onClick={() => setRightPanel('session')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${rightPanel === 'session' ? 'bg-gold/20 text-gold border border-gold/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}>
                        <i className="fas fa-dragon mr-1"></i>Session
                    </button>
                    <button onClick={() => setRightPanel('music')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${rightPanel === 'music' ? 'bg-gold/20 text-gold border border-gold/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}>
                        <i className="fas fa-music mr-1"></i>Music
                    </button>
                    <div className="w-px h-5 bg-border mx-2"></div>
                    <button onClick={() => { navigator.clipboard.writeText(roomCode); toast('Kode disalin!') }} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-border text-gray-400 hover:bg-white/10 cursor-pointer">
                        <i className="fas fa-copy mr-1"></i>Copy
                    </button>
                    <button onClick={leaveRoom} className="text-xs px-3 py-1.5 rounded-lg bg-red-950 text-red-300 hover:bg-red-900 cursor-pointer">
                        <i className="fas fa-sign-out-alt mr-1"></i>Leave
                    </button>
                </div>
            </div>

            {/* Main layout: map (center) + sidebar (right) */}
            <div className="flex flex-1 overflow-hidden relative">
                {/* Map toolbar (GM only) */}
                {isGM && (
                    <MapToolbar
                        selectedTool={selectedTool} setSelectedTool={setSelectedTool} isGM={isGM}
                        onUploadMap={(d) => emit('map:setMap', { mapImage: d })}
                        onAddToken={(t) => emit('map:addToken', { token: t })}
                        onClearFog={() => emit('map:clearFog')}
                        gridConfig={mapState.gridConfig}
                        onGridToggle={() => emit('map:gridConfig', { gridConfig: { ...mapState.gridConfig, enabled: !mapState.gridConfig.enabled } })}
                        onGridSizeChange={(s) => emit('map:gridConfig', { gridConfig: { ...mapState.gridConfig, size: s } })}
                    />
                )}

                {/* Map canvas (always visible, center) */}
                <MapCanvas
                    mapImage={mapState.mapImage} gridConfig={mapState.gridConfig} tokens={mapState.tokens} fogAreas={mapState.fogAreas}
                    isGM={isGM} selectedTool={isGM ? selectedTool : 'pan'} stageRef={stageRef}
                    onTokenMove={(id, x, y) => emit('map:moveToken', { tokenId: id, x, y })}
                    onAddFog={(f) => emit('map:addFog', { fog: f })}
                    onToggleFog={(id) => emit('map:toggleFog', { fogId: id })}
                />

                {/* Right sidebar — Session or Music (always mounted, toggled via display) */}
                <div className="w-[380px] shrink-0 border-l border-border flex flex-col bg-bg-surface overflow-hidden">
                    {/* Session panel (always mounted) */}
                    <div className={`flex-1 overflow-y-auto ${rightPanel === 'session' ? '' : 'hidden'}`}>
                        <SessionPanel emit={emit} sessionState={sessionState} toast={toast} />
                    </div>
                    {/* Music panel (always mounted) */}
                    <div className={`flex-1 overflow-y-auto ${rightPanel === 'music' ? '' : 'hidden'}`}>
                        <MusicPanel emit={emit} musicState={musicState} />
                    </div>
                </div>

                {/* Users overlay (collapsible) */}
                {usersOpen && (
                    <div className="absolute right-[392px] top-2 w-40 bg-bg-card/95 border border-border rounded-xl p-3 backdrop-blur-sm z-20 shadow-xl">
                        <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Online</p>
                            <button onClick={() => setUsersOpen(false)} className="text-gray-600 hover:text-gray-400 cursor-pointer text-xs"><i className="fas fa-times"></i></button>
                        </div>
                        {users.map((u, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs py-1">
                                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                <span className={u.isGM ? 'text-gold font-semibold' : 'text-gray-300'}>{u.name}</span>
                                {u.isGM && <span className="text-gold/60 text-[10px]">GM</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ╔══════════════════════════════════════════════════════╗
// ║  SESSION PANEL                                       ║
// ╚══════════════════════════════════════════════════════╝
function SessionPanel({ emit, sessionState, toast }) {
    const [allKarakter, setAllKarakter] = useState([])
    const [selectedId, setSelectedId] = useState('')
    const [session, setSession] = useState(null)
    const [karakter, setKarakter] = useState(null)
    const [hpAmount, setHpAmount] = useState(5)
    const [inspiration, setInspiration] = useState(false)
    const [exhaustion, setExhaustion] = useState(0)
    const [customSlotLevel, setCustomSlotLevel] = useState(1)
    const [customSlotAmount, setCustomSlotAmount] = useState(2)

    useEffect(() => { api.getKarakter().then(r => setAllKarakter(r.data)).catch(() => { }) }, [])

    const loadedSessions = sessionState?.sessions || []

    async function startSession(force) {
        if (!selectedId) return toast('Pilih karakter', 'error')
        try {
            const res = await api.startSession(selectedId, force)
            toast(res.message)
            const kRes = await api.getKarakterById(selectedId)
            setKarakter(kRes.data); setSession(res.data); setInspiration(res.data.inspiration); setExhaustion(res.data.exhaustion)
            emit('session:loadCharacter', { karakter: { karakterId: parseInt(selectedId), nama: res.data.nama, class: res.data.class, level: res.data.level, hp: res.data.hp, spell_slots: res.data.spell_slots, conditions: res.data.conditions, death_saves: res.data.death_saves, inspiration: res.data.inspiration, exhaustion: res.data.exhaustion } })
        } catch (e) { toast(e.message, 'error') }
    }
    async function endSession() {
        if (!selectedId || !confirm('Akhiri sesi?')) return
        try { await api.endSession(selectedId); emit('session:removeCharacter', { karakterId: parseInt(selectedId) }); setSession(null); setKarakter(null); toast('Sesi berakhir') } catch (e) { toast(e.message, 'error') }
    }
    async function doUpdateHP(type) {
        if (hpAmount <= 0 && type !== 'set') return toast('Masukkan jumlah valid', 'error')
        try {
            const res = await api.updateHP(selectedId, hpAmount, type); setSession(res.data)
            emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { hp: res.data.hp } })
        } catch (e) { toast(e.message, 'error') }
    }
    async function doSetHP() {
        try { const res = await api.updateHP(selectedId, hpAmount, 'set'); setSession(res.data); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { hp: res.data.hp } }); toast(`HP diset ke ${hpAmount}`) } catch (e) { toast(e.message, 'error') }
    }
    async function clickSlot(level, isFilled) {
        try { await api.updateSpellSlot(selectedId, level, isFilled ? 'use' : 'restore', 1); const res = await api.getSession(selectedId); setSession(res.data); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { spell_slots: res.data.spell_slots } }) } catch (e) { toast(e.message, 'error') }
    }
    async function restoreAll() {
        try { for (const l of Object.keys(session?.spell_slots || {})) await api.updateSpellSlot(selectedId, parseInt(l), 'restore_all', 0); const res = await api.getSession(selectedId); setSession(res.data); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { spell_slots: res.data.spell_slots } }); toast('Spell slots dipulihkan') } catch (e) { toast(e.message, 'error') }
    }
    async function setCustomSlot() {
        try { await api.updateSpellSlot(selectedId, customSlotLevel, 'set_max', customSlotAmount); const res = await api.getSession(selectedId); setSession(res.data); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { spell_slots: res.data.spell_slots } }); toast(`Level ${customSlotLevel} → ${customSlotAmount}`) } catch (e) { toast(e.message, 'error') }
    }
    async function toggleCondition(cond) {
        const action = (session?.conditions || []).includes(cond) ? 'remove' : 'add'
        try { const res = await api.updateCondition(selectedId, cond, action); setSession(res.data); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { conditions: res.data.conditions } }) } catch (e) { toast(e.message, 'error') }
    }
    async function clearConditions() { try { const res = await api.updateCondition(selectedId, '', 'clear'); setSession(res.data); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { conditions: res.data.conditions } }) } catch (e) { toast(e.message, 'error') } }
    async function addDeathSave(type) { try { const res = await api.updateDeathSave(selectedId, type, 'add'); setSession(res.data); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { death_saves: res.data.death_saves } }) } catch (e) { toast(e.message, 'error') } }
    async function resetDeathSaves() { try { const res = await api.updateDeathSave(selectedId, '', 'reset'); setSession(res.data); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { death_saves: res.data.death_saves } }) } catch (e) { toast(e.message, 'error') } }
    async function toggleInspiration() { const next = !inspiration; setInspiration(next); try { await api.updateMisc(selectedId, { inspiration: next }); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { inspiration: next } }); toast(next ? 'Inspiration!' : 'Used') } catch (e) { toast(e.message, 'error') } }
    async function changeExhaustion(d) { const next = Math.max(0, Math.min(6, exhaustion + d)); setExhaustion(next); try { await api.updateMisc(selectedId, { exhaustion: next }); emit('session:updateCharacter', { karakterId: parseInt(selectedId), updates: { exhaustion: next } }) } catch (e) { toast(e.message, 'error') } }

    const hp = session?.hp || { current: 0, max: 0, temp: 0 }
    const hpPct = hp.max > 0 ? Math.round((hp.current / hp.max) * 100) : 0
    const hpColor = hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-red-500'
    const spellEntries = Object.entries(session?.spell_slots || {})
    const deaths = session?.death_saves || { successes: 0, failures: 0 }
    const inp = "bg-bg-input border border-border rounded-lg px-2.5 py-2 text-xs text-gray-200 outline-none focus:border-gold transition-colors"
    const btn = (base) => `px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${base}`

    return (
        <div className="p-3 space-y-3">
            {/* Selector */}
            <div className="space-y-2">
                <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={`${inp} w-full`}>
                    <option value="">— Pilih Karakter —</option>
                    {allKarakter.map(k => <option key={k.id} value={k.id}>{k.nama_karakter} ({k.race} {k.class} Lv.{k.level})</option>)}
                </select>
                <div className="flex gap-1.5">
                    <button onClick={() => startSession(false)} className={`${btn('bg-gradient-to-r from-gold to-gold-dark text-white')} flex-1`}><i className="fas fa-play mr-1"></i>Mulai</button>
                    <button onClick={() => startSession(true)} className={btn('bg-blue-950 text-blue-300')}><i className="fas fa-redo"></i></button>
                    <button onClick={endSession} className={btn('bg-red-950 text-red-300')}><i className="fas fa-stop"></i></button>
                </div>
            </div>

            {/* Other players in room */}
            {loadedSessions.length > 0 && (
                <div className="space-y-1">
                    <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">Party</p>
                    {loadedSessions.map(s => (
                        <div key={s.charakterId || s.karakterId} className="flex items-center gap-2 bg-bg-card rounded-lg px-2.5 py-1.5 border border-border">
                            <span className="text-xs font-semibold text-gold-light truncate flex-1">{s.nama}</span>
                            <span className="text-[10px] text-gray-500">{s.class}</span>
                            {s.hp && <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${s.hp.current > s.hp.max * 0.5 ? 'bg-green-950 text-green-300' : s.hp.current > s.hp.max * 0.25 ? 'bg-amber-950 text-amber-300' : 'bg-red-950 text-red-300'}`}>{s.hp.current}/{s.hp.max}</span>}
                        </div>
                    ))}
                </div>
            )}

            {!session ? (
                <div className="text-center py-8 text-gray-700">
                    <i className="fas fa-dragon text-3xl mb-2 block opacity-40"></i>
                    <p className="text-xs">Pilih karakter dan <span className="text-gold">Mulai</span> sesi</p>
                </div>
            ) : (
                <>
                    {/* Character header */}
                    <div className="bg-bg-card border border-border rounded-xl p-3">
                        <div className="flex items-center gap-3">
                            {karakter?.gambar_url ? <img src={karakter.gambar_url} className="w-10 h-10 rounded-lg object-cover border border-gold-dark" /> : <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-bg-input text-gray-600">⚔</div>}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-gold-light" style={{ fontFamily: 'var(--font-display)' }}>{session.nama}</div>
                                <div className="text-[10px] text-gray-500">{session.class} · Lv.{session.level}</div>
                            </div>
                            <button onClick={toggleInspiration} className={`p-1.5 rounded-lg text-[10px] cursor-pointer border ${inspiration ? 'border-gold bg-gold/10 text-gold' : 'border-border text-gray-600'}`}>✦</button>
                        </div>
                        {karakter?.strength != null && (
                            <div className="grid grid-cols-6 gap-1 mt-2">
                                {STAT_KEYS.map((s, i) => (
                                    <div key={s} className="bg-bg-input rounded p-1 text-center">
                                        <div className={`text-[8px] font-bold ${STAT_COLORS[i]}`}>{STAT_LABELS[i]}</div>
                                        <div className="text-xs font-bold">{karakter[s] ?? '—'}</div>
                                        <div className="text-[9px] text-gray-500">{karakter[s] != null ? fm(mod(karakter[s])) : ''}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* HP */}
                    <div className="bg-bg-card border border-border rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <i className="fas fa-heart text-red-400 text-xs"></i>
                            <span className="text-lg font-bold">{hp.current}</span>
                            <span className="text-xs text-gray-500">/ {hp.max}</span>
                            {hp.temp > 0 && <span className="text-[10px] text-blue-400">+{hp.temp}</span>}
                        </div>
                        <div className="h-3 rounded-full bg-bg-input overflow-hidden mb-2">
                            <div className={`h-full rounded-full transition-all duration-500 ${hpColor}`} style={{ width: `${Math.max(0, Math.min(100, hpPct))}%` }}></div>
                        </div>
                        <div className="flex gap-1.5">
                            <input type="number" value={hpAmount} onChange={e => setHpAmount(parseInt(e.target.value) || 0)} className={`${inp} w-14 text-center`} min="0" />
                            <button onClick={() => doUpdateHP('damage')} className={`${btn('bg-red-950 text-red-300')} flex-1`}>Dmg</button>
                            <button onClick={() => doUpdateHP('heal')} className={`${btn('bg-green-950 text-green-300')} flex-1`}>Heal</button>
                            <button onClick={() => doUpdateHP('temp')} className={btn('bg-blue-950 text-blue-300')}>Tmp</button>
                            <button onClick={doSetHP} className={btn('bg-white/5 border border-border text-gray-400')}>Set</button>
                        </div>
                    </div>

                    {/* Spell Slots */}
                    <div className="bg-bg-card border border-border rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <i className="fas fa-magic text-purple-400 text-xs"></i>
                            <span className="text-xs font-semibold text-gold">Spell Slots</span>
                            <button onClick={restoreAll} className="ml-auto text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 cursor-pointer">Restore</button>
                        </div>
                        <div className="space-y-1.5">
                            {spellEntries.length === 0 ? <p className="text-[10px] text-gray-600">No slots</p> : spellEntries.map(([level, { current, max }]) => (
                                <div key={level} className="flex items-center gap-2">
                                    <span className="text-[10px] text-purple-300 w-8 shrink-0 font-semibold">Lv{level}</span>
                                    <div className="flex gap-1 flex-wrap">
                                        {Array.from({ length: max }, (_, i) => (
                                            <div key={i} onClick={() => clickSlot(parseInt(level), i < current)}
                                                className={`w-4 h-4 rounded-full border-2 cursor-pointer transition-all hover:scale-110 ${i < current ? 'border-purple-400 bg-purple-600' : 'border-purple-900'}`}></div>
                                        ))}
                                    </div>
                                    <span className="text-[10px] text-gray-600">{current}/{max}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-1 mt-2 pt-2 border-t border-border">
                            <select value={customSlotLevel} onChange={e => setCustomSlotLevel(parseInt(e.target.value))} className={`${inp} w-16`}>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => <option key={l} value={l}>Lv{l}</option>)}
                            </select>
                            <input type="number" value={customSlotAmount} onChange={e => setCustomSlotAmount(parseInt(e.target.value) || 0)} className={`${inp} w-10 text-center`} min="0" max="10" />
                            <button onClick={setCustomSlot} className={btn('bg-purple-950 text-purple-300')}>Set</button>
                        </div>
                    </div>

                    {/* Conditions */}
                    <div className="bg-bg-card border border-border rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <i className="fas fa-biohazard text-amber-400 text-xs"></i>
                            <span className="text-xs font-semibold text-gold">Conditions</span>
                            <button onClick={clearConditions} className="ml-auto text-[10px] px-2 py-0.5 rounded bg-white/5 border border-border text-gray-500 cursor-pointer">Clear</button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {CONDITIONS.map(c => {
                                const on = (session?.conditions || []).includes(c)
                                return <button key={c} onClick={() => toggleCondition(c)} className={`px-2 py-0.5 rounded-full text-[10px] cursor-pointer border transition-all ${on ? 'bg-red-950 border-red-500 text-red-300' : 'bg-bg-input border-border text-gray-500'}`}>{c}</button>
                            })}
                        </div>
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                            <span className="text-[10px] text-gray-500">Exhaustion: <span className="text-gold font-bold">{exhaustion}</span>/6</span>
                            <button onClick={() => changeExhaustion(-1)} className="w-5 h-5 rounded flex items-center justify-center bg-blue-950 text-blue-300 text-[10px] cursor-pointer">−</button>
                            <button onClick={() => changeExhaustion(1)} className="w-5 h-5 rounded flex items-center justify-center bg-red-950 text-red-300 text-[10px] cursor-pointer">+</button>
                        </div>
                    </div>

                    {/* Death Saves */}
                    <div className="bg-bg-card border border-border rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                            <i className="fas fa-skull-crossbones text-gray-400 text-xs"></i>
                            <span className="text-xs font-semibold text-gold">Death Saves</span>
                            <button onClick={resetDeathSaves} className="ml-auto text-[10px] px-2 py-0.5 rounded bg-white/5 border border-border text-gray-500 cursor-pointer">Reset</button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className="text-[10px] text-green-400 mb-1">Successes</p>
                                <div className="flex gap-1.5">{[0, 1, 2].map(i => <div key={i} onClick={() => addDeathSave('success')} className={`w-5 h-5 rounded-full border-2 border-green-500 cursor-pointer ${i < deaths.successes ? 'bg-green-500' : ''}`}></div>)}</div>
                            </div>
                            <div>
                                <p className="text-[10px] text-red-400 mb-1">Failures</p>
                                <div className="flex gap-1.5">{[0, 1, 2].map(i => <div key={i} onClick={() => addDeathSave('failure')} className={`w-5 h-5 rounded-full border-2 border-red-500 cursor-pointer ${i < deaths.failures ? 'bg-red-500' : ''}`}></div>)}</div>
                            </div>
                        </div>
                        {deaths.failures >= 3 && <div className="mt-1 text-[10px] text-red-400 font-bold">Karakter Mati! ☠</div>}
                        {deaths.successes >= 3 && <div className="mt-1 text-[10px] text-green-400 font-bold">Stabil!</div>}
                    </div>
                </>
            )}
        </div>
    )
}

// ╔══════════════════════════════════════════════════════╗
// ║  MUSIC PANEL                                         ║
// ╚══════════════════════════════════════════════════════╝
function VisualizerBars({ active }) {
    return (
        <div className="flex items-end gap-[2px] h-4">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-[2px] rounded-full" style={{ backgroundColor: 'var(--color-gold)', height: active ? `${6 + Math.random() * 10}px` : '3px', animation: active ? `barPulse ${0.4 + i * 0.1}s ease-in-out infinite alternate` : 'none' }} />)}
        </div>
    )
}

function MusicPanel({ emit, musicState }) {
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

    useEffect(() => { if (window.YT && window.YT.Player) return; const tag = document.createElement('script'); tag.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(tag) }, [])

    const createPlayer = useCallback((videoId) => {
        if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null }
        if (!videoId || !playerContainerRef.current) return
        const waitForYT = () => {
            if (window.YT && window.YT.Player) {
                playerRef.current = new window.YT.Player(playerContainerRef.current, {
                    height: '140', width: '100%', videoId,
                    playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1 },
                    events: {
                        onReady: (e) => e.target.setVolume(volume),
                        onStateChange: (e) => { if (ignoreNextStateChange.current) { ignoreNextStateChange.current = false; return }; if (e.data === window.YT.PlayerState.ENDED) emit('playback:ended') },
                    },
                })
            } else setTimeout(waitForYT, 200)
        }
        waitForYT()
    }, [volume, emit])

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

    useEffect(() => { if (progressInterval.current) clearInterval(progressInterval.current); progressInterval.current = setInterval(() => { if (playerRef.current?.getCurrentTime && playerRef.current?.getDuration) { setProgress(playerRef.current.getCurrentTime()); setDuration(playerRef.current.getDuration()) } }, 500); return () => clearInterval(progressInterval.current) }, [])
    useEffect(() => { if (playerRef.current?.setVolume) playerRef.current.setVolume(volume) }, [volume])

    const addToQueue = async () => {
        const videoId = extractVideoId(urlInput.trim())
        if (!videoId) { setError('Invalid URL'); return }
        setError('')
        let title = 'YouTube Video'
        try { const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`); const data = await res.json(); if (data.title) title = data.title } catch { }
        emit('queue:add', { videoId, title }); setUrlInput('')
    }

    const inp = "bg-bg-input border border-border rounded-lg px-2.5 py-2 text-xs text-gray-200 outline-none focus:border-gold transition-colors"

    return (
        <div className="p-3 space-y-3">
            <style>{`@keyframes barPulse { 0% { transform: scaleY(0.4); } 100% { transform: scaleY(1); } }`}</style>

            {/* Add URL */}
            <div className="flex gap-1.5">
                <input value={urlInput} onChange={e => { setUrlInput(e.target.value); setError('') }} placeholder="YouTube URL..." className={`${inp} flex-1`} onKeyDown={e => e.key === 'Enter' && addToQueue()} />
                <button onClick={addToQueue} className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer bg-gradient-to-r from-gold to-gold-dark text-white"><i className="fas fa-plus"></i></button>
            </div>
            {error && <p className="text-red-400 text-[10px]">{error}</p>}

            {/* Player */}
            <div className="rounded-xl overflow-hidden border border-gold-dark/30 bg-black" style={{ height: 140 }}>
                <div ref={playerContainerRef}></div>
            </div>

            {/* Now playing info */}
            <div className="flex items-center gap-2">
                <VisualizerBars active={isPlaying} />
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gold-light truncate">{currentTrack ? videoTitle || currentTrack.title : 'No track'}</p>
                    {currentTrack && <p className="text-[10px] text-gray-600">by {currentTrack.addedBy}</p>}
                </div>
            </div>

            {/* Progress */}
            <div>
                <input type="range" min={0} max={duration || 1} value={progress} step={0.5}
                    onChange={e => { const t = parseFloat(e.target.value); setProgress(t); emit('playback:seek', { time: t }) }}
                    className="w-full h-1 rounded-full appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, var(--color-gold) ${(progress / (duration || 1)) * 100}%, var(--color-border) ${(progress / (duration || 1)) * 100}%)` }} />
                <div className="flex justify-between text-[9px] text-gray-600 mt-0.5"><span>{formatTime(progress)}</span><span>{formatTime(duration)}</span></div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
                <button onClick={() => emit('playback:shuffle', { enabled: !shuffle })} className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer text-[10px] ${shuffle ? 'text-gold bg-gold/10' : 'text-gray-600'}`}><i className="fas fa-random"></i></button>
                <button onClick={() => emit('playback:skip', { direction: 'prev' })} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer text-gray-300 hover:text-gold text-xs"><i className="fas fa-step-backward"></i></button>
                <button onClick={() => emit(isPlaying ? 'playback:pause' : 'playback:play', isPlaying ? { currentTime: progress } : undefined)}
                    className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer bg-gradient-to-br from-gold to-gold-dark text-white shadow-lg hover:scale-105 active:scale-95 transition-all">
                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-sm ${isPlaying ? '' : 'ml-0.5'}`}></i>
                </button>
                <button onClick={() => emit('playback:skip', { direction: 'next' })} className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer text-gray-300 hover:text-gold text-xs"><i className="fas fa-step-forward"></i></button>
                <button onClick={() => { const modes = ['none', 'all', 'one']; emit('playback:repeat', { mode: modes[(modes.indexOf(repeatMode) + 1) % 3] }) }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer text-[10px] relative ${repeatMode !== 'none' ? 'text-gold bg-gold/10' : 'text-gray-600'}`}>
                    <i className="fas fa-redo"></i>{repeatMode === 'one' && <span className="absolute -top-0.5 -right-0.5 text-[7px] font-bold text-gold">1</span>}
                </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-1.5">
                <i className={`fas ${volume === 0 ? 'fa-volume-mute' : 'fa-volume-up'} text-gray-600 text-[10px] cursor-pointer`} onClick={() => setVolume(v => v === 0 ? 80 : 0)}></i>
                <input type="range" min={0} max={100} value={volume} onChange={e => setVolume(parseInt(e.target.value))}
                    className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, var(--color-gold) ${volume}%, var(--color-border) ${volume}%)` }} />
                <span className="text-[9px] text-gray-600 w-6 text-right">{volume}%</span>
            </div>

            {/* Queue */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-gold">Queue ({queue.length})</span>
                    {queue.length > 0 && <button onClick={() => emit('queue:clear')} className="ml-auto text-[10px] px-2 py-0.5 rounded bg-white/5 border border-border text-gray-500 cursor-pointer">Clear</button>}
                </div>
                {queue.length === 0 ? (
                    <p className="text-[10px] text-gray-600 text-center py-4">Queue empty</p>
                ) : (
                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        {queue.map((track, i) => (
                            <div key={`${track.videoId}-${i}`} onClick={() => emit('playback:select', { index: i })}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group ${i === currentIndex ? 'bg-gold/10 border border-gold/30' : 'hover:bg-white/5 border border-transparent'}`}>
                                <div className="w-5 text-center">{i === currentIndex && isPlaying ? <VisualizerBars active /> : <span className="text-[10px] text-gray-600">{i + 1}</span>}</div>
                                <div className="w-8 h-8 rounded overflow-hidden bg-bg-input shrink-0"><img src={`https://img.youtube.com/vi/${track.videoId}/default.jpg`} alt="" className="w-full h-full object-cover" /></div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[11px] truncate ${i === currentIndex ? 'text-gold-light font-semibold' : 'text-gray-300'}`}>{track.title}</p>
                                    <p className="text-[9px] text-gray-600">{track.addedBy}</p>
                                </div>
                                <button onClick={e => { e.stopPropagation(); emit('queue:remove', { index: i }) }} className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 cursor-pointer text-[10px]"><i className="fas fa-times"></i></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
