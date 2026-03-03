export interface SocketSessionState {
  joined: boolean;
  playerId: string | null;
  nickname: string | null;
  lastUpgradeAtMs: number;
  lastInputSequence: number;
}

export interface ActivePlayerSession {
  socketId: string;
  playerId: string;
  nickname: string;
  resumeToken: string;
}

interface PendingReconnectSession {
  playerId: string;
  nickname: string;
  resumeToken: string;
  expiresAtMs: number;
  cleanupTimer: NodeJS.Timeout;
}

export interface JoinRequest {
  nickname: string;
  resumeToken?: string;
}

export class SessionService {
  private readonly socketSessions = new Map<string, SocketSessionState>();
  private readonly activePlayerSessions = new Map<string, ActivePlayerSession>();
  private readonly pendingReconnectByToken = new Map<string, PendingReconnectSession>();

  createSocketSession(socketId: string): void {
    this.socketSessions.set(socketId, {
      joined: false,
      playerId: null,
      nickname: null,
      lastUpgradeAtMs: 0,
      lastInputSequence: -1
    });
  }

  getSocketSession(socketId: string): SocketSessionState | undefined {
    return this.socketSessions.get(socketId);
  }

  registerActiveSession(active: ActivePlayerSession): void {
    this.activePlayerSessions.set(active.playerId, active);
  }

  completeJoin(socketId: string, playerId: string, nickname: string): SocketSessionState | null {
    const session = this.socketSessions.get(socketId);
    if (!session) {
      return null;
    }

    session.joined = true;
    session.playerId = playerId;
    session.nickname = nickname;
    session.lastInputSequence = -1;
    return session;
  }

  tryResume(
    joinRequest: JoinRequest,
    socketId: string,
    hasPlayer: (playerId: string) => boolean,
    removePlayer: (playerId: string) => void,
    onResumeRejected: () => void
  ): ActivePlayerSession | null {
    if (!joinRequest.resumeToken) {
      return null;
    }

    const pending = this.pendingReconnectByToken.get(joinRequest.resumeToken);
    if (!pending) {
      return null;
    }

    if (pending.expiresAtMs < Date.now()) {
      clearTimeout(pending.cleanupTimer);
      this.pendingReconnectByToken.delete(joinRequest.resumeToken);
      this.activePlayerSessions.delete(pending.playerId);
      removePlayer(pending.playerId);
      return null;
    }

    if (pending.nickname !== joinRequest.nickname) {
      onResumeRejected();
      return null;
    }

    if (!hasPlayer(pending.playerId)) {
      clearTimeout(pending.cleanupTimer);
      this.pendingReconnectByToken.delete(joinRequest.resumeToken);
      this.activePlayerSessions.delete(pending.playerId);
      return null;
    }

    clearTimeout(pending.cleanupTimer);
    this.pendingReconnectByToken.delete(joinRequest.resumeToken);

    const active: ActivePlayerSession = {
      socketId,
      playerId: pending.playerId,
      nickname: pending.nickname,
      resumeToken: pending.resumeToken
    };

    this.activePlayerSessions.set(pending.playerId, active);
    return active;
  }

  consumeDisconnect(
    socketId: string,
    reconnectGraceMs: number,
    onReconnectExpired: (playerId: string) => void
  ): SocketSessionState | null {
    const session = this.socketSessions.get(socketId);
    this.socketSessions.delete(socketId);

    if (!session || !session.joined || !session.playerId || !session.nickname) {
      return null;
    }

    const activeSession = this.activePlayerSessions.get(session.playerId);
    if (!activeSession || activeSession.socketId !== socketId) {
      return session;
    }

    const existingPending = this.pendingReconnectByToken.get(activeSession.resumeToken);
    if (existingPending) {
      clearTimeout(existingPending.cleanupTimer);
    }

    const cleanupTimer = setTimeout(() => {
      const pending = this.pendingReconnectByToken.get(activeSession.resumeToken);
      if (!pending) {
        return;
      }

      this.pendingReconnectByToken.delete(activeSession.resumeToken);
      this.activePlayerSessions.delete(pending.playerId);
      onReconnectExpired(pending.playerId);
    }, reconnectGraceMs);

    this.pendingReconnectByToken.set(activeSession.resumeToken, {
      playerId: session.playerId,
      nickname: session.nickname,
      resumeToken: activeSession.resumeToken,
      expiresAtMs: Date.now() + reconnectGraceMs,
      cleanupTimer
    });

    return session;
  }

  dispose(): void {
    for (const pending of this.pendingReconnectByToken.values()) {
      clearTimeout(pending.cleanupTimer);
    }
    this.pendingReconnectByToken.clear();
    this.activePlayerSessions.clear();
    this.socketSessions.clear();
  }
}
