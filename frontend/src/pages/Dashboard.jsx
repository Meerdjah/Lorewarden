import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import Modal from '../components/Modal'
import api from '../api'

export default function Dashboard() {
    const toast = useToast()
    const [pemain, setPemain] = useState([])
    const [karakter, setKarakter] = useState([])
    const [sesiCount, setSesiCount] = useState(0)
    const [modal, setModal] = useState(false)
    const [editId, setEditId] = useState(null)
    const [form, setForm] = useState({ username: '', discord_id: '' })

    async function loadAll() {
        try {
            const [pRes, kRes, sRes] = await Promise.all([
                api.getPemain(),
                api.getKarakter(),
                api.getAllSessions().catch(() => ({ data: [] })),
            ])
            setPemain(pRes.data)
            setKarakter(kRes.data)
            setSesiCount(sRes.count ?? sRes.data?.length ?? 0)
        } catch (e) { toast(e.message, 'error') }
    }

    useEffect(() => { loadAll() }, [])

    function openAdd() {
        setEditId(null)
        setForm({ username: '', discord_id: '' })
        setModal(true)
    }

    async function openEdit(id) {
        try {
            const res = await api.getPemainById(id)
            const p = res.data
            setEditId(p.id)
            setForm({ username: p.username, discord_id: p.discord_id || '' })
            setModal(true)
        } catch (e) { toast(e.message, 'error') }
    }

    async function save() {
        if (!form.username.trim()) return toast('Username wajib diisi', 'error')
        try {
            if (editId) await api.updatePemain(editId, form)
            else await api.createPemain(form)
            toast(editId ? 'Pemain diperbarui' : 'Pemain ditambahkan')
            setModal(false)
            loadAll()
        } catch (e) { toast(e.message, 'error') }
    }

    async function hapus(id) {
        const p = pemain.find(x => x.id === id)
        if (!confirm(`Hapus pemain "${p?.username}"? Semua karakternya juga akan terhapus.`)) return
        try {
            await api.deletePemain(id)
            toast('Pemain dihapus')
            loadAll()
        } catch (e) { toast(e.message, 'error') }
    }

    return (
        <>
            {/* Header */}
            <div className="px-6 py-7 border-b border-border bg-gradient-to-br from-bg-surface to-bg-card">
                <h1 className="text-2xl font-bold text-gold" style={{ fontFamily: 'var(--font-display)' }}>Dashboard</h1>
                <p className="text-gray-500 text-sm mt-1">Platform manajemen karakter TRPG — kelola pemain, karakter, dan sesi bermain</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 px-6 py-5">
                {[
                    { label: 'Total Pemain', value: pemain.length, color: 'text-gold' },
                    { label: 'Total Karakter', value: karakter.length, color: 'text-blue-400' },
                    { label: 'Sesi Aktif', value: sesiCount, color: 'text-green-400' },
                ].map(s => (
                    <div key={s.label} className="bg-bg-card border border-border rounded-2xl p-5 text-center hover:border-border-gold transition-all">
                        <div className={`text-3xl font-bold ${s.color}`} style={{ fontFamily: 'var(--font-display)' }}>{s.value}</div>
                        <div className="text-gray-500 text-xs mt-1">{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Pemain */}
            <div className="px-6 pb-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gold" style={{ fontFamily: 'var(--font-display)' }}>Daftar Pemain</h2>
                    <button onClick={openAdd} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-gold to-gold-dark text-white hover:from-gold-light hover:to-gold transition-all shadow-md cursor-pointer">
                        <i className="fas fa-plus mr-1"></i> Tambah Pemain
                    </button>
                </div>
                {pemain.length === 0 ? (
                    <div className="text-center py-12 text-gray-600"><i className="fas fa-users text-4xl mb-3 block opacity-40"></i><p>Belum ada pemain. Tambahkan pemain pertama!</p></div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {pemain.map(p => (
                            <div key={p.id} className="bg-bg-card border border-border rounded-2xl p-4 hover:border-border-gold hover:-translate-y-0.5 transition-all">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="min-w-0">
                                        <div className="font-semibold text-gold-light truncate">{p.username}</div>
                                        <div className="text-xs text-gray-600 mt-0.5">
                                            {p.discord_id ? <><i className="fab fa-discord text-indigo-400 mr-1"></i>{p.discord_id}</> : <span className="text-gray-700">Tanpa Discord</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => openEdit(p.id)} className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-gold hover:bg-gold/10 transition-all cursor-pointer"><i className="fas fa-edit text-xs"></i></button>
                                        <button onClick={() => hapus(p.id)} className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all cursor-pointer"><i className="fas fa-trash text-xs"></i></button>
                                    </div>
                                </div>
                                <div className="text-sm text-gray-500 flex items-center gap-1.5 mt-2"><i className="fas fa-users text-blue-400 text-xs"></i>{p.total_karakter} karakter</div>
                                <Link to={`/karakter?pemain_id=${p.id}`} className="mt-3 block text-center text-xs font-semibold bg-gradient-to-r from-gold to-gold-dark text-white px-3 py-1.5 rounded-lg hover:from-gold-light hover:to-gold transition-all">Lihat Karakter</Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Karakter */}
            <div className="px-6 pb-10">
                <h2 className="text-lg font-semibold text-gold mb-4" style={{ fontFamily: 'var(--font-display)' }}>Semua Karakter</h2>
                {karakter.length === 0 ? (
                    <div className="text-center py-12 text-gray-600"><i className="fas fa-scroll text-4xl mb-3 block opacity-40"></i><p>Belum ada karakter.</p></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {karakter.map(k => (
                            <div key={k.id} className="bg-bg-card border border-border rounded-2xl overflow-hidden hover:border-border-gold hover:-translate-y-0.5 transition-all">
                                <div className="flex">
                                    {k.gambar_url
                                        ? <img src={k.gambar_url} className="w-24 h-32 object-cover shrink-0" alt={k.nama_karakter} />
                                        : <div className="w-24 h-32 shrink-0 flex items-center justify-center text-3xl bg-bg-input text-gray-700">⚔</div>
                                    }
                                    <div className="p-3 flex-1 min-w-0">
                                        <div className="font-bold text-gold-light truncate">{k.nama_karakter}</div>
                                        <div className="text-xs text-gray-500 mt-0.5">{k.race} · {k.class} · Lv.{k.level}</div>
                                        <div className="text-xs text-gray-600">Pemain: {k.pemain_username}</div>
                                        <div className="h-3 rounded-full bg-bg-input overflow-hidden mt-3">
                                            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: '100%' }}></div>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">HP Max: <span className="text-green-400 font-semibold">{k.max_hp}</span></div>
                                    </div>
                                </div>
                                <div className="flex gap-2 px-3 py-2.5 border-t border-border">
                                    <Link to={`/karakter?edit=${k.id}`} className="flex-1 text-center text-xs py-1.5 rounded-lg bg-white/5 border border-border text-gray-400 hover:text-gold hover:border-border-gold transition-all"><i className="fas fa-edit mr-1"></i>Edit</Link>
                                    <Link to={`/session?karakter_id=${k.id}`} className="flex-1 text-center text-xs py-1.5 rounded-lg font-semibold bg-gradient-to-r from-gold to-gold-dark text-white hover:from-gold-light hover:to-gold transition-all"><i className="fas fa-play mr-1"></i>Sesi</Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Pemain */}
            <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Edit Pemain' : 'Tambah Pemain'}>
                <div className="mb-4">
                    <label className="block text-xs text-gray-400 mb-1 font-medium">Username *</label>
                    <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-gold transition-colors" placeholder="contoh: Ranger_Dhika" />
                </div>
                <div className="mb-6">
                    <label className="block text-xs text-gray-400 mb-1 font-medium">Discord ID</label>
                    <input value={form.discord_id} onChange={e => setForm({ ...form, discord_id: e.target.value })} className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-gold transition-colors" placeholder="username#1234" />
                </div>
                <div className="flex gap-3 justify-end">
                    <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg text-sm bg-white/5 border border-border text-gray-400 hover:bg-white/10 cursor-pointer">Batal</button>
                    <button onClick={save} className="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-gold to-gold-dark text-white hover:from-gold-light hover:to-gold cursor-pointer">Simpan</button>
                </div>
            </Modal>
        </>
    )
}
