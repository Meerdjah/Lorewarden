/**
 * Map Room — Socket.IO handler for collaborative VTT battle map
 *
 * Room state stored in-memory (ephemeral). Rooms auto-cleaned when empty.
 */

const rooms = new Map();

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function createRoom(hostName) {
    const code = generateRoomCode();
    const room = {
        code,
        host: null, // socket id set on join
        hostName,
        users: new Map(), // socketId -> { name, isGM }
        mapImage: null,   // base64 or URL
        gridConfig: { enabled: true, size: 50, color: 'rgba(255,255,255,0.15)' },
        tokens: [],       // { id, x, y, label, color, imageUrl, size }
        fogAreas: [],     // { id, x, y, width, height, revealed }
        nextTokenId: 1,
        nextFogId: 1,
    };
    rooms.set(code, room);
    return room;
}

function broadcastState(io, roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    const state = {
        code: room.code,
        hostName: room.hostName,
        users: Array.from(room.users.values()),
        mapImage: room.mapImage,
        gridConfig: room.gridConfig,
        tokens: room.tokens,
        fogAreas: room.fogAreas,
    };

    io.to(roomId).emit('map:state', state);
}

module.exports = function initMapRoom(io) {
    const ns = io; // use default namespace

    ns.on('connection', (socket) => {

        // --- Create Room ---
        socket.on('map:create', ({ name }, cb) => {
            leaveAllMapRooms(socket, ns);
            const room = createRoom(name || 'Game Master');
            room.host = socket.id;
            room.users.set(socket.id, { name: name || 'Game Master', isGM: true });
            socket.join(room.code);
            socket.mapRoomCode = room.code;
            if (cb) cb({ success: true, code: room.code, isGM: true });
            broadcastState(ns, room.code);
            console.log(`[Map] Room created: ${room.code} by ${name}`);
        });

        // --- Join Room ---
        socket.on('map:join', ({ code, name }, cb) => {
            const room = rooms.get(code?.toUpperCase());
            if (!room) return cb?.({ success: false, error: 'Room tidak ditemukan' });

            leaveAllMapRooms(socket, ns);
            room.users.set(socket.id, { name: name || 'Player', isGM: false });
            socket.join(room.code);
            socket.mapRoomCode = room.code;
            if (cb) cb({ success: true, code: room.code, isGM: false });
            broadcastState(ns, room.code);
            console.log(`[Map] ${name} joined room ${room.code}`);
        });

        // --- Upload Map ---
        socket.on('map:setMap', ({ mapImage }) => {
            const room = getRoom(socket);
            if (!room || socket.id !== room.host) return;
            room.mapImage = mapImage;
            broadcastState(ns, room.code);
        });

        // --- Grid Config ---
        socket.on('map:gridConfig', ({ gridConfig }) => {
            const room = getRoom(socket);
            if (!room || socket.id !== room.host) return;
            room.gridConfig = { ...room.gridConfig, ...gridConfig };
            broadcastState(ns, room.code);
        });

        // --- Add Token ---
        socket.on('map:addToken', ({ token }) => {
            const room = getRoom(socket);
            if (!room) return;
            const t = {
                id: room.nextTokenId++,
                x: token.x || 0,
                y: token.y || 0,
                label: token.label || '?',
                color: token.color || '#d4a840',
                imageUrl: token.imageUrl || null,
                size: token.size || 40,
            };
            room.tokens.push(t);
            broadcastState(ns, room.code);
        });

        // --- Move Token ---
        socket.on('map:moveToken', ({ tokenId, x, y }) => {
            const room = getRoom(socket);
            if (!room) return;
            const token = room.tokens.find(t => t.id === tokenId);
            if (token) {
                token.x = x;
                token.y = y;
                // Broadcast just the move for performance
                ns.to(room.code).emit('map:tokenMoved', { tokenId, x, y });
            }
        });

        // --- Update Token ---
        socket.on('map:updateToken', ({ tokenId, updates }) => {
            const room = getRoom(socket);
            if (!room) return;
            const token = room.tokens.find(t => t.id === tokenId);
            if (token) {
                Object.assign(token, updates);
                broadcastState(ns, room.code);
            }
        });

        // --- Remove Token ---
        socket.on('map:removeToken', ({ tokenId }) => {
            const room = getRoom(socket);
            if (!room) return;
            room.tokens = room.tokens.filter(t => t.id !== tokenId);
            broadcastState(ns, room.code);
        });

        // --- Add Fog Area ---
        socket.on('map:addFog', ({ fog }) => {
            const room = getRoom(socket);
            if (!room || socket.id !== room.host) return;
            const f = {
                id: room.nextFogId++,
                x: fog.x || 0,
                y: fog.y || 0,
                width: fog.width || 100,
                height: fog.height || 100,
                revealed: false,
            };
            room.fogAreas.push(f);
            broadcastState(ns, room.code);
        });

        // --- Toggle Fog ---
        socket.on('map:toggleFog', ({ fogId }) => {
            const room = getRoom(socket);
            if (!room || socket.id !== room.host) return;
            const fog = room.fogAreas.find(f => f.id === fogId);
            if (fog) fog.revealed = !fog.revealed;
            broadcastState(ns, room.code);
        });

        // --- Remove Fog ---
        socket.on('map:removeFog', ({ fogId }) => {
            const room = getRoom(socket);
            if (!room || socket.id !== room.host) return;
            room.fogAreas = room.fogAreas.filter(f => f.id !== fogId);
            broadcastState(ns, room.code);
        });

        // --- Clear All Fog ---
        socket.on('map:clearFog', () => {
            const room = getRoom(socket);
            if (!room || socket.id !== room.host) return;
            room.fogAreas = [];
            broadcastState(ns, room.code);
        });

        // --- Request State ---
        socket.on('map:requestState', () => {
            const room = getRoom(socket);
            if (room) broadcastState(ns, room.code);
        });

        // --- Disconnect ---
        socket.on('disconnect', () => {
            leaveAllMapRooms(socket, ns);
        });

        socket.on('map:leave', () => {
            leaveAllMapRooms(socket, ns);
        });
    });

    function getRoom(socket) {
        return rooms.get(socket.mapRoomCode);
    }

    function leaveAllMapRooms(socket, ioServer) {
        const code = socket.mapRoomCode;
        if (!code) return;
        const room = rooms.get(code);
        if (!room) return;

        room.users.delete(socket.id);
        socket.leave(code);
        socket.mapRoomCode = null;

        if (room.users.size === 0) {
            rooms.delete(code);
            console.log(`[Map] Room ${code} deleted (empty)`);
        } else {
            // If host left, transfer to next user
            if (room.host === socket.id) {
                const nextId = room.users.keys().next().value;
                room.host = nextId;
                const nextUser = room.users.get(nextId);
                if (nextUser) nextUser.isGM = true;
                console.log(`[Map] Host transferred in room ${code}`);
            }
            broadcastState(ioServer, code);
        }
    }
};
