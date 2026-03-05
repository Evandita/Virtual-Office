import React, { useState, useCallback } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { GameView } from './components/GameView';
import type { AvatarConfig } from './types';

const DEFAULT_AVATAR: AvatarConfig = {
  skinColor: '#FDBCB4',
  shirtColor: '#4A90D9',
  hairStyle: 0,
  hairColor: '#4A3728',
};

export const App: React.FC = () => {
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<AvatarConfig>(DEFAULT_AVATAR);

  const handleJoin = useCallback((name: string, avatarConfig: AvatarConfig) => {
    setPlayerName(name);
    setAvatar(avatarConfig);
  }, []);

  if (!playerName) {
    return <LoginScreen onJoin={handleJoin} defaultAvatar={DEFAULT_AVATAR} />;
  }

  return <GameView playerName={playerName} avatar={avatar} />;
};
