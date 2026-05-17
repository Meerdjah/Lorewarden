import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import api from '../api'

const STATS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const STAT_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
const STAT_COLORS = ['text-stat-str', 'text-stat-dex', 'text-stat-con', 'text-stat-int', 'text-stat-wis', 'text-stat-cha']
const mod = s => Math.floor((s - 10) / 2)
const fm = m => (m >= 0 ? `+${m}` : `${m}`)

export default function Karakter() {
    const toast = useToast()
    const [params] = useSearchParams()
    const [pemain, setPemain] = useState([])
    const [list, setList] = useState([])
    const [filter, setFilter] = useState(params.get('pemain_id') || '')
    const [modal, setModal] = useState(false)
    const [detail, setDetail] = useState(null)
    const [editId, setEditId] = useState(null)
    const [hasAtribut, setHasAtribut] = useState(false)
    const [form, setForm] = useState({ pemain_id: '', nama_karakter: '', race: '', class: '', level: 1, max_hp: 10, background: '', alignment: '' })
    const [stats, setStats] = useState({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
    const [file, setFile] = useState(null)
    const [imgPreview, setImgPreview] = useState(null)

    async function init() {
        try {
            const res = await api.getPemain()
            setPemain(res.data)
        } catch (e) { toast(e.message, 'error') }
    }

    async function load() {
        try {
            const res = await api.getKarakter(filter || null)
            setList(res.data)
        } catch (e) { toast(e.message, 'error') }
    }

    useEffect(() => { init() }, [])
    useEffect(() => { load() }, [filter])

    useEffect(() => {
        const editInit = params.get('edit')
        if (editInit) openModal(parseInt(editInit))
    }, [pemain])

    function resetForm() {
        setForm({ pemain_id: '', nama_karakter: '', race: '', class: '', level: 1, max_hp: 10, background: '', alignment: '' })
        setStats({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
        setFile(null)
        setImgPreview(null)
        setEditId(null)
        setHasAtribut(false)
    }

    async function openModal(id = null) {
        resetForm()
        if (id) {
            try {
                const res = await api.getKarakterById(id)
                const k = res.data
                setEditId(k.id)
                setForm({ pemain_id: k.pemain_id, nama_karakter: k.nama_karakter, race: k.race, class: k.class, level: k.level, max_hp: k.max_hp, background: k.background || '', alignment: k.alignment || '' })
                if (k.gambar_url) setImgPreview(k.gambar_url)
                if (k.strength != null) {
                    setHasAtribut(true)
                    setStats({ str: k.strength, dex: k.dexterity, con: k.constitution, int: k.intelligence, wis: k.wisdom, cha: k.charisma })
                }
            } catch (e) { toast(e.message, 'error') }
        }
        setModal(true)
    }

    async function save() {
        if (!form.pemain_id || !form.nama_karakter.trim() || !form.race || !form.class) return toast('Pemain, nama, race, dan class wajib diisi', 'error')

        const fd = new FormData()
        fd.append('pemain_id', form.pemain_id)
        fd.append('nama_karakter', form.nama_karakter)
        fd.append('race', form.race)
        fd.append('class', form.class)
        fd.append('level', form.level)
        fd.append('max_hp', form.max_hp)
        fd.append('background', form.background)
        fd.append('alignment', form.alignment)
        if (file) fd.append('gambar', file)

        try {
            let karakter
            if (editId) {
                const res = await api.updateKarakter(editId, fd)
                karakter = res.data
            } else {
                const res = await api.createKarakter(fd)
                karakter = res.data
            }

            const statBody = {
                karakter_id: karakter.id,
                strength: stats.str, dexterity: stats.dex, constitution: stats.con,
                intelligence: stats.int, wisdom: stats.wis, charisma: stats.cha,
            }
            if (editId && hasAtribut) await api.updateAtribut(karakter.id, statBody)
            else await api.createAtribut(statBody).catch(() => api.updateAtribut(karakter.id, statBody))

            toast(editId ? 'Karakter diperbarui!' : 'Karakter dibuat!')
            setModal(false)
            load()
        } catch (e) { toast(e.message, 'error') }
    }

    async function hapus(id) {
        if (!confirm('Hapus karakter ini?')) return
        try { await api.deleteKarakter(id); toast('Karakter dihapus'); load() } catch (e) { toast(e.message, 'error') }
    }

    async function showDetail(id) {
        try { const res = await api.getKarakterById(id); setDetail(res.data) } catch (e) { toast(e.message, 'error') }
    }

    function handleFile(e) {
        const f = e.target.files[0]
        if (!f) return
        setFile(f)
        setImgPreview(URL.createObjectURL(f))
    }

    const races = ['Human', 'Elf', 'Dwarf', 'Halfling', 'Gnome', 'Half-Orc', 'Half-Elf', 'Tiefling', 'Dragonborn', 'Aasimar', 'Lainnya']
    const classes = ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard']
    const backgrounds = ['Acolyte', 'Criminal', 'Folk Hero', 'Noble', 'Outlander', 'Sage', 'Soldier', 'Urchin', 'Charlatan', 'Entertainer', 'Guild Artisan', 'Hermit']
    const alignments = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'True Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil']

    const inp = "w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-gold transition-colors"

    return (
        <>
            <div className="px-6 py-7 border-b border-border bg-gradient-to-br from-bg-surface to-bg-card">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gold" style={{ fontFamily: 'var(--font-display)' }}>Manajemen Karakter</h1>
                        <p className="text-gray-500 text-sm mt-1">Buat dan kelola karakter TRPG beserta atribut statistiknya</p>
                    </div>
                    <button onClick={() => openModal()} className="px-5 py-2.5 rounded-lg font-semibold text-sm bg-gradient-to-r from-gold to-gold-dark text-white hover:from-gold-light hover:to-gold transition-all shadow-md cursor-pointer">
                        <i className="fas fa-plus mr-2"></i>Buat Karakter
                    </button>
                </div>
            </div>

            {/* Filter */}
            <div className="flex gap-3 items-center px-6 py-3 bg-bg-surface border-b border-border">
                <label className="text-xs text-gray-400 font-medium">Filter Pemain:</label>
                <select value={filter} onChange={e => setFilter(e.target.value)} className={`${inp} w-48`}>
                    <option value="">Semua Pemain</option>
                    {pemain.map(p => <option key={p.id} value={p.id}>{p.username}</option>)}
                </select>
                <span className="text-xs text-gray-500">{list.length} karakter</span>
            </div>

            {/* Grid */}
            <div className="px-6 py-5">
                {list.length === 0 ? (
                    <div className="text-center py-16 text-gray-600"><i className="fas fa-scroll text-5xl mb-3 block opacity-40"></i><p>Belum ada karakter. Klik "Buat Karakter" untuk memulai.</p></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {list.map(k => (
                            <div key={k.id} className="bg-bg-card border border-border rounded-2xl overflow-hidden hover:border-border-gold hover:-translate-y-0.5 transition-all">
                                <div className="flex">
                                    {k.gambar_url
                                        ? <img src={k.gambar_url} className="w-24 h-32 object-cover shrink-0" alt={k.nama_karakter} />
                                        : <div className="w-24 h-32 shrink-0 flex items-center justify-center text-3xl bg-bg-input text-gray-700">⚔</div>
                                    }
                                    <div className="p-3 flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="font-bold text-gold-light truncate">{k.nama_karakter}</div>
                                            <div className="flex gap-0.5 shrink-0">
                                                <button onClick={() => openModal(k.id)} className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-gold cursor-pointer"><i className="fas fa-edit text-[10px]"></i></button>
                                                <button onClick={() => hapus(k.id)} className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-red-400 cursor-pointer"><i className="fas fa-trash text-[10px]"></i></button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">{k.race} · {k.class} · Lv.{k.level}</div>
                                        <div className="text-xs text-gray-600">{k.pemain_username}</div>
                                        {k.alignment && <div className="text-xs text-purple-400 mt-1">{k.alignment}</div>}
                                        <div className="text-xs text-gray-500 mt-1">HP Max: <span className="text-green-400 font-semibold">{k.max_hp}</span></div>
                                    </div>
                                </div>
                                {k.strength != null ? (
                                    <div className="grid grid-cols-6 gap-0.5 px-3 py-2.5 border-t border-border">
                                        {STATS.map((s, i) => (
                                            <div key={s} className="text-center">
                                                <div className={`text-[10px] font-bold ${STAT_COLORS[i]}`}>{STAT_LABELS[i]}</div>
                                                <div className="text-sm font-semibold">{k[s]}</div>
                                                <div className="text-[10px] text-gray-600">{fm(mod(k[s]))}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className="px-3 py-2 text-xs text-gray-700 border-t border-border">Belum ada atribut</div>}
                                <div className="flex gap-2 px-3 py-2.5 border-t border-border">
                                    <a href={`/session?karakter_id=${k.id}`} className="flex-1 text-center text-xs py-1.5 rounded-lg font-semibold bg-gradient-to-r from-gold to-gold-dark text-white hover:from-gold-light hover:to-gold transition-all"><i className="fas fa-play mr-1"></i>Mulai Sesi</a>
                                    <button onClick={() => showDetail(k.id)} className="px-3 py-1.5 rounded-lg text-xs bg-blue-950 text-blue-300 hover:bg-blue-900 cursor-pointer">Detail</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Edit Karakter' : 'Buat Karakter Baru'} wide>
                {/* Image */}
                <div className="mb-5 flex gap-4 items-center">
                    {imgPreview && <img src={imgPreview} className="w-20 h-20 object-cover rounded-xl border-2 border-border" />}
                    <div className="flex-1">
                        <label className="block text-xs text-gray-400 mb-1 font-medium">Foto Karakter</label>
                        <input type="file" accept="image/*" onChange={handleFile} className="text-sm text-gray-400" />
                        <p className="text-xs text-gray-600 mt-1">Max 5MB · JPG, PNG, GIF, WebP</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs text-gray-400 mb-1 font-medium">Pemain *</label>
                        <select value={form.pemain_id} onChange={e => setForm({ ...form, pemain_id: e.target.value })} className={inp}>
                            <option value="">Pilih Pemain</option>
                            {pemain.map(p => <option key={p.id} value={p.id}>{p.username}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1 font-medium">Nama Karakter *</label>
                        <input value={form.nama_karakter} onChange={e => setForm({ ...form, nama_karakter: e.target.value })} className={inp} placeholder="Thorin Oakenshield" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1 font-medium">Race *</label>
                        <select value={form.race} onChange={e => setForm({ ...form, race: e.target.value })} className={inp}>
                            <option value="">Pilih Race</option>
                            {races.map(r => <option key={r}>{r}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1 font-medium">Class *</label>
                        <select value={form.class} onChange={e => setForm({ ...form, class: e.target.value })} className={inp}>
                            <option value="">Pilih Class</option>
                            {classes.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1 font-medium">Level</label>
                        <input type="number" value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} className={inp} min="1" max="20" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1 font-medium">Max HP</label>
                        <input type="number" value={form.max_hp} onChange={e => setForm({ ...form, max_hp: e.target.value })} className={inp} min="1" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1 font-medium">Background</label>
                        <select value={form.background} onChange={e => setForm({ ...form, background: e.target.value })} className={inp}>
                            <option value="">Pilih Background</option>
                            {backgrounds.map(b => <option key={b}>{b}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400 mb-1 font-medium">Alignment</label>
                        <select value={form.alignment} onChange={e => setForm({ ...form, alignment: e.target.value })} className={inp}>
                            <option value="">Pilih Alignment</option>
                            {alignments.map(a => <option key={a}>{a}</option>)}
                        </select>
                    </div>
                </div>

                {/* Stats */}
                <div className="p-4 rounded-xl bg-bg-input border border-border mb-5">
                    <p className="text-sm text-gray-400 mb-3 font-semibold">Ability Scores (1–30)</p>
                    <div className="grid grid-cols-3 gap-3">
                        {STAT_KEYS.map((key, i) => (
                            <div key={key} className="text-center">
                                <div className={`text-xs font-bold mb-1 tracking-wide ${STAT_COLORS[i]}`}>{STAT_LABELS[i]}</div>
                                <input
                                    type="number" min="1" max="30" value={stats[key]}
                                    onChange={e => setStats({ ...stats, [key]: parseInt(e.target.value) || 10 })}
                                    className="bg-bg-input border border-border rounded-lg px-2 py-1.5 text-center w-16 text-sm text-gray-200 outline-none focus:border-gold"
                                />
                                <div className="text-xs text-gray-500 mt-1">{fm(mod(stats[key]))}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex gap-3 justify-end">
                    <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg text-sm bg-white/5 border border-border text-gray-400 hover:bg-white/10 cursor-pointer">Batal</button>
                    <button onClick={save} className="px-6 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-gold to-gold-dark text-white hover:from-gold-light hover:to-gold cursor-pointer">Simpan Karakter</button>
                </div>
            </Modal>

            {/* Detail Modal */}
            <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.nama_karakter}>
                {detail && (
                    <>
                        <div className="flex gap-4 mb-5">
                            {detail.gambar_url && <img src={detail.gambar_url} className="w-24 h-32 object-cover rounded-xl border-2 border-gold-dark" />}
                            <div>
                                <div className="text-sm text-gray-400">{detail.race} · {detail.class} · Level {detail.level}</div>
                                <div className="text-sm text-gray-600">Pemain: {detail.pemain_username}</div>
                                {detail.background && <div className="text-xs text-gray-600 mt-1">Background: {detail.background}</div>}
                                {detail.alignment && <div className="text-xs text-purple-400 mt-0.5">{detail.alignment}</div>}
                                <div className="mt-3 inline-block px-3 py-1.5 rounded-lg font-bold text-green-400 bg-green-950 text-sm">HP Max: {detail.max_hp}</div>
                            </div>
                        </div>
                        {detail.strength != null ? (
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                {STATS.map((s, i) => (
                                    <div key={s} className="bg-bg-input rounded-lg p-3 text-center">
                                        <div className={`text-xs font-bold ${STAT_COLORS[i]}`}>{STAT_LABELS[i]}</div>
                                        <div className="text-2xl font-bold mt-1">{detail[s]}</div>
                                        <div className="text-sm text-gray-500">{fm(mod(detail[s]))}</div>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-gray-500 text-sm">Belum ada atribut</p>}
                        <a href={`/session?karakter_id=${detail.id}`} className="block w-full text-center py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-gold to-gold-dark text-white hover:from-gold-light hover:to-gold transition-all mt-2">
                            <i className="fas fa-play mr-2"></i>Mulai Sesi Bermain
                        </a>
                    </>
                )}
            </Modal>
        </>
    )
}
