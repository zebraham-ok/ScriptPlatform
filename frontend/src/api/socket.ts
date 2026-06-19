/**
 * Socket.IO Client wrapper for game mode.
 * Handles real-time communication with the game server.
 */

import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

let _socket: Socket | null = null;

export function getSocket(): Socket | null {
  return _socket;
}

export function connectSocket(): Socket {
  if (_socket?.connected) return _socket;

  // Clean up previous disconnected socket
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
  }

  _socket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 20000,
  });

  _socket.on('connect', () => {
    console.log('[Socket] Connected:', _socket!.id);
  });

  _socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  _socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  return _socket;
}

export function disconnectSocket(): void {
  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }
}

// ---- Event Emitters ----

export function emitCreateRoom(data: {
  roomId?: string;
  mode: string;
  owner?: string;
  scriptId?: string;
  editorJson?: any;
  worldview?: string;
  rolePrefs?: string;
  totalRounds?: number;
}): void {
  const s = getSocket();
  if (!s) return;
  s.emit('create_room', data);
}

export function emitJoinRoom(roomId: string, playerId: string, nickname: string): void {
  const s = getSocket();
  if (!s) return;
  s.emit('join_room', { roomId, playerId, nickname });
}

export function emitLeaveRoom(roomId: string): void {
  const s = getSocket();
  if (!s) return;
  s.emit('leave_room', { roomId });
}

export function emitSubmitPreference(roomId: string, suggestions?: string[], rolePrefs?: string): void {
  const s = getSocket();
  if (!s) return;
  s.emit('submit_preference', { roomId, suggestions, rolePrefs });
}

export function emitSelectRole(roomId: string, characterId: string): void {
  const s = getSocket();
  if (!s) return;
  s.emit('select_role', { roomId, characterId });
}

export function emitSubmitCharacterSheet(
  roomId: string,
  characterId: string,
  attributes: Record<string, any>,
): void {
  const s = getSocket();
  if (!s) return;
  s.emit('submit_character_sheet', { roomId, characterId, attributes });
}

export function emitPlayerReady(roomId: string): void {
  const s = getSocket();
  if (!s) return;
  s.emit('player_ready', { roomId });
}

export function emitStartGame(roomId: string): void {
  const s = getSocket();
  if (!s) return;
  s.emit('start_game', { roomId });
}

export function emitSendMessage(roomId: string, content: string): void {
  const s = getSocket();
  if (!s) return;
  s.emit('send_message', { roomId, content });
}

export function emitDMOptionSelect(roomId: string, optionIndex: number): void {
  const s = getSocket();
  if (!s) return;
  s.emit('dm_option_select', { roomId, optionIndex });
}

export function emitTurnSkip(roomId: string): void {
  const s = getSocket();
  if (!s) return;
  s.emit('turn_skip', { roomId });
}

export function emitExtendTurn(roomId: string): void {
  const s = getSocket();
  if (!s) return;
  s.emit('extend_turn', { roomId });
}
