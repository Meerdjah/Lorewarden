/**
 * Music Room — Socket.IO handler for multi-user synced YouTube music player
 *
 * Room state is stored in-memory (ephemeral). Rooms are auto-cleaned when empty.
 */

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createRoom() {
  let code;
  do { code = generateRoomCode(); } while (rooms.has(code));

  rooms.set(code, {
    roomId: code,
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    currentTime: 0,
    lastSyncAt: Date.now(),
    repeat: 'none', // 'none' | 'all' | 'one'
    shuffle: false,
    users: [],
  });

  return code;
}

function getEstimatedTime(room) {
  if (!room.isPlaying) return room.currentTime;
  const elapsed = (Date.now() - room.lastSyncAt) / 1000;
  return room.currentTime + elapsed;
}

function broadcastState(io, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  io.to(roomId).emit('room:state', {
    roomId: room.roomId,
    queue: room.queue,
    currentIndex: room.currentIndex,
    isPlaying: room.isPlaying,
    currentTime: getEstimatedTime(room),
    repeat: room.repeat,
    shuffle: room.shuffle,
    users: room.users.map(u => ({ id: u.id, name: u.name })),
  });
}

module.exports = function initMusicRoom(io) {
  io.on('connection', (socket) => {
    let currentRoom = null;
    let userName = 'Adventurer';

    socket.on('room:create', (data, callback) => {
      const name = (data?.name || 'Adventurer').slice(0, 30);
      userName = name;
      const code = createRoom();
      const room = rooms.get(code);

      socket.join(code);
      currentRoom = code;
      room.users.push({ id: socket.id, name });

      console.log(`[Music] Room ${code} created by ${name}`);
      if (typeof callback === 'function') callback({ roomId: code });
      broadcastState(io, code);
    });

    socket.on('room:join', (data, callback) => {
      const code = (data?.roomId || '').toUpperCase().trim();
      const name = (data?.name || 'Adventurer').slice(0, 30);
      userName = name;
      const room = rooms.get(code);

      if (!room) {
        if (typeof callback === 'function') callback({ error: 'Room not found' });
        return;
      }

      // Leave previous room if any
      if (currentRoom && currentRoom !== code) {
        leaveRoom(socket, io);
      }

      socket.join(code);
      currentRoom = code;
      room.users.push({ id: socket.id, name });

      console.log(`[Music] ${name} joined room ${code}`);
      if (typeof callback === 'function') callback({ roomId: code });
      broadcastState(io, code);
    });

    socket.on('room:leave', () => {
      leaveRoom(socket, io);
    });

    // --- Queue ---

    socket.on('queue:add', (data) => {
      const room = rooms.get(currentRoom);
      if (!room) return;

      const { videoId, title } = data || {};
      if (!videoId) return;

      room.queue.push({
        videoId,
        title: (title || 'Unknown').slice(0, 200),
        addedBy: userName,
        addedAt: Date.now(),
      });

      // Auto-play if this is the first track and nothing is playing
      if (room.queue.length === 1 && room.currentIndex === -1) {
        room.currentIndex = 0;
        room.isPlaying = true;
        room.currentTime = 0;
        room.lastSyncAt = Date.now();
      }

      console.log(`[Music] ${userName} added "${title}" to room ${currentRoom}`);
      broadcastState(io, currentRoom);
    });

    socket.on('queue:remove', (data) => {
      const room = rooms.get(currentRoom);
      if (!room) return;

      const { index } = data || {};
      if (index == null || index < 0 || index >= room.queue.length) return;

      room.queue.splice(index, 1);

      // Adjust current index
      if (room.queue.length === 0) {
        room.currentIndex = -1;
        room.isPlaying = false;
        room.currentTime = 0;
      } else if (index < room.currentIndex) {
        room.currentIndex--;
      } else if (index === room.currentIndex) {
        // Current track was removed
        if (room.currentIndex >= room.queue.length) {
          room.currentIndex = 0;
        }
        room.currentTime = 0;
        room.lastSyncAt = Date.now();
      }

      broadcastState(io, currentRoom);
    });

    socket.on('queue:reorder', (data) => {
      const room = rooms.get(currentRoom);
      if (!room) return;

      const { fromIndex, toIndex } = data || {};
      if (fromIndex == null || toIndex == null) return;
      if (fromIndex < 0 || fromIndex >= room.queue.length) return;
      if (toIndex < 0 || toIndex >= room.queue.length) return;

      const currentVideoId = room.queue[room.currentIndex]?.videoId;
      const [item] = room.queue.splice(fromIndex, 1);
      room.queue.splice(toIndex, 0, item);

      // Preserve current track reference
      if (currentVideoId) {
        room.currentIndex = room.queue.findIndex(q => q.videoId === currentVideoId && q.addedAt === item.addedAt) !== -1
          ? room.queue.findIndex(q => q.videoId === currentVideoId)
          : room.currentIndex;
      }

      broadcastState(io, currentRoom);
    });

    socket.on('queue:clear', () => {
      const room = rooms.get(currentRoom);
      if (!room) return;

      room.queue = [];
      room.currentIndex = -1;
      room.isPlaying = false;
      room.currentTime = 0;
      room.lastSyncAt = Date.now();

      broadcastState(io, currentRoom);
    });

    // --- Playback ---

    socket.on('playback:play', () => {
      const room = rooms.get(currentRoom);
      if (!room || room.currentIndex === -1) return;

      room.isPlaying = true;
      room.lastSyncAt = Date.now();
      broadcastState(io, currentRoom);
    });

    socket.on('playback:pause', (data) => {
      const room = rooms.get(currentRoom);
      if (!room) return;

      room.isPlaying = false;
      room.currentTime = data?.currentTime ?? getEstimatedTime(room);
      room.lastSyncAt = Date.now();
      broadcastState(io, currentRoom);
    });

    socket.on('playback:seek', (data) => {
      const room = rooms.get(currentRoom);
      if (!room) return;

      room.currentTime = data?.time ?? 0;
      room.lastSyncAt = Date.now();
      broadcastState(io, currentRoom);
    });

    socket.on('playback:skip', (data) => {
      const room = rooms.get(currentRoom);
      if (!room || room.queue.length === 0) return;

      const direction = data?.direction || 'next';

      if (direction === 'next') {
        if (room.repeat === 'one') {
          // Restart current track
          room.currentTime = 0;
        } else if (room.currentIndex < room.queue.length - 1) {
          room.currentIndex++;
          room.currentTime = 0;
        } else if (room.repeat === 'all') {
          room.currentIndex = 0;
          room.currentTime = 0;
        } else {
          room.isPlaying = false;
          room.currentTime = 0;
        }
      } else {
        if (room.currentIndex > 0) {
          room.currentIndex--;
          room.currentTime = 0;
        } else if (room.repeat === 'all') {
          room.currentIndex = room.queue.length - 1;
          room.currentTime = 0;
        }
      }

      room.isPlaying = true;
      room.lastSyncAt = Date.now();
      broadcastState(io, currentRoom);
    });

    socket.on('playback:ended', () => {
      const room = rooms.get(currentRoom);
      if (!room) return;

      if (room.repeat === 'one') {
        room.currentTime = 0;
        room.lastSyncAt = Date.now();
      } else if (room.currentIndex < room.queue.length - 1) {
        room.currentIndex++;
        room.currentTime = 0;
        room.lastSyncAt = Date.now();
      } else if (room.repeat === 'all') {
        room.currentIndex = 0;
        room.currentTime = 0;
        room.lastSyncAt = Date.now();
      } else {
        room.isPlaying = false;
        room.currentTime = 0;
        room.lastSyncAt = Date.now();
      }

      broadcastState(io, currentRoom);
    });

    socket.on('playback:select', (data) => {
      const room = rooms.get(currentRoom);
      if (!room) return;

      const { index } = data || {};
      if (index == null || index < 0 || index >= room.queue.length) return;

      room.currentIndex = index;
      room.currentTime = 0;
      room.isPlaying = true;
      room.lastSyncAt = Date.now();
      broadcastState(io, currentRoom);
    });

    socket.on('playback:repeat', (data) => {
      const room = rooms.get(currentRoom);
      if (!room) return;
      room.repeat = data?.mode || 'none';
      broadcastState(io, currentRoom);
    });

    socket.on('playback:shuffle', (data) => {
      const room = rooms.get(currentRoom);
      if (!room) return;
      room.shuffle = !!data?.enabled;
      broadcastState(io, currentRoom);
    });

    socket.on('playback:volume', () => {
      // Volume is local-only, no broadcast needed
    });

    // --- Disconnect ---

    socket.on('disconnect', () => {
      leaveRoom(socket, io);
    });

    function leaveRoom(sock, ioServer) {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (room) {
        room.users = room.users.filter(u => u.id !== sock.id);
        console.log(`[Music] ${userName} left room ${currentRoom} (${room.users.length} remaining)`);

        if (room.users.length === 0) {
          rooms.delete(currentRoom);
          console.log(`[Music] Room ${currentRoom} deleted (empty)`);
        } else {
          broadcastState(ioServer, currentRoom);
        }
      }
      sock.leave(currentRoom);
      currentRoom = null;
    }
  });
};
