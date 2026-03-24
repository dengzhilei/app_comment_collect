import React, { useEffect, useState } from 'react';
import { useGameStore, WIN_TARGET, TurnMode, CameraMode } from '../store';
import { Trophy, Coins, AlertCircle, Play, Settings, Home, Camera } from 'lucide-react';

export function UI() {
  const players = useGameStore(state => state.players);
  const winner = useGameStore(state => state.winner);
  const gameMode = useGameStore(state => state.gameMode);
  const settings = useGameStore(state => state.settings);
  const currentPlayerIndex = useGameStore(state => state.currentPlayerIndex);
  const autoSpin = useGameStore(state => state.autoSpin);
  const rollDice = useGameStore(state => state.rollDice);
  const initGame = useGameStore(state => state.initGame);
  const resetToMenu = useGameStore(state => state.resetToMenu);
  const toggleAutoSpin = useGameStore(state => state.toggleAutoSpin);
  const cameraMode = useGameStore(state => state.cameraMode);
  const setCameraMode = useGameStore(state => state.setCameraMode);

  // 本地状态用于设置面板
  const [trapDropPercentage, setTrapDropPercentage] = useState(50);
  const [stealPercentage, setStealPercentage] = useState(50);
  const [turnMode, setTurnMode] = useState<TurnMode>('turn-based');
  const [aiDelay, setAiDelay] = useState(false);

  const humanPlayer = players.find(p => !p.isAI);
  const humanPlayerIndex = players.findIndex(p => !p.isAI);
  
  // 判断是否可以掷骰子
  const isMyTurn = settings?.turnMode === 'simultaneous' || currentPlayerIndex === humanPlayerIndex;
  const isAnyoneMoving = players.some(p => p.stepsRemaining > 0);
  const canRoll = humanPlayer && humanPlayer.stepsRemaining === 0 && isMyTurn && !isAnyoneMoving &&
                  (settings?.turnMode === 'turn-based' || humanPlayer.cooldown < Date.now());

  // Force re-render for cooldown
  const [, setTick] = React.useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(interval);
  }, []);

  if (!gameMode || players.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white z-50 overflow-y-auto py-8">
        <div className="text-center p-8 bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 max-w-2xl w-full mx-4">
          <h1 className="text-4xl font-bold mb-6 text-yellow-400">Coin Runner 3D</h1>
          <p className="mb-6 text-gray-300">
            Roll the dice, collect coins, and deposit them at the BANK. First to {WIN_TARGET} coins wins! Watch out for traps and other players!
          </p>

          <div className="bg-gray-800 p-6 rounded-xl mb-8 text-left border border-gray-700">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-400">
              <Settings size={20} /> Game Settings
            </h2>
            
            <div className="space-y-6">
              <div>
                <label className="flex justify-between text-sm font-medium text-gray-300 mb-2">
                  <span>Trap Drop Percentage</span>
                  <span className="text-yellow-400">{trapDropPercentage}%</span>
                </label>
                <input 
                  type="range" 
                  min="0" max="100" step="10"
                  value={trapDropPercentage} 
                  onChange={(e) => setTrapDropPercentage(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Percentage of carried coins lost when stepping on a trap.</p>
              </div>

              <div>
                <label className="flex justify-between text-sm font-medium text-gray-300 mb-2">
                  <span>Steal Percentage</span>
                  <span className="text-yellow-400">{stealPercentage}%</span>
                </label>
                <input 
                  type="range" 
                  min="0" max="100" step="10"
                  value={stealPercentage} 
                  onChange={(e) => setStealPercentage(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Percentage of coins stolen when landing on the same tile as another player. (0 to disable)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Turn Mode</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="turnMode" 
                      value="simultaneous" 
                      checked={turnMode === 'simultaneous'} 
                      onChange={() => setTurnMode('simultaneous')}
                      className="accent-blue-500"
                    />
                    <span>Simultaneous (Real-time)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="turnMode" 
                      value="turn-based" 
                      checked={turnMode === 'turn-based'} 
                      onChange={() => setTurnMode('turn-based')}
                      className="accent-blue-500"
                    />
                    <span>Turn-based (Take turns)</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-3 text-sm font-medium text-gray-300 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={aiDelay} 
                    onChange={(e) => setAiDelay(e.target.checked)}
                    className="w-5 h-5 accent-blue-500 rounded"
                  />
                  <span>AI Thinking Delay (0-2s)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => initGame('classic', { trapDropPercentage, stealPercentage, turnMode, aiDelay })}
              className="px-6 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-blue-500/50 flex flex-col items-center gap-2 flex-1"
            >
              <span className="flex items-center gap-2"><Play size={20} /> Classic Mode</span>
              <span className="text-sm font-normal text-blue-200">Pass START to bank</span>
            </button>
            <button 
              onClick={() => initGame('strict_bank', { trapDropPercentage, stealPercentage, turnMode, aiDelay })}
              className="px-6 py-4 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-purple-500/50 flex flex-col items-center gap-2 flex-1"
            >
              <span className="flex items-center gap-2"><Play size={20} /> Strict Bank Mode</span>
              <span className="text-sm font-normal text-purple-200">Must LAND ON Bank to deposit</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (winner) {
    const winnerPlayer = players.find(p => p.id === winner);
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white z-50">
        <div className="text-center p-12 bg-gray-900 rounded-2xl shadow-2xl border border-yellow-500">
          <Trophy size={64} className="mx-auto text-yellow-400 mb-6" />
          <h1 className="text-5xl font-bold mb-4" style={{ color: winnerPlayer?.color }}>
            {winnerPlayer?.isAI ? 'AI Wins!' : 'You Win!'}
          </h1>
          <p className="text-xl mb-8 text-gray-300">
            {winnerPlayer?.isAI ? 'Better luck next time.' : 'Congratulations!'}
          </p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => initGame(gameMode, settings)}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xl transition-all shadow-lg hover:shadow-blue-500/50"
            >
              Play Again
            </button>
            <button 
              onClick={resetToMenu}
              className="px-8 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold text-xl transition-all shadow-lg"
            >
              Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  const now = Date.now();
  let buttonText = 'ROLL DICE';
  let buttonStyle = 'bg-blue-600 hover:bg-blue-500 text-white hover:scale-105 hover:shadow-blue-500/50';
  
  if (humanPlayer) {
    const isMoving = humanPlayer.stepsRemaining > 0;
    const isCooldown = settings?.turnMode === 'simultaneous' && humanPlayer.cooldown > now;
    
    if (settings?.turnMode === 'turn-based' && !isMyTurn) {
      buttonText = "OPPONENT'S TURN";
      buttonStyle = 'bg-gray-800 text-gray-500 cursor-not-allowed';
    } else if (isMoving) {
      buttonText = 'RUN';
      buttonStyle = 'bg-gray-800 text-gray-500 cursor-not-allowed';
    } else if (isCooldown) {
      const cdRemaining = ((humanPlayer.cooldown - now) / 1000).toFixed(1);
      buttonText = `CD ${cdRemaining}s`;
      buttonStyle = 'bg-gray-800 text-gray-500 cursor-not-allowed';
    } else if (autoSpin) {
      buttonText = 'AUTO SPINNING...';
      buttonStyle = 'bg-blue-800 text-blue-300 cursor-not-allowed';
    } else if (humanPlayer.autoRollAt && humanPlayer.autoRollAt > now) {
      const autoRollRemaining = Math.ceil((humanPlayer.autoRollAt - now) / 1000);
      buttonText = `ROLL DICE (${autoRollRemaining}s)`;
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Top Right: Menu Button & Camera Toggle */}
      <div className="absolute top-4 right-4 pointer-events-auto flex gap-2">
        <button
          onClick={() => {
            const modes: CameraMode[] = ['follow', 'isometric', 'top-down'];
            const nextMode = modes[(modes.indexOf(cameraMode) + 1) % modes.length];
            setCameraMode(nextMode);
          }}
          className="bg-gray-900/80 backdrop-blur border border-gray-700 p-3 rounded-xl text-gray-300 hover:text-white hover:bg-blue-600 hover:border-blue-500 transition-all shadow-lg flex items-center gap-2"
          title="Toggle Camera View"
        >
          <Camera size={20} />
          <span className="font-bold text-sm hidden sm:inline capitalize">{cameraMode}</span>
        </button>
        <button
          onClick={resetToMenu}
          className="bg-gray-900/80 backdrop-blur border border-gray-700 p-3 rounded-xl text-gray-300 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all shadow-lg flex items-center gap-2"
          title="Back to Menu"
        >
          <Home size={20} />
          <span className="font-bold text-sm hidden sm:inline">Menu</span>
        </button>
      </div>

      {/* Top Bar: Player Stats */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-center gap-4">
        {players.map((p, i) => {
          const isCurrentTurn = settings?.turnMode === 'turn-based' && currentPlayerIndex === i;
          const isThinking = p.autoRollAt && p.autoRollAt > now;
          const thinkRemaining = isThinking ? Math.ceil((p.autoRollAt! - now) / 1000) : null;

          return (
          <div key={p.id} className={`bg-gray-900/80 backdrop-blur border rounded-xl p-4 min-w-[200px] shadow-xl transition-all ${isCurrentTurn ? 'scale-110 ring-2 ring-white z-20' : 'border-gray-700'}`} style={{ borderTopColor: p.color, borderTopWidth: 4 }}>
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-white flex items-center gap-2">
                {p.isAI ? `AI ${p.id}` : 'You'}
                {isCurrentTurn && <span className="text-[10px] bg-white text-black px-1.5 py-0.5 rounded-full">TURN</span>}
              </span>
              <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-400">
                {p.bankedCoins} / {WIN_TARGET}
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-800 rounded-full h-2 mb-3">
              <div 
                className="h-2 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (p.bankedCoins / WIN_TARGET) * 100)}%`, backgroundColor: p.color }}
              />
            </div>

            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1 text-yellow-400">
                <Coins size={16} /> {p.carriedCoins}
              </div>
              {isThinking && (
                <div className="text-xs font-bold text-blue-400 animate-pulse">
                  {thinkRemaining}s...
                </div>
              )}
              {p.diceResult && !isThinking && (
                <div className="flex gap-1">
                  <span className="w-6 h-6 flex items-center justify-center bg-white text-black rounded font-bold text-xs">{p.diceResult[0]}</span>
                  <span className="w-6 h-6 flex items-center justify-center bg-white text-black rounded font-bold text-xs">{p.diceResult[1]}</span>
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>

      {/* Bottom Center: Roll Button */}
      {humanPlayer && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto flex flex-col items-center gap-4">
          <label className="flex items-center gap-2 bg-gray-900/90 px-4 py-2 rounded-full text-white cursor-pointer border border-gray-700 hover:bg-gray-800 transition-colors shadow-lg">
            <input 
              type="checkbox" 
              checked={autoSpin} 
              onChange={toggleAutoSpin} 
              className="w-4 h-4 accent-blue-500"
            />
            <span className="font-bold text-sm">Auto Spin</span>
          </label>
          <button
            onClick={() => rollDice(humanPlayer.id)}
            disabled={!canRoll || autoSpin}
            className={`
              px-12 py-6 rounded-2xl font-bold text-2xl shadow-2xl transition-all flex items-center gap-3
              ${buttonStyle}
            `}
          >
            <Play size={28} className={canRoll && !autoSpin ? 'animate-pulse' : ''} />
            {buttonText}
          </button>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur p-4 rounded-xl border border-gray-700 text-sm text-gray-300">
        <h3 className="font-bold text-white mb-2">Tiles</h3>
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-yellow-300 rounded-sm" /> Bank (Deposit Coins)</div>
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-emerald-300 rounded-sm" /> Bonus (+5 Coins)</div>
        <div className="flex items-center gap-2 mt-3 text-red-400"><AlertCircle size={14} /> Red Box = Trap (Lose Coins)</div>
      </div>
    </div>
  );
}
