import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../components/Toast'
import api from '../api'

const CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious']
const STAT_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
const STAT_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
const STAT_ABBR = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const STAT_COLORS = ['text-stat-str', 'text-stat-dex', 'text-stat-con', 'text-stat-int', 'text-stat-wis', 'text-stat-cha']
const mod = s => Math.floor((s - 10) / 2)
const fm = m => (m >= 0 ? `+${m}` : `${m}`)

export default function Session() {
    const toast = useToast()
    const [params] = useSearchParams()
    const [allKarakter, setAllKarakter] = useState([])
    const [selectedId, setSelectedId] = useState(params.get('karakter_id') || '')
    const [session, setSession] = useState(null)
    const [karakter, setKarakter] = useState(null)
    const [hpAmount, setHpAmount] = useState(5)
    const [inspiration, setInspiration] = useState(false)
    const [exhaustion, setExhaustion] = useState(0)
    const [customSlotLevel, setCustomSlotLevel] = useState(1)
    const [customSlotAmount, setCustomSlotAmount] = useState(2)

    useEffect(() => {
        api.getKarakter().then(r => {
            setAllKarakter(r.data)
            const kid = params.get('karakter_id')
            if (kid) {
                setSelectedId(kid)
                api.getSession(kid).then(r => {
                    if (r.data) {
                        setSession(r.data)
                        setInspiration(r.data.inspiration)
                        setExhaustion(r.data.exhaustion)
                        api.getKarakterById(kid).then(kr => setKarakter(kr.data)).catch(() => { })
                    }
                }).catch(() => { })
            }
        }).catch(e => toast(e.message, 'error'))
    }, [])

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
        } catch (e) { toast(e.message, 'error') }
    }

    async function endSession() {
        if (!selectedId || !confirm('Akhiri sesi bermain?')) return
        try {
            await api.endSession(selectedId)
            setSession(null)
            setKarakter(null)
            toast('Sesi berakhir')
        } catch (e) { toast(e.message, 'error') }
    }

    async function doUpdateHP(type) {
        const amt = hpAmount
        if (amt <= 0 && type !== 'set') return toast('Masukkan jumlah yang valid', 'error')
        try {
            const res = await api.updateHP(selectedId, amt, type)
            setSession(res.data)
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
            toast(`HP diset ke ${hpAmount}`)
        } catch (e) { toast(e.message, 'error') }
    }

    async function clickSlot(level, isFilled) {
        try {
            await api.updateSpellSlot(selectedId, level, isFilled ? 'use' : 'restore', 1)
            const res = await api.getSession(selectedId)
            setSession(res.data)
        } catch (e) { toast(e.message, 'error') }
    }

    async function restoreAll() {
        try {
            for (const level of Object.keys(session?.spell_slots || {})) {
                await api.updateSpellSlot(selectedId, parseInt(level), 'restore_all', 0)
            }
            const res = await api.getSession(selectedId)
            setSession(res.data)
            toast('Semua spell slots dipulihkan')
        } catch (e) { toast(e.message, 'error') }
    }

    async function setCustomSlot() {
        try {
            await api.updateSpellSlot(selectedId, customSlotLevel, 'set_max', customSlotAmount)
            const res = await api.getSession(selectedId)
            setSession(res.data)
            toast(`Spell slot level ${customSlotLevel} diset ke ${customSlotAmount}`)
        } catch (e) { toast(e.message, 'error') }
    }

    async function toggleCondition(cond) {
        const active = session?.conditions || []
        const action = active.includes(cond) ? 'remove' : 'add'
        try {
            const res = await api.updateCondition(selectedId, cond, action)
            setSession(res.data)
        } catch (e) { toast(e.message, 'error') }
    }

    async function clearConditions() {
        try { const res = await api.updateCondition(selectedId, '', 'clear'); setSession(res.data) } catch (e) { toast(e.message, 'error') }
    }

    async function addDeathSave(type) {
        try { const res = await api.updateDeathSave(selectedId, type, 'add'); setSession(res.data) } catch (e) { toast(e.message, 'error') }
    }

    async function resetDeathSaves() {
        try { const res = await api.updateDeathSave(selectedId, '', 'reset'); setSession(res.data) } catch (e) { toast(e.message, 'error') }
    }

    async function toggleInspiration() {
        const next = !inspiration
        setInspiration(next)
        try {
            await api.updateMisc(selectedId, { inspiration: next })
            toast(next ? 'Inspiration diperoleh!' : 'Inspiration digunakan')
        } catch (e) { toast(e.message, 'error') }
    }

    async function changeExhaustion(d) {
        const next = Math.max(0, Math.min(6, exhaustion + d))
        setExhaustion(next)
        try {
            await api.updateMisc(selectedId, { exhaustion: next })
            if (next === 6) toast('Exhaustion Level 6 — Karakter Mati!', 'error')
        } catch (e) { toast(e.message, 'error') }
    }

    const hp = session?.hp || { current: 0, max: 0, temp: 0 }
    const hpPct = hp.max > 0 ? Math.round((hp.current / hp.max) * 100) : 0
    const hpColor = hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-red-500'
    const spellEntries = Object.entries(session?.spell_slots || {})
    const deaths = session?.death_saves || { successes: 0, failures: 0 }

    const inp = "bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-gold transition-colors"
    const btn = (base) => `px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all ${base}`

    return (
        <>
            <div className="px-6 py-6 border-b border-border bg-gradient-to-br from-bg-surface to-bg-card">
                <h1 className="text-2xl font-bold text-gold" style={{ fontFamily: 'var(--font-display)' }}>Sesi Bermain</h1>
                <p className="text-gray-500 text-sm mt-1">Pelacak status real-time — HP, Spell Slots, Conditions (powered by Redis)</p>
            </div>

            {/* Selector */}
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
                                <div className="text-xs text-gray-600 mt-0.5">Sesi dimulai: {session.started_at ? new Date(session.started_at).toLocaleString('id-ID') : ''}</div>
                            </div>
                            <button
                                onClick={toggleInspiration}
                                className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer border transition-all ${inspiration ? 'border-gold bg-gold/10 text-gold-light font-semibold' : 'border-border text-gray-600'}`}
                            >✦ Inspiration</button>
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
                                <p className="text-sm text-gray-600">Tidak ada spell slots untuk class ini. Gunakan panel di bawah untuk menambah custom slots.</p>
                            ) : spellEntries.map(([level, { current, max }]) => (
                                <div key={level} className="flex items-center gap-3">
                                    <span className="text-xs text-purple-300 w-14 shrink-0 font-semibold">Level {level}</span>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {Array.from({ length: max }, (_, i) => (
                                            <div
                                                key={i}
                                                onClick={() => clickSlot(parseInt(level), i < current)}
                                                title={i < current ? 'Klik untuk gunakan' : 'Klik untuk pulihkan'}
                                                className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-all hover:scale-110 ${i < current
                                                        ? 'border-purple-400 bg-purple-600 shadow-[0_0_8px_rgba(124,58,237,0.4)]'
                                                        : 'border-purple-900 bg-transparent'
                                                    }`}
                                            ></div>
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
                                    <button
                                        key={c}
                                        onClick={() => toggleCondition(c)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs cursor-pointer border transition-all ${on ? 'bg-red-950 border-red-500 text-red-300' : 'bg-bg-input border-border text-gray-400 hover:border-gray-500'
                                            }`}
                                    >
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
        </>
    )
}
