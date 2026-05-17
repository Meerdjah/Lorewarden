/**
 * Game Room — Unified Socket.IO handler
 * Combines Music Room, Battle Map, and Session Tracker into one room.
 * One room code → 3 features (Session + Music + Map).
 *
 * Room state is stored in-memory (ephemeral). Rooms auto-cleaned when empty.
 */

const rooms = new Map();

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function createRoom(hostName) {
    let code;
    do { code = generateRoomCode(); } while (rooms.has(code));

    const room = {
        code,
        host: null,
        hostName,
        users: new Map(), // socketId -> { name, isGM }
        createdAt: Date.now(),

        // --- Music state ---
        music: {
            queue: [],
            currentIndex: -1,
            isPlaying: false,
            currentTime: 0,
            lastSyncAt: Date.now(),
            repeat: 'none', // 'none' | 'all' | 'one'
            shuffle: false,
        },

        // --- Map state ---
        map: {
            mapImage: null,
            gridConfig: { enabled: true, size: 50, color: 'rgba(255,255,255,0.15)' },
            tokens: [],
            fogAreas: [],
            nextTokenId: 1,
            nextFogId: 1,
        },

        // --- Session state (character tracking) ---
        sessions: [], // [{ karakterId, nama, class, level, hp, max_hp, ... }]
    };

    rooms.set(code, room);
    return room;
}

// --- Music helpers ---
function getEstimatedTime(music) {
    if (!music.isPlaying) return music.currentTime;
    const elapsed = (Date.now() - music.lastSyncAt) / 1000;
    return music.currentTime + elapsed;
}

// --- Broadcast ---
function broadcastState(io, roomCode, section) {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (!section || section === 'room') {
        io.to(roomCode).emit('room:state', {
            code: room.code,
            hostName: room.hostName,
            users: Array.from(room.users.values()),
        });
    }

    if (!section || section === 'music') {
        const m = room.music;
        io.to(roomCode).emit('music:state', {
            queue: m.queue,
            currentIndex: m.currentIndex,
            isPlaying: m.isPlaying,
            currentTime: getEstimatedTime(m),
            repeat: m.repeat,
            shuffle: m.shuffle,
        });
    }

    if (!section || section === 'map') {
        const mp = room.map;
        io.to(roomCode).emit('map:state', {
            mapImage: mp.mapImage,
            gridConfig: mp.gridConfig,
            tokens: mp.tokens,
            fogAreas: mp.fogAreas,
        });
    }

    if (!section || section === 'session') {
        io.to(roomCode).emit('session:state', {
            sessions: room.sessions,
        });
    }
}

module.exports = function initGameRoom(io) {
    io.on('connection', (socket) => {

        // ============================================================
        // ROOM LIFECYCLE
        // ============================================================

        socket.on('room:create', ({ name }, cb) => {
            leaveRoom(socket, io);
            const room = createRoom(name || 'Game Master');
            room.host = socket.id;
            room.users.set(socket.id, { name: name || 'Game Master', isGM: true });
            socket.join(room.code);
            socket.gameRoomCode = room.code;
            socket.userName = name || 'Game Master';
            if (cb) cb({ success: true, code: room.code, isGM: true });
            broadcastState(io, room.code);
            console.log(`[Game] Room created: ${room.code} by ${name}`);
        });

        socket.on('room:join', ({ code, name }, cb) => {
            const room = rooms.get(code?.toUpperCase());
            if (!room) return cb?.({ success: false, error: 'Room tidak ditemukan' });

            leaveRoom(socket, io);
            room.users.set(socket.id, { name: name || 'Player', isGM: false });
            socket.join(room.code);
            socket.gameRoomCode = room.code;
            socket.userName = name || 'Player';
            if (cb) cb({ success: true, code: room.code, isGM: false });
            broadcastState(io, room.code);
            console.log(`[Game] ${name} joined room ${room.code}`);
        });

        socket.on('room:leave', () => leaveRoom(socket, io));

        socket.on('room:requestState', () => {
            const room = getRoom(socket);
            if (room) broadcastState(io, room.code);
        });

        // ============================================================
        // MUSIC — Queue
        // ============================================================

        socket.on('queue:add', (data) => {
            const room = getRoom(socket);
            if (!room) return;
            const { videoId, title } = data || {};
            if (!videoId) return;
            const m = room.music;

            m.queue.push({
                videoId,
                title: (title || 'Unknown').slice(0, 200),
                addedBy: socket.userName || 'Unknown',
                addedAt: Date.now(),
            });

            if (m.queue.length === 1 && m.currentIndex === -1) {
                m.currentIndex = 0;
                m.isPlaying = true;
                m.currentTime = 0;
                m.lastSyncAt = Date.now();
            }

            broadcastState(io, room.code, 'music');
        });

        socket.on('queue:remove', (data) => {
            const room = getRoom(socket);
            if (!room) return;
            const m = room.music;
            const { index } = data || {};
            if (index == null || index < 0 || index >= m.queue.length) return;

            m.queue.splice(index, 1);

            if (m.queue.length === 0) {
                m.currentIndex = -1; m.isPlaying = false; m.currentTime = 0;
            } else if (index < m.currentIndex) {
                m.currentIndex--;
            } else if (index === m.currentIndex) {
                if (m.currentIndex >= m.queue.length) m.currentIndex = 0;
                m.currentTime = 0; m.lastSyncAt = Date.now();
            }

            broadcastState(io, room.code, 'music');
        });

        socket.on('queue:clear', () => {
            const room = getRoom(socket);
            if (!room) return;
            const m = room.music;
            m.queue = []; m.currentIndex = -1; m.isPlaying = false; m.currentTime = 0; m.lastSyncAt = Date.now();
            broadcastState(io, room.code, 'music');
        });

        socket.on('queue:reorder', (data) => {
            const room = getRoom(socket);
            if (!room) return;
            const m = room.music;
            const { fromIndex, toIndex } = data || {};
            if (fromIndex == null || toIndex == null) return;
            if (fromIndex < 0 || fromIndex >= m.queue.length) return;
            if (toIndex < 0 || toIndex >= m.queue.length) return;

            const currentVideoId = m.queue[m.currentIndex]?.videoId;
            const [item] = m.queue.splice(fromIndex, 1);
            m.queue.splice(toIndex, 0, item);

            if (currentVideoId) {
                const idx = m.queue.findIndex(q => q.videoId === currentVideoId);
                if (idx !== -1) m.currentIndex = idx;
            }
            broadcastState(io, room.code, 'music');
        });

        // ============================================================
        // MUSIC — Playback
        // ============================================================

        socket.on('playback:play', () => {
            const room = getRoom(socket);
            if (!room || room.music.currentIndex === -1) return;
            room.music.isPlaying = true;
            room.music.lastSyncAt = Date.now();
            broadcastState(io, room.code, 'music');
        });

        socket.on('playback:pause', (data) => {
            const room = getRoom(socket);
            if (!room) return;
            const m = room.music;
            m.isPlaying = false;
            m.currentTime = data?.currentTime ?? getEstimatedTime(m);
            m.lastSyncAt = Date.now();
            broadcastState(io, room.code, 'music');
        });

        socket.on('playback:seek', (data) => {
            const room = getRoom(socket);
            if (!room) return;
            room.music.currentTime = data?.time ?? 0;
            room.music.lastSyncAt = Date.now();
            broadcastState(io, room.code, 'music');
        });

        socket.on('playback:skip', (data) => {
            const room = getRoom(socket);
            if (!room) return;
            const m = room.music;
            if (m.queue.length === 0) return;
            const direction = data?.direction || 'next';

            if (direction === 'next') {
                if (m.repeat === 'one') { m.currentTime = 0; }
                else if (m.currentIndex < m.queue.length - 1) { m.currentIndex++; m.currentTime = 0; }
                else if (m.repeat === 'all') { m.currentIndex = 0; m.currentTime = 0; }
                else { m.isPlaying = false; m.currentTime = 0; }
            } else {
                if (m.currentIndex > 0) { m.currentIndex--; m.currentTime = 0; }
                else if (m.repeat === 'all') { m.currentIndex = m.queue.length - 1; m.currentTime = 0; }
            }

            m.isPlaying = true;
            m.lastSyncAt = Date.now();
            broadcastState(io, room.code, 'music');
        });

        socket.on('playback:ended', () => {
            const room = getRoom(socket);
            if (!room) return;
            const m = room.music;

            if (m.repeat === 'one') { m.currentTime = 0; }
            else if (m.currentIndex < m.queue.length - 1) { m.currentIndex++; m.currentTime = 0; }
            else if (m.repeat === 'all') { m.currentIndex = 0; m.currentTime = 0; }
            else { m.isPlaying = false; m.currentTime = 0; }

            m.lastSyncAt = Date.now();
            broadcastState(io, room.code, 'music');
        });

        socket.on('playback:select', (data) => {
            const room = getRoom(socket);
            if (!room) return;
            const m = room.music;
            const { index } = data || {};
            if (index == null || index < 0 || index >= m.queue.length) return;
            m.currentIndex = index; m.currentTime = 0; m.isPlaying = true; m.lastSyncAt = Date.now();
            broadcastState(io, room.code, 'music');
        });

        socket.on('playback:repeat', (data) => {
            const room = getRoom(socket);
            if (!room) return;
            room.music.repeat = data?.mode || 'none';
            broadcastState(io, room.code, 'music');
        });

        socket.on('playback:shuffle', (data) => {
            const room = getRoom(socket);
            if (!room) return;
            room.music.shuffle = !!data?.enabled;
            broadcastState(io, room.code, 'music');
        });

        // ============================================================
        // MAP
        // ============================================================

        socket.on('map:setMap', ({ mapImage }) => {
            const room = getRoom(socket);
            if (!room || socket.id !== room.host) return;
            room.map.mapImage = mapImage;
            broadcastState(io, room.code, 'map');
        });

        socket.on('map:gridConfig', ({ gridConfig }) => {
            const room = getRoom(socket);
            if (!room || socket.id !== room.host) return;
            room.map.gridConfig = { ...room.map.gridConfig, ...gridConfig };
            broadcastState(io, room.code, 'map');
        });

        socket.on('map:addToken', ({ token }) => {
            const room = getRoom(socket);
            if (!room) return;
            const mp = room.map;
            mp.tokens.push({
                id: mp.nextTokenId++,
                x: token.x || 0, y: token.y || 0,
                label: token.label || '?',
                color: token.color || '#d4a840',
                imageUrl: token.imageUrl || null,
                size: token.size || 40,
            });
            broadcastState(io, room.code, 'map');
        });

        socket.on('map:moveToken', ({ tokenId, x, y }) => {
            const room = getRoom(socket);
            if (!room) return;
            const token = room.map.tokens.find(t => t.id === tokenId);
            if (token) {
                token.x = x; token.y = y;
                io.to(room.code).emit('map:tokenMoved', { tokenId, x, y });
            }
        });

        socket.on('map:updateToken', ({ tokenId, updates }) => {
            const room = getRoom(socket);
            if (!room) return;
            const token = room.map.tokens.find(t => t.id === tokenId);
            if (token) { Object.assign(token, updates); broadcastState(io, room.code, 'map'); }
        });

        socket.on('map:removeToken', ({ tokenId }) => {
            const room = getRoom(socket);
            if (!room) return;
            room.map.tokens = room.map.tokens.filter(t => t.id !== tokenId);
            broadcastState(io, room.code, 'map');
        });

        socket.on('map:addFog', ({ fog }) => {
            const room = getRoom(socket);
            if (!room || socket.id !== room.host) return;
            const mp = room.map;
            mp.fogAreas.push({
                id: mp.nextFogId++,
                x: fog.x || 0, y: fog.y || 0,
                width: fog.width || 100, height: fog.height || 100,
                revealed: false,
            });
            broadcastState(io, room.code, 'map');
        });

        socket.on('map:toggleFog', ({ fogId }) => {
            const room = getRoom(socket);
            if (!room || socket.id !== room.host) return;
            const fog = room.map.fogAreas.find(f => f.id === fogId);
            if (fog) fog.revealed = !fog.revealed;
            broadcastState(io, room.code, 'map');
        });

        socket.on('map:removeFog', ({ fogId }) => {
            const room = getRoom(socket);
            if (!room || socket.id !== room.host) return;
            room.map.fogAreas = room.map.fogAreas.filter(f => f.id !== fogId);
            broadcastState(io, room.code, 'map');
        });

        socket.on('map:clearFog', () => {
            const room = getRoom(socket);
            if (!room || socket.id !== room.host) return;
            room.map.fogAreas = [];
            broadcastState(io, room.code, 'map');
        });

        // ============================================================
        // SESSION — character tracking (synced via Socket)
        // ============================================================

        socket.on('session:loadCharacter', ({ karakter }) => {
            const room = getRoom(socket);
            if (!room) return;
            // Add or update character in room sessions
            const existing = room.sessions.findIndex(s => s.karakterId === karakter.karakterId);
            if (existing >= 0) {
                room.sessions[existing] = { ...room.sessions[existing], ...karakter };
            } else {
                room.sessions.push(karakter);
            }
            broadcastState(io, room.code, 'session');
        });

        socket.on('session:updateCharacter', ({ karakterId, updates }) => {
            const room = getRoom(socket);
            if (!room) return;
            const session = room.sessions.find(s => s.karakterId === karakterId);
            if (session) {
                Object.assign(session, updates);
                broadcastState(io, room.code, 'session');
            }
        });

        socket.on('session:removeCharacter', ({ karakterId }) => {
            const room = getRoom(socket);
            if (!room) return;
            room.sessions = room.sessions.filter(s => s.karakterId !== karakterId);
            broadcastState(io, room.code, 'session');
        });

        // ============================================================
        // DISCONNECT
        // ============================================================

        socket.on('disconnect', () => leaveRoom(socket, io));

        // --- Helpers ---
        function getRoom(sock) {
            return rooms.get(sock.gameRoomCode);
        }

        function leaveRoom(sock, ioServer) {
            const code = sock.gameRoomCode;
            if (!code) return;
            const room = rooms.get(code);
            if (!room) return;

            room.users.delete(sock.id);
            sock.leave(code);
            sock.gameRoomCode = null;

            if (room.users.size === 0) {
                rooms.delete(code);
                console.log(`[Game] Room ${code} deleted (empty)`);
            } else {
                if (room.host === sock.id) {
                    const nextId = room.users.keys().next().value;
                    room.host = nextId;
                    const nextUser = room.users.get(nextId);
                    if (nextUser) nextUser.isGM = true;
                    console.log(`[Game] Host transferred in room ${code}`);
                }
                broadcastState(ioServer, code);
            }
        }
    });
};
