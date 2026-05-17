import { useEffect, useState, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

function extractVideoId(url) {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

// --- Visualizer Bars (decorative CSS animation) ---
function VisualizerBars({ active }) {
  return (
    <div className="flex items-end gap-[3px] h-5">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className="w-[3px] rounded-full transition-all"
          style={{
            backgroundColor: 'var(--color-gold)',
            height: active ? `${8 + Math.random() * 12}px` : '4px',
            animation: active ? `barPulse ${0.4 + i * 0.1}s ease-in-out infinite alternate` : 'none',
          }}
        />
      ))}
    </div>
  )
}

// --- Room Lobby ---
function RoomLobby({ onCreateRoom, onJoinRoom }) {
  const [joinCode, setJoinCode] = useState('')
  const [name, setName] = useState('')
  const inp = "bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-gold transition-colors"

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
      <div className="bg-bg-card border border-border-gold rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎵</div>
          <h2 className="text-2xl font-bold text-gold" style={{ fontFamily: 'var(--font-display)' }}>Music Room</h2>
          <p className="text-gray-500 text-sm mt-2">Listen to YouTube music together during your TRPG sessions</p>
        </div>

        <div className="mb-5">
          <label className="block text-xs text-gray-400 mb-1 font-medium">Your Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Adventurer" maxLength={30} className={`${inp} w-full`} />
        </div>

        <button
          onClick={() => onCreateRoom(name || 'Adventurer')}
          className="w-full py-3 rounded-xl text-sm font-bold cursor-pointer bg-gradient-to-r from-gold to-gold-dark text-white hover:from-gold-light hover:to-gold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] mb-5"
        >
          <i className="fas fa-plus mr-2" />Create New Room
        </button>

        <div className="relative flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-gray-600 uppercase tracking-wider">or join</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Room Code"
            maxLength={6}
            className={`${inp} flex-1 text-center tracking-[6px] font-mono text-lg`}
            onKeyDown={e => e.key === 'Enter' && joinCode.length === 6 && onJoinRoom(joinCode, name || 'Adventurer')}
          />
          <button
            onClick={() => onJoinRoom(joinCode, name || 'Adventurer')}
            disabled={joinCode.length !== 6}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer bg-blue-950 text-blue-300 hover:bg-blue-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Join
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Main Music Player ---
export default function MusicPlayer() {
  const socketRef = useRef(null)
  const playerRef = useRef(null)
  const playerContainerRef = useRef(null)
  const progressInterval = useRef(null)
  const ignoreNextStateChange = useRef(false)
  const lastSyncedIndex = useRef(-1)

  const [connected, setConnected] = useState(false)
  const [roomId, setRoomId] = useState(null)
  const [roomState, setRoomState] = useState(null)
  const [urlInput, setUrlInput] = useState('')
  const [volume, setVolume] = useState(80)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState('')
  const [videoTitle, setVideoTitle] = useState('')

  const inp = "bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-gold transition-colors"

  // --- Socket setup ---
  const initSocket = useCallback(() => {
    const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = s

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    s.on('room:state', (state) => setRoomState(state))
    s.on('connect_error', () => setError('Cannot connect to server'))

    return () => { s.disconnect() }
  }, [])

  useEffect(() => {
    const cleanup = initSocket()
    return cleanup
  }, [initSocket])

  // --- YouTube IFrame API ---
  useEffect(() => {
    if (window.YT && window.YT.Player) return
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  }, [])

  const createPlayer = useCallback((videoId) => {
    if (playerRef.current) {
      playerRef.current.destroy()
      playerRef.current = null
    }
    if (!videoId || !playerContainerRef.current) return

    const waitForYT = () => {
      if (window.YT && window.YT.Player) {
        playerRef.current = new window.YT.Player(playerContainerRef.current, {
          height: '180',
          width: '320',
          videoId,
          playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1 },
          events: {
            onReady: (e) => {
              e.target.setVolume(volume)
            },
            onStateChange: (e) => {
              if (ignoreNextStateChange.current) {
                ignoreNextStateChange.current = false
                return
              }
              if (e.data === window.YT.PlayerState.ENDED) {
                socketRef.current?.emit('playback:ended')
              }
            },
          },
        })
      } else {
        setTimeout(waitForYT, 200)
      }
    }
    waitForYT()
  }, [volume])

  // --- Sync player with room state ---
  useEffect(() => {
    if (!roomState) return
    const { queue, currentIndex, isPlaying, currentTime } = roomState
    const currentTrack = queue[currentIndex]

    if (!currentTrack) {
      if (playerRef.current) {
        playerRef.current.stopVideo?.()
      }
      setVideoTitle('')
      return
    }

    const videoId = currentTrack.videoId

    // Load new video if track changed
    if (lastSyncedIndex.current !== currentIndex || !playerRef.current) {
      lastSyncedIndex.current = currentIndex
      setVideoTitle(currentTrack.title)

      if (!playerRef.current) {
        createPlayer(videoId)
      } else {
        ignoreNextStateChange.current = true
        playerRef.current.loadVideoById(videoId, currentTime || 0)
      }

      if (!isPlaying && playerRef.current) {
        setTimeout(() => playerRef.current?.pauseVideo?.(), 500)
      }
      return
    }

    // Sync play/pause state
    if (playerRef.current?.getPlayerState) {
      const ytState = playerRef.current.getPlayerState()
      if (isPlaying && ytState !== 1) {
        playerRef.current.playVideo()
      } else if (!isPlaying && ytState === 1) {
        playerRef.current.pauseVideo()
      }

      // Sync time if drifted more than 3 seconds
      const playerTime = playerRef.current.getCurrentTime?.() || 0
      if (Math.abs(playerTime - currentTime) > 3) {
        playerRef.current.seekTo(currentTime, true)
      }
    }
    setVideoTitle(currentTrack.title)
  }, [roomState, createPlayer])

  // --- Progress tracking ---
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

  // Volume sync
  useEffect(() => {
    if (playerRef.current?.setVolume) playerRef.current.setVolume(volume)
  }, [volume])

  // --- Actions ---
  const createRoom = (name) => {
    socketRef.current?.emit('room:create', { name }, (res) => {
      if (res?.roomId) setRoomId(res.roomId)
    })
  }

  const joinRoom = (code, name) => {
    socketRef.current?.emit('room:join', { roomId: code, name }, (res) => {
      if (res?.error) { setError(res.error); return }
      if (res?.roomId) setRoomId(res.roomId)
    })
  }

  const addToQueue = async () => {
    const videoId = extractVideoId(urlInput.trim())
    if (!videoId) { setError('Invalid YouTube URL'); return }
    setError('')

    // Fetch title via oEmbed (no API key needed)
    let title = 'YouTube Video'
    try {
      const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
      const data = await res.json()
      if (data.title) title = data.title
    } catch { /* fallback title */ }

    socketRef.current?.emit('queue:add', { videoId, title })
    setUrlInput('')
  }

  const emit = (event, data) => socketRef.current?.emit(event, data)

  // --- Derived state ---
  const queue = roomState?.queue || []
  const currentIndex = roomState?.currentIndex ?? -1
  const isPlaying = roomState?.isPlaying || false
  const currentTrack = queue[currentIndex]
  const users = roomState?.users || []
  const repeatMode = roomState?.repeat || 'none'

  // --- Not in a room yet ---
  if (!roomId) {
    return (
      <>
        <div className="px-6 py-6 border-b border-border bg-gradient-to-br from-bg-surface to-bg-card">
          <h1 className="text-2xl font-bold text-gold" style={{ fontFamily: 'var(--font-display)' }}>Music Player</h1>
          <p className="text-gray-500 text-sm mt-1">Synced YouTube music — listen together like w2g.tv</p>
        </div>
        <RoomLobby onCreateRoom={createRoom} onJoinRoom={joinRoom} />
        {error && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-950 border border-red-500 text-red-300 px-4 py-2 rounded-lg text-sm">{error}</div>}
      </>
    )
  }

  // --- In a room ---
  return (
    <>
      <style>{`
        @keyframes barPulse {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1); }
        }
      `}</style>

      <div className="px-6 py-6 border-b border-border bg-gradient-to-br from-bg-surface to-bg-card">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gold" style={{ fontFamily: 'var(--font-display)' }}>Music Player</h1>
            <p className="text-gray-500 text-sm mt-1">Synced YouTube music — listen together like w2g.tv</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-bg-input border border-border rounded-lg px-3 py-2">
              <span className="text-xs text-gray-500">Room:</span>
              <span className="font-mono text-gold font-bold tracking-[3px] text-sm">{roomId}</span>
              <button onClick={() => navigator.clipboard.writeText(roomId)} className="text-gray-500 hover:text-gold-light cursor-pointer transition-colors ml-1" title="Copy code">
                <i className="fas fa-copy text-xs" />
              </button>
            </div>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} title={connected ? 'Connected' : 'Disconnected'} />
            <button
              onClick={() => { emit('room:leave'); setRoomId(null); setRoomState(null); lastSyncedIndex.current = -1; if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null } }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer bg-red-950 text-red-300 hover:bg-red-900 transition-all"
            >
              <i className="fas fa-sign-out-alt mr-1" />Leave
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 space-y-5">
        {/* Add URL */}
        <div className="bg-bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            <i className="fas fa-plus-circle text-gold" /> Add Music
          </h3>
          <div className="flex gap-2">
            <input
              value={urlInput}
              onChange={e => { setUrlInput(e.target.value); setError('') }}
              placeholder="Paste YouTube URL here..."
              className={`${inp} flex-1`}
              onKeyDown={e => e.key === 'Enter' && addToQueue()}
            />
            <button onClick={addToQueue} className="px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer bg-gradient-to-r from-gold to-gold-dark text-white hover:from-gold-light hover:to-gold shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]">
              <i className="fas fa-plus mr-1" />Add
            </button>
          </div>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>

        {/* Player + Controls + Users row */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

          {/* Left: Now Playing + Controls */}
          <div className="space-y-5">
            {/* Now Playing */}
            <div className="bg-bg-card border border-border-gold rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-gold mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                <i className="fas fa-play-circle text-gold" /> Now Playing
              </h3>

              {/* Mini Player */}
              <div className="flex gap-5 flex-wrap items-start">
                <div className="rounded-xl overflow-hidden border-2 border-gold-dark/40 shadow-lg bg-black flex-shrink-0" style={{ width: 320, height: 180 }}>
                  <div ref={playerContainerRef} />
                </div>

                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-3 mb-3">
                    <VisualizerBars active={isPlaying} />
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-semibold text-gold-light truncate" style={{ fontFamily: 'var(--font-display)' }}>
                        {currentTrack ? videoTitle || currentTrack.title : 'No track selected'}
                      </p>
                      {currentTrack && <p className="text-xs text-gray-500 mt-0.5">Added by {currentTrack.addedBy}</p>}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <input
                      type="range" min={0} max={duration || 1} value={progress} step={0.5}
                      onChange={e => { const t = parseFloat(e.target.value); setProgress(t); emit('playback:seek', { time: t }) }}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, var(--color-gold) ${(progress / (duration || 1)) * 100}%, var(--color-border) ${(progress / (duration || 1)) * 100}%)` }}
                    />
                    <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                      <span>{formatTime(progress)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Playback Controls */}
                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => emit('playback:shuffle', { enabled: !roomState?.shuffle })} className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all text-xs ${roomState?.shuffle ? 'text-gold bg-gold/10' : 'text-gray-600 hover:text-gray-400'}`}>
                      <i className="fas fa-random" />
                    </button>
                    <button onClick={() => emit('playback:skip', { direction: 'prev' })} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer text-gray-300 hover:text-gold transition-colors">
                      <i className="fas fa-step-backward" />
                    </button>
                    <button
                      onClick={() => emit(isPlaying ? 'playback:pause' : 'playback:play', isPlaying ? { currentTime: progress } : undefined)}
                      className="w-12 h-12 rounded-full flex items-center justify-center cursor-pointer bg-gradient-to-br from-gold to-gold-dark text-white shadow-lg hover:from-gold-light hover:to-gold transition-all hover:scale-105 active:scale-95"
                    >
                      <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} ${isPlaying ? '' : 'ml-0.5'}`} />
                    </button>
                    <button onClick={() => emit('playback:skip', { direction: 'next' })} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer text-gray-300 hover:text-gold transition-colors">
                      <i className="fas fa-step-forward" />
                    </button>
                    <button
                      onClick={() => { const modes = ['none', 'all', 'one']; const next = modes[(modes.indexOf(repeatMode) + 1) % 3]; emit('playback:repeat', { mode: next }) }}
                      className={`w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-all text-xs relative ${repeatMode !== 'none' ? 'text-gold bg-gold/10' : 'text-gray-600 hover:text-gray-400'}`}
                    >
                      <i className="fas fa-redo" />
                      {repeatMode === 'one' && <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold text-gold">1</span>}
                    </button>
                  </div>

                  {/* Volume */}
                  <div className="flex items-center gap-2 mt-4">
                    <i className={`fas ${volume === 0 ? 'fa-volume-mute' : volume < 50 ? 'fa-volume-down' : 'fa-volume-up'} text-gray-500 text-xs cursor-pointer`} onClick={() => setVolume(v => v === 0 ? 80 : 0)} />
                    <input
                      type="range" min={0} max={100} value={volume}
                      onChange={e => setVolume(parseInt(e.target.value))}
                      className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, var(--color-gold) ${volume}%, var(--color-border) ${volume}%)` }}
                    />
                    <span className="text-[10px] text-gray-600 w-7 text-right">{volume}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Users */}
          <div className="bg-bg-card border border-border rounded-2xl p-5 h-fit">
            <h3 className="text-sm font-semibold text-gold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
              <i className="fas fa-users text-gold" /> Listeners ({users.length})
            </h3>
            <div className="space-y-2">
              {users.map((u, i) => (
                <div key={u.id || i} className="flex items-center gap-2 bg-bg-input rounded-lg px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold-dark to-gold flex items-center justify-center text-white text-xs font-bold">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-300 truncate">{u.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Queue */}
        <div className="bg-bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-gold mb-3 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            <i className="fas fa-list text-gold" /> Queue ({queue.length})
            {queue.length > 0 && (
              <button onClick={() => emit('queue:clear')} className="ml-auto text-xs px-3 py-1 rounded-lg bg-white/5 border border-border text-gray-500 hover:bg-white/10 cursor-pointer transition-all">
                Clear All
              </button>
            )}
          </h3>

          {queue.length === 0 ? (
            <div className="text-center py-10 text-gray-700">
              <i className="fas fa-music text-4xl mb-3 block opacity-30" />
              <p className="text-sm">Queue is empty — add a YouTube link above</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {queue.map((track, i) => (
                <div
                  key={`${track.videoId}-${track.addedAt}-${i}`}
                  onClick={() => emit('playback:select', { index: i })}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all group ${i === currentIndex
                    ? 'bg-gold/10 border border-gold/30'
                    : 'hover:bg-white/5 border border-transparent'
                    }`}
                >
                  <div className="w-7 text-center">
                    {i === currentIndex && isPlaying
                      ? <VisualizerBars active />
                      : <span className="text-xs text-gray-600 font-mono">{i + 1}</span>
                    }
                  </div>
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-bg-input flex-shrink-0">
                    <img src={`https://img.youtube.com/vi/${track.videoId}/default.jpg`} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${i === currentIndex ? 'text-gold-light font-semibold' : 'text-gray-300'}`}>{track.title}</p>
                    <p className="text-[10px] text-gray-600">by {track.addedBy}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); emit('queue:remove', { index: i }) }}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-950/50 cursor-pointer transition-all"
                  >
                    <i className="fas fa-times text-xs" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
