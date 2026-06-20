/**
 * Game mode Zustand store.
 * Manages room state, chat, scene, dice, and UI state.
 */

import { create } from 'zustand';
import type {
  GameRoomInfo, PlayerInfo, ChatMessage, SceneInfo,
  DiceResult, PendingVote, EndingData, TurnInfo, GameStage, RoleDetail,
} from '../types';
import {
  connectSocket, disconnectSocket, getSocket,
  emitCreateRoom, emitJoinRoom, emitLeaveRoom,
  emitSubmitPreference, emitSelectRole, emitSubmitCharacterSheet,
  emitPlayerReady, emitStartGame, emitSendMessage,
  emitDMOptionSelect, emitTurnSkip, emitExtendTurn,
} from '../api/socket';
import { getToken, getStoredUser } from '../api';

interface GameStore {
  // ---- Connection ----
  socketConnected: boolean;
  playerId: string | null;
  nickname: string | null;

  // ---- Room ----
  roomInfo: GameRoomInfo | null;
  players: Record<string, PlayerInfo>;
  assignedRoles: Record<string, string>;  // characterId → playerId
  availableRoles: string[];               // available character IDs for selection
  roleDetails: RoleDetail[];              // role name/description for display

  // ---- Game state ----
  stage: GameStage | null;
  currentTurn: TurnInfo | null;

  // ---- Chat ----
  messages: ChatMessage[];
  dmOptions: string[];
  dmThinking: boolean;

  // ---- Scene ----
  scene: SceneInfo | null;

  // ---- Dice ----
  diceResults: DiceResult[];
  showDice: boolean;

  // ---- Vote ----
  pendingVote: PendingVote | null;
  submitVote: (option: string) => void;

  // ---- Ending ----
  ending: EndingData | null;

  // ---- UI ----
  loading: boolean;
  error: string | null;
  showNicknameModal: boolean;  // for guest join via link
  pendingRoomId: string | null;
  isCreator: boolean;  // whether current user created this room

  // === Actions ===

  // Connection
  connectAndJoin: (roomId: string, nickname: string, isCreator: boolean, createData?: any) => void;
  disconnect: () => void;

  // Room management
  createRoom: (data: any) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  setShowNicknameModal: (show: boolean, roomId?: string | null) => void;

  // Player actions
  submitPreference: (suggestions: string[], rolePrefs?: string) => void;
  selectRole: (characterId: string) => void;
  submitCharacterSheet: (characterId: string, attributes: Record<string, any>) => void;
  playerReady: () => void;
  startGame: () => void;

  // Gameplay
  sendMessage: (content: string) => void;
  selectDMOption: (optionIndex: number) => void;
  selectDMOptionByText: (optionText: string) => void;
  skipTurn: () => void;
  extendTurn: () => void;

  // Internal setters (called by socket event listeners)
  _setSocketConnected: (connected: boolean) => void;
  _setRoomInfo: (info: GameRoomInfo | null) => void;
  _setPlayers: (players: Record<string, PlayerInfo>) => void;
  _setStage: (stage: GameStage) => void;
  _setTurn: (turn: TurnInfo | null) => void;
  _addMessage: (msg: ChatMessage) => void;
  _setDMOptions: (options: string[]) => void;
  _setDMThinking: (thinking: boolean) => void;
  _setScene: (scene: SceneInfo | null) => void;
  _addDiceResult: (result: DiceResult) => void;
  _setPendingVote: (vote: PendingVote | null) => void;
  _setEnding: (ending: EndingData | null) => void;
  _setLoading: (loading: boolean) => void;
  _setError: (error: string | null) => void;
  _clearGame: () => void;
}

function _addMessage(msgs: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  return [...msgs.slice(-200), msg];
}

export const useGameStore = create<GameStore>((set, get) => ({
  socketConnected: false,
  playerId: null,
  nickname: null,
  roomInfo: null,
  players: {},
  assignedRoles: {},
  availableRoles: [],
  roleDetails: [],
  stage: null,
  currentTurn: null,
  messages: [],
  dmOptions: [],
  dmThinking: false,
  scene: null,
  diceResults: [],
  showDice: false,
  pendingVote: null,
  submitVote: () => {},
  ending: null,
  loading: false,
  error: null,
  showNicknameModal: false,
  pendingRoomId: null,
  isCreator: false,

  // ---- Connection ----
  connectAndJoin: (roomId: string, nickname: string, isCreator: boolean, createData?: any) => {
    const socket = connectSocket();
    set({ nickname, pendingRoomId: roomId, isCreator, loading: true });

    // Generate a tmp playerId for guests, or use stored user
    const storedUser = getStoredUser();
    const playerId = storedUser?.username || `guest_${Date.now().toString(36)}`;
    set({ playerId });

    socket.on('connect', () => {
      set({ socketConnected: true });
      console.log('[GameStore] Socket connected, joining/creating room...');

      if (isCreator && createData) {
        emitCreateRoom(createData);
      } else {
        emitJoinRoom(roomId, playerId, nickname);
      }
    });

    if (socket.connected) {
      set({ socketConnected: true });
      if (isCreator && createData) {
        emitCreateRoom(createData);
      } else {
        emitJoinRoom(roomId, playerId, nickname);
      }
    }

    // Bind event listeners
    _bindSocketEvents(socket, set, get);
  },

  disconnect: () => {
    const { roomInfo } = get();
    if (roomInfo) {
      emitLeaveRoom(roomInfo.roomId);
    }
    disconnectSocket();
    get()._clearGame();
  },

  // ---- Room Management ----
  createRoom: (data) => {
    const token = getToken();
    if (!token) {
      set({ error: '请先登录' });
      return;
    }

    // Ensure socket is connected (like connectAndJoin does)
    const socket = connectSocket();
    const storedUser = getStoredUser();
    const playerId = storedUser?.username || `guest_${Date.now().toString(36)}`;
    const nickname = storedUser?.displayName || storedUser?.username || `玩家${Date.now().toString(36).slice(-4)}`;
    set({ playerId, nickname, loading: true, isCreator: true });

    // Bind events if not already bound
    _bindSocketEvents(socket, set, get);

    const doCreate = () => {
      emitCreateRoom({
        ...data,
        roomId: data.roomId || '',
        mode: data.mode || 'sandbox',
      });
    };

    if (socket.connected) {
      doCreate();
    } else {
      socket.once('connect', () => {
        set({ socketConnected: true });
        doCreate();
      });
    }
  },

  joinRoom: (roomId) => {
    set({ pendingRoomId: roomId, showNicknameModal: true });
  },

  leaveRoom: () => {
    const { roomInfo } = get();
    if (roomInfo) {
      emitLeaveRoom(roomInfo.roomId);
    }
    get()._clearGame();
  },

  setShowNicknameModal: (show, roomId) => {
    set({ showNicknameModal: show, pendingRoomId: roomId || get().pendingRoomId });
  },

  // ---- Player Actions ----
  submitPreference: (suggestions, rolePrefs) => {
    const { roomInfo } = get();
    if (!roomInfo) return;
    emitSubmitPreference(roomInfo.roomId, suggestions, rolePrefs);
  },

  selectRole: (characterId) => {
    const { roomInfo } = get();
    if (!roomInfo) return;
    emitSelectRole(roomInfo.roomId, characterId);
  },

  submitCharacterSheet: (characterId, attributes) => {
    const { roomInfo } = get();
    if (!roomInfo) return;
    emitSubmitCharacterSheet(roomInfo.roomId, characterId, attributes);
  },

  playerReady: () => {
    const { roomInfo } = get();
    if (!roomInfo) return;
    emitPlayerReady(roomInfo.roomId);
  },

  startGame: () => {
    const { roomInfo } = get();
    if (!roomInfo) return;
    emitStartGame(roomInfo.roomId);
  },

  // ---- Gameplay ----
  sendMessage: (content) => {
    const { roomInfo } = get();
    if (!roomInfo || !content.trim()) return;
    emitSendMessage(roomInfo.roomId, content.trim());
  },

  selectDMOption: (optionIndex) => {
    const { roomInfo, dmOptions } = get();
    if (!roomInfo) return;
    const text = dmOptions[optionIndex];
    if (text) {
      emitDMOptionSelect(roomInfo.roomId, text);
    }
  },

  selectDMOptionByText: (optionText) => {
    const { roomInfo } = get();
    if (!roomInfo) return;
    emitDMOptionSelect(roomInfo.roomId, optionText);
  },

  skipTurn: () => {
    const { roomInfo } = get();
    if (!roomInfo) return;
    emitTurnSkip(roomInfo.roomId);
  },

  extendTurn: () => {
    const { roomInfo } = get();
    if (!roomInfo) return;
    emitExtendTurn(roomInfo.roomId);
  },

  // ---- Internal Setters ----
  _setSocketConnected: (connected) => set({ socketConnected: connected }),
  _setRoomInfo: (info) => set({ roomInfo: info }),
  _setPlayers: (players) => set({ players }),
  _setStage: (stage) => set({ stage }),
  _setTurn: (turn) => set({ currentTurn: turn }),
  _addMessage: (msg) => set((s) => ({ messages: _addMessage(s.messages, msg as any) })),
  _setDMOptions: (options) => set({ dmOptions: options }),
  _setDMThinking: (thinking) => set({ dmThinking: thinking }),
  _setScene: (scene) => set({ scene }),
  _addDiceResult: (result) => set((s) => ({ diceResults: [...s.diceResults, result], showDice: true })),
  _setPendingVote: (vote: PendingVote | null) => set({ pendingVote: vote }),
  _setEnding: (ending) => set({ ending }),
  _setLoading: (loading) => set({ loading }),
  _setError: (error) => set({ error }),

  _clearGame: () => {
    _boundOnce = false;  // allow re-bind on next connectAndJoin
    set({
      socketConnected: false,
      roomInfo: null,
      players: {},
      assignedRoles: {},
      availableRoles: [],
  roleDetails: [],
      stage: null,
      currentTurn: null,
      messages: [],
      dmOptions: [],
      dmThinking: false,
      scene: null,
      diceResults: [],
      showDice: false,
      pendingVote: null,
      ending: null,
      loading: false,
      error: null,
      isCreator: false,
    });
  },
}));

// ---- Socket Event Binding ----
let _boundOnce = false;

function _bindSocketEvents(
  socket: any,
  set: (fn: any) => void,
  get: () => GameStore,
): void {
  if (_boundOnce) return;
  _boundOnce = true;

  // We need to re-bind on reconnection
  const bindAll = () => {
    socket.off('room_created');
    socket.off('room_joined');
    socket.off('room_state');
    socket.off('stage_change');
    socket.off('chat_message');
    socket.off('private_message');
    socket.off('scene_update');
    socket.off('image_message');
    socket.off('dm_status');
    socket.off('dice_roll');
    socket.off('character_update');
    socket.off('ending_card');
    socket.off('join_error');
    socket.off('role_update');
    socket.off('all_ready');
    socket.off('turn_start');
    socket.off('turn_skip');
    socket.off('turn_timeout');
    socket.off('all_acted');

    socket.on('room_created', (data: any) => {
      console.log('[Socket] room_created:', data);
      if (data.roomId) {
        const { nickname, playerId } = get() as any;
        emitJoinRoom(data.roomId, playerId, nickname);
      }
    });

    socket.on('room_joined', (data: any) => {
      console.log('[Socket] room_joined:', data);
      set((s: GameStore) => ({
        ...s,
        roomInfo: {
          roomId: data.roomId,
          roomName: data.scriptTitle || `房间 ${data.roomId}`,
          scriptTitle: data.scriptTitle || '',
          mode: data.mode || 'script',
          owner: data.owner || '',
          stage: data.stage || 'LOBBY',
          players: data.players || {},
          totalRounds: data.totalRounds || 15,
          shareUrl: data.shareUrl || `/game/room/${data.roomId}`,
        },
        playerId: data.playerId || get().playerId,
        role: data.role || 'player',
        stage: data.stage || 'LOBBY',
        loading: false,
      }));
    });

    socket.on('room_state', (data: any) => {
      console.log('[Socket] room_state:', data);
      set((s: GameStore) => {
        // Build players map from array, keyed by both sid and playerId
        const playersMap: Record<string, any> = {};
        if (Array.isArray(data.players)) {
          for (const p of data.players) {
            const key = p.sid || p.playerId;
            playersMap[key] = p;
            // Also index by playerId for frontend lookup
            if (p.playerId && p.playerId !== key) {
              playersMap[p.playerId] = { ...p, _sid: key };
            }
          }
        }
        // Build assignedRoles from data.roles (backend sends roles array, not assignedRoles dict)
        const assignedRoles: Record<string, string> = {};
        if (Array.isArray(data.roles)) {
          for (const r of data.roles) {
            if (r.characterId) {
              assignedRoles[r.characterId] = r.playerId || '';
            }
          }
        }
        // Update roomInfo with complete data from room_state
        const updatedRoomInfo = {
          ...s.roomInfo,
          roomId: data.roomId || s.roomInfo?.roomId || '',
          roomName: data.scriptTitle || s.roomInfo?.roomName || `房间 ${data.roomId}`,
          scriptTitle: data.scriptTitle || s.roomInfo?.scriptTitle || '',
          mode: data.mode || s.roomInfo?.mode || 'sandbox',
          owner: data.ownerSid || s.roomInfo?.owner || '',
          stage: data.stage || s.stage || 'LOBBY',
          players: Object.keys(playersMap).length > 0 ? playersMap : (s.roomInfo?.players || s.players),
          totalRounds: data.totalRounds || s.roomInfo?.totalRounds || 15,
        };
        return {
          ...s,
          roomInfo: updatedRoomInfo as any,
          players: Object.keys(playersMap).length > 0 ? playersMap : (data.players as any || s.players),
          stage: data.stage || s.stage,
          assignedRoles: Object.keys(assignedRoles).length > 0 ? assignedRoles : s.assignedRoles,
          currentTurn: data.currentTurn || s.currentTurn,
          loading: false,
        };
      });
    });

    socket.on('stage_change', (data: any) => {
      const newStage = data.toStage || data.stage;
      console.log('[Socket] stage_change:', data.fromStage, '→', newStage);
      set((s: GameStore) => ({
        ...s,
        stage: newStage,
        loading: false,
      }));
      // Add system message for stage change
      const stageNames: Record<string, string> = {
        LOBBY: '等待大厅',
        GENERATE: 'AI 正在生成剧本...',
        JSON_LOAD: '正在加载剧本...',
        ROLE_SELECT: '角色选择',
        PLAYING: '游戏开始！',
        VOTE: '投票环节',
        CHECK: '检定环节',
        ENDING: '游戏结束',
      };
      const msg: ChatMessage = {
        id: `sys_${Date.now()}`,
        senderId: 'system',
        senderName: '系统',
        content: stageNames[newStage] || newStage,
        type: 'system',
        timestamp: Date.now(),
      };
      set((s: GameStore) => ({ ...s, messages: _addMessage(s.messages, msg) }));
    });

    socket.on('chat_message', (data: any) => {
      console.log('[Socket] chat_message:', data.role, data.sender, data.content?.substring(0, 80));
      // Map server field names → frontend field names:
      // Server: { role, sender, senderSid, characterId, content, timestamp, options }
      // Frontend: ChatMessage { type, senderName, senderId, content, timestamp, dmOptions }
      const msg: ChatMessage = {
        id: data.id || `msg_${Date.now()}`,
        senderId: data.senderSid || data.senderId || 'unknown',
        senderName: data.sender || data.senderName || '未知',
        content: data.content || '',
        type: data.role || data.type || 'player',
        timestamp: typeof data.timestamp === 'string'
          ? new Date(data.timestamp).getTime()
          : (data.timestamp || Date.now()),
        dmOptions: data.options || data.dmOptions || undefined,
        narration: data.narration || undefined,
      };
      set((s: GameStore) => {
        // If this message replaces the opening, swap the last DM message
        if (data.replaces_opening) {
          const msgs = [...s.messages];
          // Find and replace the last dm/dm_narration message
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].type === 'dm' || msgs[i].type === 'dm_narration') {
              msgs[i] = msg;
              return { ...s, messages: msgs };
            }
          }
        }
        return { ...s, messages: _addMessage(s.messages, msg) };
      });
      if (msg.dmOptions?.length) {
        set((s: GameStore) => ({ ...s, dmOptions: msg.dmOptions }));
      }
    });

    socket.on('private_message', (data: any) => {
      const msg: ChatMessage = {
        id: `dm_${Date.now()}`,
        senderId: 'dm',
        senderName: 'DM（私信）',
        content: data.content || '',
        type: 'private',
        timestamp: Date.now(),
        narration: data.narration,
        dmOptions: data.dmOptions,
        targetPlayerId: data.targetPlayerId,
      };
      set((s: GameStore) => ({ ...s, messages: _addMessage(s.messages, msg) }));
    });

    socket.on('scene_update', (data: any) => {
      set((s: GameStore) => ({
        ...s,
        scene: {
          location: data.scene || data.location || '',
          description: data.description || data.scene_description || '',
          imageUrl: data.image || data.imageUrl || s.scene?.imageUrl || null,
          characters: data.characters || [],
        },
      }));
    });

    socket.on('image_message', (data: any) => {
      // Scene/avatar image from AI generation
      if (data.url) {
        set((s: GameStore) => ({
          ...s,
          scene: s.scene ? {
            ...s.scene,
            imageUrl: data.url,
          } : {
            location: data.label || '',
            description: '',
            imageUrl: data.url,
            characters: [],
          },
        }));
        console.log('[Socket] image_message received:', data.label || 'scene_image');
      }
    });

    // Merged dm_status handler: handles both thinking flag and status messages
    socket.on('dm_status', (data: any) => {
      const thinking = data.thinking;
      if (typeof thinking === 'boolean') {
        set((s: GameStore) => ({ ...s, dmThinking: thinking }));
      }
      // If there's a status text, also add as system message
      if (data.status) {
        const msg: ChatMessage = {
          id: `dmstatus_${Date.now()}`,
          senderId: 'system',
          senderName: '系统',
          content: data.status,
          type: 'system',
          timestamp: Date.now(),
        };
        set((s: GameStore) => ({ ...s, messages: _addMessage(s.messages, msg) }));
      }
    });

    socket.on('dice_roll', (data: any) => {
      const inner = data.result || data;
      // Check if it's a vote result (has options field)
      if (inner.options) {
        const pendingVote: PendingVote = {
          name: inner.name || '投票',
          options: inner.options || [],
          results: inner.results || {},
          winner: inner.winner,
          complete: inner.complete,
        };
        set((s: GameStore) => ({ ...s, pendingVote }));
        // persist until next vote/dice result replaces it
      } else {
        // Dice check result — DM will now process this, show thinking
        const result: DiceResult = {
          id: `dice_${Date.now()}`,
          playerName: inner.playerName || data.playerName || '未知',
          target: inner.checkTarget || inner.target || '',
          description: inner.description || '',
          dice: inner.diceRoll || inner.total || inner.dice || 0,
          difficulty: inner.difficulty || 0,
          result: inner.success ? 'success' : 'failure',
          timestamp: Date.now(),
        };
        set((s: GameStore) => ({
          ...s,
          diceResults: [...s.diceResults, result],
          showDice: true,
          dmThinking: true,  // DM will now narrate the check result
        }));
        // persist until next dice/vote result replaces it
      }
    });

    socket.on('character_update', (data: any) => {
      // Find the player key in the map that matches this character
      const playerKey = data.playerId || data.playerSid || '';
      let targetKey = playerKey;
      // If direct playerId lookup fails, search by characterId
      if (playerKey && !(playerKey in get().players)) {
        targetKey = '';
      }
      if (!targetKey && data.characterId) {
        for (const [key, p] of Object.entries(get().players as Record<string, any>)) {
          if (p.characterId === data.characterId) {
            targetKey = key;
            break;
          }
        }
      }
      if (!targetKey) return;
      set((s: GameStore) => ({
        ...s,
        players: {
          ...s.players,
          [targetKey]: {
            ...s.players[targetKey],
            characterId: data.characterId || s.players[targetKey]?.characterId,
            characterName: data.characterName || s.players[targetKey]?.characterName,
            attributes: data.attributes || s.players[targetKey]?.attributes || {},
            inventory: data.inventory || s.players[targetKey]?.inventory || [],
          },
        },
      }));
    });

    socket.on('ending_card', (data: any) => {
      set((s: GameStore) => ({
        ...s,
        ending: {
          title: data.title || '游戏结束',
          description: data.description || '',
          epilogue: data.epilogue || '',
          characterFates: data.characterFates || [],
        },
        stage: 'ENDING',
      }));
    });

    socket.on('join_error', (data: any) => {
      set((s: GameStore) => ({ ...s, error: data.message || '加入房间失败' }));
    });

    socket.on('role_update', (data: any) => {
      // Server may send: { availableRoles: [...], roleDetails: [...] } or { characterId, playerSid, nickname }
      console.log('[Socket] role_update received:', JSON.stringify(data));
      if (data.availableRoles !== undefined) {
        console.log('[Socket] role_update setting availableRoles:', data.availableRoles, 'roleDetails:', data.roleDetails);
        set((s: GameStore) => ({
          ...s,
          availableRoles: data.availableRoles,
          roleDetails: data.roleDetails || [],
        }));
      }
      if (data.assignedRoles || data.characterId) {
        set((s: GameStore) => ({
          ...s,
          assignedRoles: data.assignedRoles || s.assignedRoles,
        }));
      }
    });

    socket.on('all_ready', () => {
      const msg: ChatMessage = {
        id: `sys_${Date.now()}`,
        senderId: 'system',
        senderName: '系统',
        content: '所有玩家已就绪！房主可以开始游戏了。',
        type: 'system',
        timestamp: Date.now(),
      };
      set((s: GameStore) => ({ ...s, messages: _addMessage(s.messages, msg) }));
    });

    socket.on('turn_start', (data: any) => {
      set((s: GameStore) => ({
        ...s,
        currentTurn: {
          round: data.round || 1,
          phase: data.phase || 'action',
          timeRemaining: data.timeRemaining || 120,
          actedPlayers: [],
          skippedPlayers: [],
        },
      }));
    });

    socket.on('turn_skip', (data: any) => {
      const msg: ChatMessage = {
        id: `sys_${Date.now()}`,
        senderId: 'system',
        senderName: '系统',
        content: `${data.playerName || '某玩家'} 跳过了本轮行动`,
        type: 'system',
        timestamp: Date.now(),
      };
      set((s: GameStore) => ({ ...s, messages: _addMessage(s.messages, msg) }));
    });

    socket.on('turn_timeout', (data: any) => {
      const msg: ChatMessage = {
        id: `sys_${Date.now()}`,
        senderId: 'system',
        senderName: '系统',
        content: `${data.playerName || '某玩家'} 行动超时，自动跳过`,
        type: 'system',
        timestamp: Date.now(),
      };
      set((s: GameStore) => ({ ...s, messages: _addMessage(s.messages, msg) }));
    });

    socket.on('all_acted', () => {
      const msg: ChatMessage = {
        id: `sys_${Date.now()}`,
        senderId: 'system',
        senderName: '系统',
        content: '所有玩家行动完毕，DM 正在处理...',
        type: 'system',
        timestamp: Date.now(),
      };
      set((s: GameStore) => ({ ...s, messages: _addMessage(s.messages, msg), dmThinking: true }));
    });

    socket.on('disconnect', () => {
      set({ socketConnected: false });
      const msg: ChatMessage = {
        id: `sys_${Date.now()}`,
        senderId: 'system',
        senderName: '系统',
        content: '与服务器断开连接，正在重连...',
        type: 'system',
        timestamp: Date.now(),
      };
      set((s: GameStore) => ({ ...s, messages: _addMessage(s.messages, msg) }));
    });
  };

  bindAll();

  // Re-bind on reconnect
  socket.on('connect', () => {
    bindAll();
    set({ socketConnected: true });
  });
}
