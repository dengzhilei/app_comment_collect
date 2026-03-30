import React, { useEffect, useState } from 'react';
import { useGameStore, GameMode, TurnMode, CameraMode } from '../store';
import { Trophy, Coins, AlertCircle, Play, Settings, Home, Camera } from 'lucide-react';

function CountdownOverlay() {
  const countdownUntil = useGameStore(state => state.countdownUntil);
  const [display, setDisplay] = useState<string | null>(null);

  useEffect(() => {
    if (!countdownUntil) return;
    let raf: number;
    const update = () => {
      const remaining = countdownUntil - Date.now();
      if (remaining <= 0) {
        setDisplay(null);
        return;
      }
      if (remaining > 3000) {
        setDisplay('3');
      } else if (remaining > 2000) {
        setDisplay('2');
      } else if (remaining > 1000) {
        setDisplay('1');
      } else {
        setDisplay('GO!');
      }
      raf = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(raf);
  }, [countdownUntil]);

  if (!display) return null;

  const isGo = display === 'GO!';

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div
        key={display}
        className="animate-countdown-pop"
        style={{
          fontSize: isGo ? '8rem' : '10rem',
          fontWeight: 900,
          color: isGo ? '#22c55e' : '#ffffff',
          textShadow: `0 0 40px ${isGo ? '#22c55e' : '#3b82f6'}, 0 4px 20px rgba(0,0,0,0.8)`,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {display}
      </div>
    </div>
  );
}

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
  const cameraZoom = useGameStore(state => state.cameraZoom);
  const setCameraZoom = useGameStore(state => state.setCameraZoom);
  const cameraHeight = useGameStore(state => state.cameraHeight);
  const setCameraHeight = useGameStore(state => state.setCameraHeight);
  const setNextDice = useGameStore(state => state.setNextDice);

  const [gmOpen, setGmOpen] = useState(false);
  const [gmSteps, setGmSteps] = useState(7);

  const [boardSize, setBoardSize] = useState<number>(32);
  const [playerCount, setPlayerCount] = useState<number>(3);
  const [trapDropPercentage, setTrapDropPercentage] = useState(50);
  const [stealPercentage, setStealPercentage] = useState(50);
  const [turnMode, setTurnMode] = useState<TurnMode>('simultaneous');
  const [selectedMode, setSelectedMode] = useState<GameMode>('strict_bank');
  const [aiDelay, setAiDelay] = useState(false);
  const [winTarget, setWinTarget] = useState(250);
  const [bankCount, setBankCount] = useState(6);
  const [trapCount, setTrapCount] = useState(9);
  const [bonus10Count, setBonus10Count] = useState(4);
  const [bonusX2Count, setBonusX2Count] = useState(1);
  const [attackCount, setAttackCount] = useState(2);
  const [attackDamage, setAttackDamage] = useState(20);
  const [carryLimit, setCarryLimit] = useState(60);

  const applyBoardDefaults = (size: number, mode: GameMode) => {
    if (size === 24) {
      setBankCount(mode === 'classic' ? 1 : 4);
      setTrapCount(6);
      setBonus10Count(3);
      setBonusX2Count(1);
      setAttackCount(1);
      setWinTarget(mode === 'classic' ? 200 : 150);
    } else if (size === 32) {
      setBankCount(mode === 'classic' ? 1 : 6);
      setTrapCount(9);
      setBonus10Count(4);
      setBonusX2Count(1);
      setAttackCount(2);
      setWinTarget(mode === 'classic' ? 300 : 250);
    } else {
      setBankCount(mode === 'classic' ? 1 : 7);
      setTrapCount(12);
      setBonus10Count(6);
      setBonusX2Count(2);
      setAttackCount(3);
      setWinTarget(mode === 'classic' ? 300 : 250);
    }
  };

  const humanPlayer = players.find(p => !p.isAI);
  const humanPlayerIndex = players.findIndex(p => !p.isAI);
  
  // 判断是否可以掷骰子
  const isMyTurn = settings?.turnMode === 'simultaneous' || currentPlayerIndex === humanPlayerIndex;
  const isAnyoneMoving = players.some(p => p.stepsRemaining > 0);
  const canRoll = humanPlayer && humanPlayer.stepsRemaining === 0 && isMyTurn &&
                  (settings?.turnMode === 'turn-based'
                    ? humanPlayer.diceResult === null && !isAnyoneMoving
                    : humanPlayer.cooldown < Date.now());

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
            Roll the dice, collect coins, and deposit them at the BANK. First to {winTarget} coins wins! Watch out for traps and other players!
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
                <label className="flex justify-between text-sm font-medium text-gray-300 mb-2">
                  <span>Carry Limit</span>
                  <span className="text-yellow-400">{carryLimit}</span>
                </label>
                <input 
                  type="range" 
                  min="20" max="200" step="10"
                  value={carryLimit} 
                  onChange={(e) => setCarryLimit(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Max coins a player can carry. Excess coins are lost.</p>
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Board Size</label>
                <div className="flex gap-4 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="boardSize"
                      value="24"
                      checked={boardSize === 24}
                      onChange={() => { setBoardSize(24); setPlayerCount(2); applyBoardDefaults(24, selectedMode); }}
                      className="accent-blue-500"
                    />
                    <span>Small (7×7, 24)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="boardSize"
                      value="32"
                      checked={boardSize === 32}
                      onChange={() => { setBoardSize(32); setPlayerCount(3); applyBoardDefaults(32, selectedMode); }}
                      className="accent-blue-500"
                    />
                    <span>Medium (9×9, 32)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="boardSize"
                      value="40"
                      checked={boardSize === 40}
                      onChange={() => { setBoardSize(40); setPlayerCount(3); applyBoardDefaults(40, selectedMode); }}
                      className="accent-blue-500"
                    />
                    <span>Large (11×11, 40)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Players</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="playerCount"
                      value="2"
                      checked={playerCount === 2}
                      onChange={() => setPlayerCount(2)}
                      className="accent-blue-500"
                    />
                    <span>2 Players (1 Human + 1 AI)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="playerCount"
                      value="3"
                      checked={playerCount === 3}
                      onChange={() => setPlayerCount(3)}
                      className="accent-blue-500"
                    />
                    <span>3 Players (1 Human + 2 AI)</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-600 pt-4">
                <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Map Layout</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex justify-between text-sm font-medium text-gray-300 mb-1">
                      <span>Bank Tiles</span>
                      <span className="text-yellow-400">{bankCount}</span>
                    </label>
                    <input type="range" min="1" max={Math.floor(boardSize / 4)} step="1" value={bankCount}
                      onChange={(e) => setBankCount(Number(e.target.value))}
                      className="w-full accent-yellow-500" />
                  </div>
                  <div>
                    <label className="flex justify-between text-sm font-medium text-gray-300 mb-1">
                      <span>Trap Tiles</span>
                      <span className="text-red-400">{trapCount}</span>
                    </label>
                    <input type="range" min="0" max={Math.floor(boardSize / 2)} step="1" value={trapCount}
                      onChange={(e) => setTrapCount(Number(e.target.value))}
                      className="w-full accent-red-500" />
                  </div>
                  <div>
                    <label className="flex justify-between text-sm font-medium text-gray-300 mb-1">
                      <span>+5 Tiles</span>
                      <span className="text-emerald-400">{bonus10Count}</span>
                    </label>
                    <input type="range" min="0" max={Math.floor(boardSize / 3)} step="1" value={bonus10Count}
                      onChange={(e) => setBonus10Count(Number(e.target.value))}
                      className="w-full accent-emerald-500" />
                  </div>
                  <div>
                    <label className="flex justify-between text-sm font-medium text-gray-300 mb-1">
                      <span>x2 Tiles</span>
                      <span className="text-purple-400">{bonusX2Count}</span>
                    </label>
                    <input type="range" min="0" max={Math.floor(boardSize / 5)} step="1" value={bonusX2Count}
                      onChange={(e) => setBonusX2Count(Number(e.target.value))}
                      className="w-full accent-purple-500" />
                  </div>
                  <div>
                    <label className="flex justify-between text-sm font-medium text-gray-300 mb-1">
                      <span>Attack Tiles</span>
                      <span className="text-orange-400">{attackCount}</span>
                    </label>
                    <input type="range" min="0" max={Math.floor(boardSize / 5)} step="1" value={attackCount}
                      onChange={(e) => setAttackCount(Number(e.target.value))}
                      className="w-full accent-orange-500" />
                  </div>
                  <div>
                    <label className="flex justify-between text-sm font-medium text-gray-300 mb-1">
                      <span>Attack Damage</span>
                      <span className="text-orange-400">-{attackDamage}</span>
                    </label>
                    <input type="range" min="5" max="50" step="5" value={attackDamage}
                      onChange={(e) => setAttackDamage(Number(e.target.value))}
                      className="w-full accent-orange-500" />
                  </div>
                </div>
              </div>

              <div>
                <label className="flex justify-between text-sm font-medium text-gray-300 mb-2">
                  <span>Win Target (Coins)</span>
                  <span className="text-yellow-400">{winTarget}</span>
                </label>
                <input 
                  type="range" 
                  min="50" max="1000" step="50"
                  value={winTarget} 
                  onChange={(e) => setWinTarget(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">First player to bank this many coins wins the game.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Game Mode</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gameMode"
                      value="classic"
                      checked={selectedMode === 'classic'}
                      onChange={() => { setSelectedMode('classic'); applyBoardDefaults(boardSize, 'classic'); }}
                      className="accent-blue-500"
                    />
                    <span>Pass Bank to deposit</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gameMode"
                      value="strict_bank"
                      checked={selectedMode === 'strict_bank'}
                      onChange={() => { setSelectedMode('strict_bank'); applyBoardDefaults(boardSize, 'strict_bank'); }}
                      className="accent-blue-500"
                    />
                    <span>Must LAND ON Bank</span>
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

          <button
            onClick={() => initGame(selectedMode, { boardSize, playerCount, trapDropPercentage, stealPercentage, turnMode, aiDelay, winTarget, bankCount, trapCount, bonus10Count, bonusX2Count, attackCount, attackDamage, carryLimit })}
            className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xl transition-all shadow-lg hover:shadow-blue-500/50 flex items-center justify-center gap-3"
          >
            <Play size={24} /> Start Game
          </button>
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
      if (!canRoll) {
        buttonStyle = 'bg-gray-800 text-gray-500 cursor-not-allowed';
      }
    } else if (!canRoll) {
      buttonStyle = 'bg-gray-800 text-gray-500 cursor-not-allowed';
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <CountdownOverlay />
      {/* Top Right: Menu Button & Camera Toggle */}
      <div className="absolute top-4 right-4 pointer-events-auto flex flex-col items-end gap-2">
        <div className="flex gap-2">
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
        <div className="bg-gray-900/80 backdrop-blur border border-gray-700 rounded-xl px-3 py-2 flex flex-col gap-1.5 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs w-8">Zoom</span>
            <input
              type="range" min="0.5" max="2.0" step="0.1" value={cameraZoom}
              onChange={(e) => setCameraZoom(Number(e.target.value))}
              className="w-20 accent-blue-500"
            />
            <span className="text-white text-xs font-bold w-8 text-center">{cameraZoom.toFixed(1)}x</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs w-8">Pitch</span>
            <input
              type="range" min="-1" max="1" step="0.1" value={cameraHeight}
              onChange={(e) => setCameraHeight(Number(e.target.value))}
              className="w-20 accent-blue-500"
            />
            <span className="text-white text-xs font-bold w-8 text-center">{cameraHeight > 0 ? '+' : ''}{cameraHeight.toFixed(1)}</span>
          </div>
        </div>
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
                {p.bankedCoins} / {settings.winTarget}
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-800 rounded-full h-2 mb-3">
              <div 
                className="h-2 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (p.bankedCoins / settings.winTarget) * 100)}%`, backgroundColor: p.color }}
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
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-emerald-300 rounded-sm" /> +5 (Bonus Coins)</div>
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-purple-400 rounded-sm" /> x2 (Double Coins)</div>
        <div className="flex items-center gap-2 mb-1"><div className="w-3 h-3 bg-orange-400 rounded-sm" /> ATK (Demolish Leader's Bank)</div>
        <div className="flex items-center gap-2 mt-3 text-red-400"><AlertCircle size={14} /> Red Box = Trap (Lose Coins)</div>
      </div>

      {/* GM Panel */}
      {humanPlayer && (
        <div className="absolute bottom-4 right-4 pointer-events-auto">
          {gmOpen ? (
            <div className="bg-gray-900/90 backdrop-blur border border-amber-600 rounded-xl p-4 shadow-xl min-w-[180px]">
              <div className="flex justify-between items-center mb-3">
                <span className="text-amber-400 font-bold text-sm">GM</span>
                <button onClick={() => setGmOpen(false)} className="text-gray-500 hover:text-white text-xs">Close</button>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-300 text-sm w-16">Steps</span>
                <input
                  type="range" min="2" max="12" step="1" value={gmSteps}
                  onChange={(e) => setGmSteps(Number(e.target.value))}
                  className="flex-1 accent-amber-500"
                />
                <span className="text-amber-400 font-bold w-6 text-center">{gmSteps}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const d1 = Math.max(1, Math.min(6, Math.ceil(gmSteps / 2)));
                    const d2 = gmSteps - d1;
                    setNextDice(humanPlayer.id, [d1, d2]);
                  }}
                  className="flex-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-bold text-sm rounded-lg transition-colors"
                >
                  Set
                </button>
                <button
                  onClick={() => setNextDice(humanPlayer.id, null)}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold text-sm rounded-lg transition-colors"
                >
                  Clear
                </button>
              </div>
              {humanPlayer.nextDiceResult && (
                <div className="mt-2 text-center text-xs text-amber-400">
                  Next: [{humanPlayer.nextDiceResult[0]}, {humanPlayer.nextDiceResult[1]}] = {humanPlayer.nextDiceResult[0] + humanPlayer.nextDiceResult[1]} steps
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setGmOpen(true)}
              className="bg-gray-900/80 backdrop-blur border border-gray-700 hover:border-amber-600 px-3 py-2 rounded-xl text-amber-500 hover:text-amber-400 font-bold text-sm transition-all shadow-lg"
            >
              GM
            </button>
          )}
        </div>
      )}
    </div>
  );
}
