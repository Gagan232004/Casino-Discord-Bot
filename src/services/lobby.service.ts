export type GameMode = 'HIGH' | 'LOW';
export type GameType = 'BATTLE' | 'CLOSEST' | 'CRASH' | 'IMPOSTER';

export interface Lobby {
  hostId: string;
  channelId: string;
  gameType: GameType;
  rounds: number;
  betAmount: number;
  mode?: GameMode;
  players: string[]; // Array of discord user IDs
  state: 'SETUP' | 'WAITING' | 'IN_PROGRESS' | 'FINISHED';
}

export class LobbyService {
  // Store lobbies by channelId (one active lobby per channel to prevent chaos)
  static activeLobbies = new Map<string, Lobby>();

  static createLobby(channelId: string, hostId: string, gameType: 'BATTLE' | 'CLOSEST') {
    if (this.activeLobbies.has(channelId)) {
      throw new Error('There is already an active game happening in this channel!');
    }

    const lobby: Lobby = {
      hostId,
      channelId,
      gameType,
      rounds: 0,
      betAmount: 0,
      players: [hostId], // Host automatically joins
      state: 'SETUP' // Currently asking the host for setup details
    };

    this.activeLobbies.set(channelId, lobby);
    return lobby;
  }

  static getLobby(channelId: string) {
    return this.activeLobbies.get(channelId);
  }

  static joinLobby(channelId: string, userId: string) {
    const lobby = this.activeLobbies.get(channelId);
    if (!lobby) throw new Error('No active lobby exists in this channel.');
    if (lobby.state !== 'WAITING') throw new Error('The lobby is not currently accepting players.');
    if (lobby.players.includes(userId)) throw new Error('You have already joined this lobby.');
    if (lobby.players.length >= 8) throw new Error('Lobby is full! Maximum 8 players allowed.');

    lobby.players.push(userId);
    return lobby;
  }

  static leaveLobby(channelId: string, userId: string) {
    const lobby = this.activeLobbies.get(channelId);
    if (!lobby) throw new Error('No active lobby exists in this channel.');
    if (lobby.state !== 'WAITING') throw new Error('You can only leave before the game starts.');
    
    const index = lobby.players.indexOf(userId);
    if (index === -1) throw new Error('You are not in this lobby.');

    lobby.players.splice(index, 1);
    
    // If the host leaves, or no one is left, cancel the lobby
    if (lobby.hostId === userId || lobby.players.length === 0) {
      this.clearLobby(channelId);
      return { lobby, destroyed: true };
    }
    
    return { lobby, destroyed: false };
  }

  static clearLobby(channelId: string) {
    this.activeLobbies.delete(channelId);
  }
}
