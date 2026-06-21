// src/ui/screens/BracketScreen.js
import { navigate } from '../router.js';
import { initEmotes, destroyEmotes } from '../components/Emotes.js';
import { renderBattleModal, renderBattleModalLoading, renderBattleModalError } from '../components/BattleModal.js';
import { createBattleState, simulateBattle } from '../../engine/battle.js';
import { TYPE_COLORS } from '../../engine/types.js';
import { supabase, getCurrentUser } from '../../lib/supabase.js';
import { getTrainerAvatar } from '../../lib/avatars.js';
import { playBGM, playSFX, attachMuteToggleListener } from '../../lib/sounds.js';
import { getRankInfo } from '../../lib/rank.js';

const ROUNDS_NAMES = {
  quarters: 'Quartas de Final',
  semis: 'Semifinal',
  final: 'Final',
  done: 'Encerrado',
};

let roomId = null;
let roomCode = null;
let currentUserId = null;
let isHost = false;
let container = null;

let bracket = null;
let participants = [];
let room = null;

let bracketSubscription = null;
let simulationInProgress = false;
let simulationTimer = null;
let loading = false;
let errorMsg = '';
let animatedMatchIds = new Set();
let activeAnimations = {};

export async function render(cont, params) {
  container = cont;
  roomCode = params.code;
  roomId = params.roomId;
  isHost = params.isHost;
  loading = true;
  errorMsg = '';
  simulationInProgress = false;

  renderLayout();
  playBGM('battle');

  try {
    const user = await getCurrentUser();
    if (!user) {
      navigate('auth');
      return;
    }
    currentUserId = user.id;
    const myUsername = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Treinador';
    initEmotes(document.body, roomId, currentUserId, myUsername);

    // Busca room para settings
    const { data: rData, error: rErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    if (rErr) throw rErr;
    room = rData;

    // Busca participantes
    const { data: parts, error: partErr } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId);

    if (partErr) throw partErr;
    participants = parts || [];

    // Busca bracket
    await fetchBracket();

    // Popula as partidas já simuladas para não re-animar no load inicial
    if (bracket && bracket.matches) {
      for (const round of ['quarters', 'semis', 'final']) {
        if (bracket.matches[round]) {
          bracket.matches[round].forEach(m => {
            if (m.simulated) {
              animatedMatchIds.add(m.id);
            }
          });
        }
      }
    }

    // Configura realtime
    setupSubscription();

    // Inicia simulações se for host
    if (isHost) {
      runSimulations();
    }

  } catch (err) {
    console.error('Erro ao carregar bracket:', err);
    errorMsg = err.message || 'Erro ao carregar campeonato.';
  } finally {
    loading = false;
    updateUI();
  }
}

async function fetchBracket() {
  const { data, error } = await supabase
    .from('brackets')
    .select('*')
    .eq('room_id', roomId)
    .single();

  if (error) throw error;
  bracket = data;
}

function setupSubscription() {
  cleanup();

  bracketSubscription = supabase
    .channel('bracket-changes')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'brackets',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      bracket = { ...bracket, ...payload.new };
      updateUI();
      if (isHost) runSimulations();
    })
    .subscribe();
}

function renderLayout() {
  container.innerHTML = `
    <div class="bracket-layout">
      <header class="bracket-header">
        <button class="btn-back" id="btn-back">← Menu</button>
        <h1 class="bracket-title">🏆 Campeonato PokéChampion</h1>
        <div style="display: flex; gap: 1rem; align-items: center;">
          <div class="bracket-status" id="bracket-status">
            Carregando chaveamento...
          </div>
          <button id="btn-show-champion" style="display: none; padding: 0.4rem 1rem; background: rgba(108, 99, 255, 0.1); border: 1px solid var(--primary); color: white; border-radius: var(--radius-md); cursor: pointer; font-weight: bold; transition: all 0.2s;">👑 Ver Campeão</button>
          <button class="hs-btn-mute" id="btn-mute" title="Som"></button>
        </div>
      </header>

      <div class="bracket-body" id="bracket-body">
        <div class="loading-wrap" style="padding: 4rem 0">
          <div class="thinking-spinner"></div>
          <p>Sincronizando campeonato...</p>
        </div>
      </div>
    </div>

    <!-- Modal de batalha -->
    <div class="battle-modal" id="battle-modal" style="display:none">
      <div class="battle-modal-inner">
        <button class="modal-close" id="modal-close">✕</button>
        <div class="battle-modal-content" id="battle-modal-content"></div>
      </div>
    </div>
  `;
}

function getTierBounds(elo) {
  if (elo < 100) {
    return { min: 0, max: 100 };
  }
  if (elo >= 2100) {
    return { min: 2100, max: 2100 };
  }
  const offset = (elo - 100) % 100;
  const min = elo - offset;
  const max = min + 100;
  return { min, max };
}

function getPlayerTournamentStatus(bracket, currentUserId) {
  if (!bracket || !bracket.matches) return { completed: false };

  const hasQuarters = bracket.matches.quarters && bracket.matches.quarters.length > 0;

  if (hasQuarters) {
    // 8-player tournament
    const myQF = bracket.matches.quarters.find(m => m.team1?.user_id === currentUserId || m.team2?.user_id === currentUserId);
    if (!myQF) return { completed: false };
    if (!myQF.simulated) return { completed: false };

    const wonQF = myQF.winner?.user_id === currentUserId;
    if (!wonQF) {
      return { completed: true, pointsChange: -10, reason: 'quarters' };
    }

    // Won QF, check semis
    const mySF = bracket.matches.semis?.find(m => m.team1?.user_id === currentUserId || m.team2?.user_id === currentUserId);
    if (!mySF) return { completed: false };
    if (!mySF.simulated) return { completed: false };

    const wonSF = mySF.winner?.user_id === currentUserId;
    if (!wonSF) {
      return { completed: true, pointsChange: 5, reason: 'semis' };
    }

    // Won SF, check final
    const finalMatch = bracket.matches.final?.[0];
    if (!finalMatch) return { completed: false };
    if (!finalMatch.simulated) return { completed: false };

    const wonFinal = finalMatch.winner?.user_id === currentUserId;
    if (wonFinal) {
      return { completed: true, pointsChange: 20, reason: 'champion' };
    } else {
      return { completed: true, pointsChange: 10, reason: 'finalist' };
    }
  } else {
    // 4-player tournament
    const mySF = bracket.matches.semis?.find(m => m.team1?.user_id === currentUserId || m.team2?.user_id === currentUserId);
    if (!mySF) return { completed: false };
    if (!mySF.simulated) return { completed: false };

    const wonSF = mySF.winner?.user_id === currentUserId;
    if (!wonSF) {
      return { completed: true, pointsChange: -5, reason: 'semis_4' };
    }

    // Won SF, check final
    const finalMatch = bracket.matches.final?.[0];
    if (!finalMatch) return { completed: false };
    if (!finalMatch.simulated) return { completed: false };

    const wonFinal = finalMatch.winner?.user_id === currentUserId;
    if (wonFinal) {
      return { completed: true, pointsChange: 10, reason: 'champion' };
    } else {
      return { completed: true, pointsChange: 2, reason: 'finalist' };
    }
  }
}

function triggerEloAnimation(currentElo, nextElo, pointsChange, reason) {
  injectEloStyles();

  let overlay = document.getElementById('elo-animation-overlay');
  if (overlay) overlay.remove();

  overlay = document.createElement('div');
  overlay.id = 'elo-animation-overlay';
  overlay.className = 'battle-modal-overlay';
  overlay.style.cssText = 'display: flex; align-items: center; justify-content: center; z-index: 9999; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);';

  let reasonText = 'Torneio Finalizado';
  if (reason === 'champion') {
    reasonText = '🥇 Parabéns! Você foi o Grande Campeão! 🎉';
  } else if (reason === 'finalist') {
    reasonText = '🥈 Incrível! Você chegou à Final!';
  } else if (reason === 'semis') {
    reasonText = '🥉 Excelente! Você chegou às Semifinais!';
  } else if (reason === 'semis_4') {
    reasonText = '🚪 Eliminado nas Semifinais (1ª Rodada).';
  } else if (reason === 'quarters') {
    reasonText = '🚪 Eliminado nas Quartas de Final.';
  }

  const initialRank = getRankInfo(currentElo);
  const initialBounds = getTierBounds(currentElo);
  let initialPct = 0;
  if (currentElo >= 2100) {
    initialPct = 100;
  } else {
    initialPct = ((currentElo - initialBounds.min) / (initialBounds.max - initialBounds.min)) * 100;
  }

  const diffText = pointsChange >= 0 ? `+${pointsChange}` : `${pointsChange}`;
  const diffBg = pointsChange >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
  const diffColor = pointsChange >= 0 ? '#10b981' : '#ef4444';

  overlay.innerHTML = `
    <div class="elo-animation-card" style="background: rgba(15, 23, 42, 0.95); border: 2px solid var(--border-bright); border-radius: var(--radius-lg); padding: 3rem; text-align: center; max-width: 485px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,0.8), 0 0 25px rgba(124, 58, 237, 0.2); position: relative; overflow: hidden; backdrop-filter: blur(10px); animation: modalFadeIn 0.4s ease-out;">
      <h2 style="font-size: 1.5rem; font-weight: 900; letter-spacing: 2px; color: var(--text-1); text-transform: uppercase; margin-bottom: 1.5rem;">Resultado do ELO</h2>
      
      <div id="elo-placement-text" style="color: var(--text-2); font-size: 0.95rem; margin-bottom: 2rem; font-weight: bold; background: rgba(255,255,255,0.03); padding: 0.5rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border);">
        ${reasonText}
      </div>

      <div class="emblem-container" style="position: relative; width: 140px; height: 140px; margin: 0 auto 1.5rem auto; display: flex; align-items: center; justify-content: center;">
        <div id="emblem-glow" style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: radial-gradient(circle, ${initialRank.color}44 0%, rgba(0,0,0,0) 70%); filter: blur(8px); animation: pulseGlow 2s infinite ease-in-out;"></div>
        <div id="emblem-icon" style="font-size: 5rem; z-index: 1; transition: all 0.3s ease; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.5));">
          ${initialRank.icon}
        </div>
      </div>

      <div id="elo-rank-title" style="font-size: 1.8rem; font-weight: 900; letter-spacing: 1px; color: ${initialRank.color}; margin-bottom: 0.5rem; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
        ${initialRank.fullName}
      </div>

      <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 1.5rem;">
        <span id="elo-points-display" style="font-size: 2.2rem; font-weight: 900; color: white; font-family: monospace;">${currentElo}</span>
        <span style="font-size: 1.2rem; font-weight: bold; color: var(--text-3);">PTS</span>
        <span id="elo-diff-display" style="font-size: 1.2rem; font-weight: 900; padding: 2px 8px; border-radius: 6px; margin-left: 5px; background: ${diffBg}; color: ${diffColor};">
          ${diffText}
        </span>
      </div>

      <div style="background: rgba(255,255,255,0.08); height: 12px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.03); margin-bottom: 2.5rem; position: relative;">
        <div id="elo-progress-bar" style="width: ${initialPct}%; height: 100%; background: linear-gradient(90deg, #7c3aed 0%, #d946ef 100%); border-radius: 6px; transition: width 0.1s linear;"></div>
      </div>

      <div id="elo-alert-banner" style="position: absolute; top: 0; left: 0; width: 100%; padding: 0.8rem; background: linear-gradient(90deg, #10b981 0%, #059669 100%); color: white; font-weight: 900; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 2px; transform: translateY(-100%); transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 10; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
        SUBIU DE TIER! 🎉
      </div>

      <button id="btn-elo-ok" class="btn-play-again" style="width: 100%; padding: 0.8rem; background: var(--primary); border: none; color: white; border-radius: var(--radius-md); font-weight: bold; cursor: pointer; font-size: 1.1rem; display: none; opacity: 0; transition: opacity 0.5s ease;">
        Continuar
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('btn-elo-ok').addEventListener('click', () => {
    playSFX('click');
    overlay.remove();
  });

  let tempElo = currentElo;
  const step = nextElo > currentElo ? 1 : -1;
  let lastFullName = initialRank.fullName;

  if (pointsChange > 0) {
    playSFX('select');
  } else {
    playSFX('error');
  }

  const animInterval = setInterval(() => {
    if (tempElo === nextElo) {
      clearInterval(animInterval);
      const btnOk = document.getElementById('btn-elo-ok');
      if (btnOk) {
        btnOk.style.display = 'block';
        setTimeout(() => {
          btnOk.style.opacity = '1';
        }, 50);
      }
      return;
    }

    tempElo += step;

    const info = getRankInfo(tempElo);
    const bounds = getTierBounds(tempElo);

    let pct = 0;
    if (tempElo >= 2100) {
      pct = 100;
    } else {
      pct = ((tempElo - bounds.min) / (bounds.max - bounds.min)) * 100;
    }

    const ptsDisplay = document.getElementById('elo-points-display');
    const rTitleDisplay = document.getElementById('elo-rank-title');
    const iconDisplay = document.getElementById('emblem-icon');
    const pBarDisplay = document.getElementById('elo-progress-bar');
    const glowDisplay = document.getElementById('emblem-glow');

    if (ptsDisplay) ptsDisplay.textContent = tempElo;
    if (rTitleDisplay) {
      rTitleDisplay.textContent = info.fullName;
      rTitleDisplay.style.color = info.color;
    }
    if (iconDisplay) iconDisplay.textContent = info.icon;
    if (pBarDisplay) pBarDisplay.style.width = `${pct}%`;
    if (glowDisplay) {
      glowDisplay.style.background = `radial-gradient(circle, ${info.color}44 0%, rgba(0,0,0,0) 70%)`;
    }

    if (lastFullName && lastFullName !== info.fullName) {
      const isPromo = nextElo > currentElo;
      if (isPromo) {
        playSFX('shiny');
        if (iconDisplay) {
          iconDisplay.style.animation = 'none';
          void iconDisplay.offsetWidth;
          iconDisplay.style.animation = 'promoScale 0.8s ease-out';
        }
        const banner = document.getElementById('elo-alert-banner');
        if (banner) {
          banner.textContent = 'SUBIU DE TIER! 🎉';
          banner.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
          banner.style.transform = 'translateY(0)';
          setTimeout(() => {
            banner.style.transform = 'translateY(-100%)';
          }, 2000);
        }
      } else {
        playSFX('error');
        if (iconDisplay) {
          iconDisplay.style.animation = 'none';
          void iconDisplay.offsetWidth;
          iconDisplay.style.animation = 'demoScale 0.8s ease-out';
        }
        const banner = document.getElementById('elo-alert-banner');
        if (banner) {
          banner.textContent = 'REBAIXADO! 💔';
          banner.style.background = 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)';
          banner.style.transform = 'translateY(0)';
          setTimeout(() => {
            banner.style.transform = 'translateY(-100%)';
          }, 2000);
        }
      }
    }
    lastFullName = info.fullName;

  }, Math.max(30, Math.floor(1000 / Math.abs(pointsChange || 1))));
}

function injectEloStyles() {
  if (document.getElementById('elo-styles')) return;
  const style = document.createElement('style');
  style.id = 'elo-styles';
  style.textContent = `
    @keyframes pulseGlow {
      0%, 100% { transform: scale(1); opacity: 0.4; }
      50% { transform: scale(1.15); opacity: 0.7; }
    }
    @keyframes promoScale {
      0% { transform: scale(1); }
      50% { transform: scale(1.3) rotate(15deg); filter: brightness(1.5); }
      100% { transform: scale(1); }
    }
    @keyframes demoScale {
      0% { transform: scale(1); }
      50% { transform: scale(0.8) rotate(-15deg); filter: grayscale(100%); }
      100% { transform: scale(1); }
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

function updateUI() {
  if (!bracket) return;

  // Dispara animações para partidas novas simuladas
  if (bracket && bracket.matches) {
    for (const round of ['quarters', 'semis', 'final']) {
      if (bracket.matches[round]) {
        bracket.matches[round].forEach(m => {
          if (m.simulated && !animatedMatchIds.has(m.id) && !activeAnimations[m.id]) {
            startMatchAnimation(m);
          }
        });
      }
    }
  }

  // Processa estatísticas individuais de partidas do jogador (anti-RLS-block)
  if (bracket && bracket.matches) {
    for (const round of ['quarters', 'semis', 'final']) {
      if (bracket.matches[round]) {
        bracket.matches[round].forEach(m => {
          if (m.simulated) {
            const myTeam = m.team1?.user_id === currentUserId ? 1 : (m.team2?.user_id === currentUserId ? 2 : 0);
            if (myTeam > 0) {
              const statKey = `stat_processed_match_${m.id}`;
              if (localStorage.getItem(statKey) !== 'true') {
                localStorage.setItem(statKey, 'true');
                (async () => {
                  try {
                    const isWinner = (myTeam === 1 && m.winner?.user_id === currentUserId) || (myTeam === 2 && m.winner?.user_id === currentUserId);
                    const field = isWinner ? 'wins' : 'losses';
                    const { data: prof } = await supabase.from('profiles').select(field).eq('id', currentUserId).single();
                    if (prof) {
                      await supabase.from('profiles').update({
                        [field]: (prof[field] || 0) + 1
                      }).eq('id', currentUserId);
                    }
                  } catch (e) {
                    console.error('Erro ao atualizar estatísticas da partida:', e);
                  }
                })();
              }
            }
          }
        });
      }
    }
  }

  // Incrementa tournaments_played de forma segura para o jogador atual ao final do campeonato
  if (bracket.round === 'done') {
    const isParticipant = participants.some(p => p.user_id === currentUserId);
    if (isParticipant) {
      const playedKey = `tournament_played_room_${roomId}`;
      if (localStorage.getItem(playedKey) !== 'true') {
        localStorage.setItem(playedKey, 'true');
        (async () => {
          try {
            const { data: prof } = await supabase.from('profiles').select('tournaments_played').eq('id', currentUserId).single();
            if (prof) {
              await supabase.from('profiles').update({ 
                tournaments_played: (prof.tournaments_played || 0) + 1 
              }).eq('id', currentUserId);
            }

            // Checa e registra shinies no time do jogador atual de forma segura
            const myParticipant = participants.find(p => p.user_id === currentUserId);
            if (myParticipant && myParticipant.team) {
              const shinies = myParticipant.team.filter(poke => poke.isShiny && poke.stats);
              for (const shiny of shinies) {
                const { data: existing } = await supabase
                  .from('user_shinies')
                  .select('id')
                  .eq('user_id', currentUserId)
                  .eq('pokemon_id', shiny.id)
                  .maybeSingle();

                if (!existing) {
                  await supabase.from('user_shinies').insert({
                    user_id: currentUserId,
                    pokemon_id: shiny.id,
                    pokemon_data: shiny
                  });
                }
              }
            }
          } catch (e) {
            console.error('Erro ao incrementar torneios jogados e registrar shinies:', e);
          }
        })();
      }
    }
  }

  // Sistema de Ranking de ELO
  const isParticipant = participants.some(p => p.user_id === currentUserId);
  if (isParticipant) {
    const eloKey = `elo_processed_room_${roomId}`;
    if (localStorage.getItem(eloKey) !== 'true') {
      const isMyMatchAnimating = Object.keys(activeAnimations).some(matchId => {
        const anim = activeAnimations[matchId];
        const m = anim?.match;
        return m && (m.team1?.user_id === currentUserId || m.team2?.user_id === currentUserId);
      });

      // Apenas processa se o torneio estiver totalmente finalizado (round === 'done')
      if (bracket.round === 'done' && !isMyMatchAnimating) {
        const status = getPlayerTournamentStatus(bracket, currentUserId);
        if (status.completed) {
          localStorage.setItem(eloKey, 'true');
          (async () => {
            try {
              const pointsChange = status.pointsChange;
              const reason = status.reason;

              const { data: prof } = await supabase.from('profiles').select('elo_points').eq('id', currentUserId).single();
              if (prof) {
                const currentElo = prof.elo_points || 0;
                const nextElo = Math.max(0, currentElo + pointsChange);
                
                await supabase.from('profiles').update({ 
                  elo_points: nextElo
                }).eq('id', currentUserId);
                
                console.log(`ELO atualizado: ${currentElo} -> ${nextElo} (${pointsChange > 0 ? '+' : ''}${pointsChange} pts)`);
                
                // Dispara a animação do ELO
                triggerEloAnimation(currentElo, nextElo, pointsChange, reason);
              }
            } catch (e) {
              console.error('Erro ao atualizar ELO:', e);
            }
          })();
        }
      }
    }
  }

  const playerPart = participants.find(p => p.user_id === currentUserId);
  
  // Encontra se jogador está vivo (ou se ganhou)
  let playerAlive = false;
  if (bracket.round === 'done') {
    const winnerMatch = bracket.matches.final[0];
    playerAlive = winnerMatch?.winner?.user_id === currentUserId;
  } else {
    // Está nas quartas, semis ou final. Se perdeu em alguma etapa anterior, playerAlive = false.
    let lost = false;
    // Verifica quartas se já simulou seu jogo
    const myQF = bracket.matches.quarters?.find(m => m.team1?.user_id === currentUserId || m.team2?.user_id === currentUserId);
    if (myQF && myQF.simulated && myQF.winner?.user_id !== currentUserId) lost = true;
    
    // Verifica semis
    const mySF = bracket.matches.semis?.find(m => m.team1?.user_id === currentUserId || m.team2?.user_id === currentUserId);
    if (mySF && mySF.simulated && mySF.winner?.user_id !== currentUserId) lost = true;

    playerAlive = !lost;
  }

  // Status
  const statusEl = container.querySelector('#bracket-status');
  const btnShowChamp = container.querySelector('#btn-show-champion');
  if (statusEl) {
    if (bracket.round === 'done') {
      const winnerName = bracket.matches.final[0]?.winner?.name || 'Vencedor';
      statusEl.textContent = playerAlive ? '🥇 Você é o Grande Campeão! 🎉' : `🏆 Campeão: ${winnerName}`;
      if (btnShowChamp) btnShowChamp.style.display = 'block';
    } else {
      statusEl.textContent = `Rodada: ${ROUNDS_NAMES[bracket.round]}`;
      if (btnShowChamp) btnShowChamp.style.display = 'none';
    }
  }

  // Bracket Body
  const bodyEl = container.querySelector('#bracket-body');
  if (bodyEl) {
    bodyEl.innerHTML = renderBracketRounds();
  }

  // Champion Banner
  if (bracket.round === 'done') {
    playBGM('victory');
    const existingBanner = container.querySelector('.champion-banner');
    if (!existingBanner) {
      const bannerWrap = document.createElement('div');
      bannerWrap.innerHTML = renderChampionBanner(playerAlive);
      container.querySelector('.bracket-layout').appendChild(bannerWrap.firstElementChild);
      
      // Animação de entrada
      setTimeout(() => {
        container.querySelector('.champion-banner')?.classList.add('visible');
      }, 100);
    }
  }

  attachEvents();
}

function renderBracketRounds() {
  const { matches } = bracket;
  
  const hasQuarters = !!matches.quarters;

  return `
    <div class="bracket-rounds ${hasQuarters ? '' : 'bracket-rounds-small'}">
      ${hasQuarters ? `
        <div class="bracket-round">
          <h3 class="round-title">Quartas de Final</h3>
          <div class="matches-col">
            ${matches.quarters.map(m => renderMatch(m)).join('')}
          </div>
        </div>
        <div class="bracket-connector-col">
          <div class="connectors">
            <div class="connector-v"></div>
            <div class="connector-v"></div>
          </div>
        </div>
      ` : ''}
      
      <div class="bracket-round">
        <h3 class="round-title">Semifinal</h3>
        <div class="matches-col">
          ${matches.semis.map(m => renderMatch(m)).join('')}
        </div>
      </div>
      <div class="bracket-connector-col">
        <div class="connectors">
          <div class="connector-v single"></div>
        </div>
      </div>
      <div class="bracket-round bracket-round-final">
        <h3 class="round-title">🏆 Final</h3>
        <div class="matches-col">
          ${matches.final.map(m => renderMatch(m, true)).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderMatch(match, isFinal = false) {
  const anim = activeAnimations[match.id];
  const isAnimating = !!anim;

  // Se está animando, não mostramos os resultados estáticos ainda
  const hasResult = isAnimating ? false : match.simulated;
  const team1Win = isAnimating ? false : (match.winner?.name === match.team1?.name);
  const team2Win = isAnimating ? false : (match.winner?.name === match.team2?.name);

  const renderTeam = (team, isWinner, teamNum) => {
    if (!team) return `<div class="match-team tbd"><span>TBD</span></div>`;
    const sprite = team.pokemon[0]?.sprite || '';
    const color = TYPE_COLORS[team.pokemon[0]?.types[0]] || '#6c63ff';

    // Determina o estado dos pokemon (para quando recriar o HTML durante animação)
    const getPokeClasses = (p, idx) => {
      if (isAnimating && anim && !anim.loading) {
        const animTeam = teamNum === 1 ? anim.t1 : anim.t2;
        const animPoke = animTeam[idx];
        if (animPoke) {
          if (animPoke.fainted) return 'fainted';
          if (animPoke.active) return 'active';
        }
      }
      return '';
    };

    return `
      <div class="match-team ${isWinner ? 'winner' : hasResult ? 'loser' : ''} ${team.isPlayer ? 'player' : ''}" data-team="${teamNum}" style="--team-color: ${color}">
        ${sprite ? `<img class="match-sprite" src="${sprite}" alt="${team.name}" onerror="this.style.display='none'">` : ''}
        <div class="match-team-info">
          <span class="match-team-name" style="display: flex; align-items: center; gap: 6px;">
            <span style="display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; overflow: hidden; background: var(--bg-3); border: 1px solid ${team.isPlayer ? 'var(--gold)' : 'var(--border)'}; flex-shrink: 0;">
              <img src="${getTrainerAvatar(team)}" alt="${team.name}" style="width: 100%; height: 100%; object-fit: cover;">
            </span>
            <span>${team.name}</span>
          </span>
          <div class="match-team-types">
            ${team.pokemon.slice(0, 6).map((p, idx) => {
              const extraClass = getPokeClasses(p, idx);
              const itemTitle = p.item ? ` (${p.item.icon} ${p.item.displayName})` : '';
              return `<img class="match-mini-sprite ${extraClass}" src="${p.sprite}" alt="${p.displayName}" title="${p.displayName}${itemTitle}" data-poke-name="${p.displayName}" data-poke-idx="${idx}" onerror="this.style.display='none'">`;
            }).join('')}
          </div>
        </div>
        ${isWinner ? '<span class="winner-crown">👑</span>' : ''}
      </div>
    `;
  };

  return `
    <div class="match-card ${isAnimating ? 'animating' : hasResult ? 'has-result' : 'pending'} ${isFinal ? 'final-match' : ''}" data-matchid="${match.id}">
      ${renderTeam(match.team1, team1Win, 1)}
      <div class="match-vs">VS</div>
      ${renderTeam(match.team2, team2Win, 2)}
      ${isAnimating ? `
        <div class="match-animating-hint">
          <span class="thinking-spinner" style="width: 12px; height: 12px; border-width: 2px; margin-right: 6px;"></span>
          ${anim.loading ? 'Conectando...' : 'Simulando...'}
        </div>
      ` : hasResult ? `
        <div class="match-click-hint">👁 Ver batalha</div>
      ` : `
        <div class="match-pending-hint">⏳ Aguardando</div>
      `}
    </div>
  `;
}

function calculateTournamentMvp(bracket, champId) {
  if (!bracket || !bracket.matches) return null;
  const accum = {};

  for (const round of ['quarters', 'semis', 'final']) {
    const matches = bracket.matches[round];
    if (!matches) continue;

    for (const m of matches) {
      if (!m.simulated) continue;

      const isTeam1 = m.team1?.id === champId;
      const isTeam2 = m.team2?.id === champId;

      if (isTeam1 || isTeam2) {
        const team = isTeam1 ? m.team1 : m.team2;
        if (team && team.pokemon) {
          team.pokemon.forEach(p => {
            if (!accum[p.id]) {
              accum[p.id] = {
                id: p.id,
                displayName: p.displayName,
                sprite: p.sprite,
                types: p.types,
                kos: 0,
                damageDealt: 0
              };
            }
            accum[p.id].kos += (p.kos || 0);
            accum[p.id].damageDealt += (p.damageDealt || 0);
          });
        }
      }
    }
  }

  const pokes = Object.values(accum);
  if (pokes.length === 0) return null;

  return pokes.reduce((best, p) => {
    const score = (p.kos * 100) + p.damageDealt;
    const bestScore = (best.kos * 100) + best.damageDealt;
    return score > bestScore ? p : best;
  }, pokes[0]);
}

function renderChampionBanner(isPlayer) {
  const finalMatch = bracket.matches.final[0];
  const champ = finalMatch?.winner;
  const mvp = calculateTournamentMvp(bracket, champ?.id);
  const avatarUrl = getTrainerAvatar(champ);

  return `
    <div class="champion-banner ${isPlayer ? 'player-wins' : ''}">
      <div class="champion-content">
        <div class="champion-fireworks">🎆</div>
        <h2 class="champion-title">${isPlayer ? '🎉 VOCÊ É O CAMPEÃO!' : '🏆 CAMPEÃO!'}</h2>
        <div class="champion-name" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; overflow: hidden; background: var(--bg-3); border: 1px solid var(--gold); flex-shrink: 0;">
            <img src="${avatarUrl}" alt="${champ?.name || ''}" style="width: 100%; height: 100%; object-fit: cover;">
          </span>
          <span>${isPlayer ? 'Você' : (champ?.name || '')}</span>
        </div>
        ${isPlayer ? `
          <div style="margin-top: 1rem; color: var(--gold); font-weight: 900; font-size: 1.1rem; text-shadow: 0 0 10px rgba(251, 191, 36, 0.4); display: flex; align-items: center; justify-content: center; gap: 6px; animation: pulse 1.5s infinite;">
            <span>📦</span> VOCÊ GANHOU 1 BOOSTER PACK!
          </div>
          <div style="margin-top: 1rem; display: flex; justify-content: center;" id="claim-rewards-container">
            <button id="btn-claim-rewards" style="padding: 0.8rem 2rem; background: linear-gradient(135deg, var(--gold), #f59e0b); border: none; color: black; border-radius: var(--radius-md); cursor: pointer; font-weight: 900; box-shadow: 0 0 15px rgba(245, 158, 11, 0.6); font-size: 1rem; text-transform: uppercase; transition: all 0.2s; display: flex; align-items: center; gap: 8px;">
              <span>Resgatar Recompensas 🎁</span>
            </button>
          </div>
        ` : ''}
        
        ${mvp?.sprite ? `
          <div class="champion-sprite-wrap">
            <img class="champion-sprite" src="${mvp.sprite}" alt="MVP" style="width: 180px; height: 180px; object-fit: contain; filter: drop-shadow(0 12px 30px rgba(255, 215, 0, 0.6));">
            <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #f59e0b, #d97706); color: black; border: 1.5px solid gold; padding: 3px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; box-shadow: 0 4px 10px rgba(0,0,0,0.5); white-space: nowrap;">
              ⭐ MVP ⭐
            </div>
          </div>
        ` : `
          <div class="champion-avatar-large-wrap">
            <img src="${avatarUrl}" alt="${champ?.name || ''}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
        `}
        
        ${mvp ? `
          <div class="champion-mvp" style="margin-top: 1.5rem; margin-bottom: 1.5rem; padding: 1rem; background: rgba(255, 215, 0, 0.1); border-radius: var(--radius-md); border: 1px solid gold; display: flex; flex-direction: column; align-items: center;">
            <h4 style="color: gold; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 1px; font-size: 0.9rem;">⭐ MVP do Campeonato ⭐</h4>
            <div style="display: flex; align-items: center; gap: 0.8rem;">
              <img src="${mvp.sprite}" style="width: 50px; height: 50px; filter: drop-shadow(0 0 5px rgba(255,215,0,0.5));">
              <div style="text-align: left;">
                <div style="font-weight: bold; font-size: 1.1rem;">${mvp.displayName}</div>
                <div style="font-size: 0.8rem; opacity: 0.8;">KOs Totais: ${mvp.kos || 0} | Dano Total: ${mvp.damageDealt || 0}</div>
              </div>
            </div>
          </div>
        ` : ''}

        <div class="champion-team">
          ${champ?.pokemon?.map(p => `
            <div class="champion-pokemon">
              <img src="${p.sprite}" alt="${p.displayName}" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png'">
              <span>${p.displayName}</span>
            </div>
          `).join('') || ''}
        </div>
        <div class="champion-buttons" style="display: flex; gap: 1rem; justify-content: center; margin-top: 2rem;">
          <button class="btn-view-bracket" id="btn-view-bracket" style="padding: 0.8rem 1.5rem; background: var(--bg-3); border: 1px solid var(--border-bright); color: white; border-radius: var(--radius-md); cursor: pointer; font-weight: bold; transition: all 0.2s;">👀 Ver Chaveamento</button>
          <button class="btn-play-again" id="btn-play-again" style="padding: 0.8rem 1.5rem; background: var(--primary); border: none; color: white; border-radius: var(--radius-md); cursor: pointer; font-weight: bold; transition: all 0.2s;">🔄 Voltar ao Menu</button>
        </div>
      </div>
    </div>
  `;
}

function attachEvents() {
  // Sincroniza o botão de mute
  const btnMute = container.querySelector('#btn-mute');
  if (btnMute && !btnMute.hasAttribute('data-audio-attached')) {
    btnMute.setAttribute('data-audio-attached', 'true');
    attachMuteToggleListener('btn-mute');
  }

  // Back
  const btnBack = container.querySelector('#btn-back');
  if (btnBack && !btnBack.hasAttribute('data-attached')) {
    btnBack.setAttribute('data-attached', 'true');
    btnBack.addEventListener('click', () => {
      playSFX('click');
      handleGoHome();
    });
  }

  // Play again
  const btnPlayAgain = container.querySelector('#btn-play-again');
  if (btnPlayAgain && !btnPlayAgain.hasAttribute('data-attached')) {
    btnPlayAgain.setAttribute('data-attached', 'true');
    btnPlayAgain.addEventListener('click', () => {
      playSFX('click');
      handleGoHome();
    });
  }

  // View Battle (simulação visual animada + resumos 1v1 + log completo)
  container.querySelectorAll('.match-card.has-result').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', async (e) => {
      playSFX('click');
      const matchId = e.currentTarget.dataset.matchid;
      // find match in bracket
      let foundMatch = null;
      for (const round of ['quarters', 'semis', 'final']) {
        if (!bracket.matches[round]) continue;
        const m = bracket.matches[round].find(x => x.id === matchId);
        if (m) foundMatch = m;
      }
      if (foundMatch) {
        // 1. Mostrar estado de carregamento
        renderBattleModalLoading(foundMatch);

        try {
          // 2. Buscar logs no banco
          const { data, error } = await supabase
            .from('battle_logs')
            .select('log, matchups, total_turns')
            .eq('bracket_id', bracket.id)
            .eq('participant1_id', foundMatch.team1.id)
            .eq('participant2_id', foundMatch.team2.id)
            .single();

          if (error) throw error;

          // 3. Montar objeto com dados carregados e renderizar simulação visual
          const matchWithLogs = {
            ...foundMatch,
            log: data.log,
            matchups: data.matchups,
            totalTurns: data.total_turns
          };
          renderBattleModal(matchWithLogs);
        } catch (err) {
          console.error('Erro ao carregar detalhes da batalha:', err);
          // 4. Mostrar erro no modal caso a consulta falhe
          renderBattleModalError(foundMatch);
        }
      }
    });
  });

  // View Bracket (hide banner)
  container.querySelector('#btn-view-bracket')?.addEventListener('click', () => {
    playSFX('click');
    const banner = container.querySelector('.champion-banner');
    if (banner) banner.style.display = 'none';
  });

  // Show Champion (show banner)
  container.querySelector('#btn-show-champion')?.addEventListener('click', () => {
    playSFX('click');
    const banner = container.querySelector('.champion-banner');
    if (banner) banner.style.display = 'flex';
  });

  // Close modal
  container.querySelector('#modal-close')?.addEventListener('click', () => {
    playSFX('click');
    document.getElementById('battle-modal').style.display = 'none';
  });

  // Claim Rewards Button
  const btnClaim = container.querySelector('#btn-claim-rewards');
  if (btnClaim) {
    const alreadyClaimed = localStorage.getItem(`claimed_rewards_room_${roomId}`);
    if (alreadyClaimed === 'true') {
      btnClaim.disabled = true;
      btnClaim.style.background = 'var(--bg-3)';
      btnClaim.style.color = 'var(--text-3)';
      btnClaim.style.boxShadow = 'none';
      btnClaim.style.cursor = 'not-allowed';
      btnClaim.textContent = 'Recompensas Reivindicadas ✓';
    }

    btnClaim.addEventListener('click', async () => {
      btnClaim.disabled = true;
      btnClaim.textContent = 'Processando...';
      
      try {
        const finalMatch = bracket.matches.final[0];
        const winnerMatch = finalMatch?.winner;
        
        if (winnerMatch && winnerMatch.user_id === currentUserId) {
          // 1. Hall of Fame
          await supabase.from('hall_of_fame').insert({
            user_id: currentUserId,
            room_name: room?.code || 'Torneio',
            team_json: winnerMatch.pokemon
          });

          // 2. Incrementar championships e boosters_count
          const { data: prof, error: getErr } = await supabase
            .from('profiles')
            .select('championships, boosters_count')
            .eq('id', currentUserId)
            .single();

          if (getErr) throw getErr;

          const { error: updErr } = await supabase
            .from('profiles')
            .update({ 
              championships: (prof.championships || 0) + 1,
              boosters_count: (prof.boosters_count || 0) + 1
            })
            .eq('id', currentUserId);

          if (updErr) throw updErr;

          // 3. Registrar Shinies do Time
          const myParticipant = participants.find(p => p.user_id === currentUserId);
          if (myParticipant) {
            const shinies = myParticipant.team.filter(poke => poke.isShiny && poke.stats);
            for (const shiny of shinies) {
              const { data: existing } = await supabase
                .from('user_shinies')
                .select('id')
                .eq('user_id', currentUserId)
                .eq('pokemon_id', shiny.id)
                .maybeSingle();

              if (!existing) {
                await supabase.from('user_shinies').insert({
                  user_id: currentUserId,
                  pokemon_id: shiny.id,
                  pokemon_data: shiny
                });
              }
            }
          }

          // Salva no localStorage para não poder resgatar novamente
          localStorage.setItem(`claimed_rewards_room_${roomId}`, 'true');

          btnClaim.style.background = 'var(--success)';
          btnClaim.style.color = 'white';
          btnClaim.style.boxShadow = 'none';
          btnClaim.style.cursor = 'not-allowed';
          btnClaim.textContent = 'Recompensas Recebidas! 📦✓';
          
          playSFX('boosterOpen');
          alert('Recompensas coletadas! 1 Booster Pack foi adicionado ao seu perfil.');
        }
      } catch (err) {
        console.error('Erro ao reivindicar recompensas:', err);
        btnClaim.disabled = false;
        btnClaim.textContent = 'Tentar Novamente 🎁';
        alert('Erro ao coletar recompensas: ' + err.message);
      }
    });
  }
}

async function processEloPointsSilently() {
  const isParticipant = participants.some(p => p.user_id === currentUserId);
  if (!isParticipant) return;

  const eloKey = `elo_processed_room_${roomId}`;
  if (localStorage.getItem(eloKey) === 'true') return;

  const status = getPlayerTournamentStatus(bracket, currentUserId);
  if (status.completed) {
    localStorage.setItem(eloKey, 'true');
    try {
      const pointsChange = status.pointsChange;
      const { data: prof } = await supabase.from('profiles').select('elo_points').eq('id', currentUserId).single();
      if (prof) {
        const currentElo = prof.elo_points || 0;
        const nextElo = Math.max(0, currentElo + pointsChange);
        await supabase.from('profiles').update({ elo_points: nextElo }).eq('id', currentUserId);
        console.log(`[Silent] ELO atualizado: ${currentElo} -> ${nextElo} (${pointsChange > 0 ? '+' : ''}${pointsChange} pts)`);
      }

      // Salva os shinies do time do jogador antes de sair
      const myParticipant = participants.find(p => p.user_id === currentUserId);
      if (myParticipant && myParticipant.team) {
        const shinies = myParticipant.team.filter(poke => poke.isShiny && poke.stats);
        for (const shiny of shinies) {
          const { data: existing } = await supabase
            .from('user_shinies')
            .select('id')
            .eq('user_id', currentUserId)
            .eq('pokemon_id', shiny.id)
            .maybeSingle();

          if (!existing) {
            await supabase.from('user_shinies').insert({
              user_id: currentUserId,
              pokemon_id: shiny.id,
              pokemon_data: shiny
            });
            console.log(`[Silent] Shiny salvo na coleção: ${shiny.displayName}`);
          }
        }
      }
    } catch (e) {
      console.error('Erro ao atualizar ELO/shinies de forma silenciosa:', e);
    }
  }
}

function handleGoHome() {
  processEloPointsSilently().catch(e => console.error('Erro silencioso de ELO:', e));
  
  try {
    const myPart = participants.find(p => p.user_id === currentUserId);
    if (myPart) {
      supabase.from('room_participants').delete().eq('id', myPart.id)
        .catch(e => console.error('Erro ao deletar participante:', e));
    }
  } catch (e) {
    console.error(e);
  }
  cleanup();
  navigate('home');
}

// LÓGICA DO HOST PARA SIMULAÇÃO DO TORNEIO
function runSimulations() {
  if (bracket.round === 'done') return;
  if (simulationInProgress) return;

  // Se houver qualquer animação de batalha rodando visualmente no cliente do host,
  // aguarda ela terminar antes de simular a próxima ou avançar o round.
  if (Object.keys(activeAnimations).length > 0) {
    clearTimeout(simulationTimer);
    simulationTimer = setTimeout(runSimulations, 300);
    return;
  }

  const roundName = bracket.round;
  const matches = bracket.matches[roundName];
  
  // Encontra primeira partida não simulada no round
  const pendingMatch = matches.find(m => !m.simulated && m.team1 && m.team2);

  if (pendingMatch) {
    simulationInProgress = true;
    clearTimeout(simulationTimer);
    simulationTimer = setTimeout(() => simulateMatchAndSave(pendingMatch, roundName), 1200);
  } else {
    // Todas as partidas do round atual foram simuladas. Avança o round!
    const roundComplete = matches.every(m => m.simulated || (!m.team1 || !m.team2));
    if (roundComplete) {
      simulationInProgress = true;
      clearTimeout(simulationTimer);
      simulationTimer = setTimeout(() => advanceRoundAndSave(roundName), 1200);
    }
  }
}

async function simulateMatchAndSave(match, roundName) {
  try {
    const seed = Date.now() + Math.floor(Math.random() * 10000);
    // Simula a batalha com o motor
    const t1 = match.team1.pokemon.map(p => ({ ...p, item: p.item || match.team1.item }));
    const t2 = match.team2.pokemon.map(p => ({ ...p, item: p.item || match.team2.item }));
    const state = createBattleState(t1, t2, seed, room?.settings || {});
    const result = simulateBattle(state);

    const winner = result.winner === 1 ? match.team1 : match.team2;
    const loser = result.winner === 1 ? match.team2 : match.team1;
    const finalWinnerTeam = result.winner === 1 ? result.team1 : result.team2;

    // Calcula MVP: pokemon vivo ou morto com maior pontuação (KOs * 100 + dano)
    let mvp = null;
    if (finalWinnerTeam && finalWinnerTeam.length > 0) {
      mvp = finalWinnerTeam.reduce((best, p) => {
        const score = ((p.kos || 0) * 100) + (p.damageDealt || 0);
        const bestScore = ((best.kos || 0) * 100) + (best.damageDealt || 0);
        return score > bestScore ? p : best;
      }, finalWinnerTeam[0]);
    }

    // Salva os Pokémons simulados com suas estatísticas de KOs e dano
    match.team1.pokemon = result.team1;
    match.team2.pokemon = result.team2;

    match.winner = winner;
    match.loser = loser;
    match.simulated = true;
    match.totalTurns = result.totalTurns;
    match.mvp = mvp;

    // 1. Grava log de batalha
    const { error: logErr } = await supabase
      .from('battle_logs')
      .insert({
        room_id: roomId,
        bracket_id: bracket.id,
        participant1_id: match.team1.id,
        participant2_id: match.team2.id,
        winner_id: winner.id,
        log: result.log,
        matchups: result.matchups,
        total_turns: result.totalTurns,
        battle_seed: seed
      });

    if (logErr) throw logErr;

    // 2. Atualiza estatísticas persistentes
    const isChampionship = roundName === 'final';
    const tournMvp = isChampionship ? calculateTournamentMvp(bracket, winner.id) : null;
    await updateUserStats(winner, loser, isChampionship, tournMvp || mvp);

    // 3. Atualiza o bracket no banco
    const { error: brkErr } = await supabase
      .from('brackets')
      .update({
        matches: bracket.matches,
        updated_at: new Date().toISOString()
      })
      .eq('id', bracket.id);

    if (brkErr) throw brkErr;

  } catch (err) {
    console.error('Erro ao simular confronto:', err);
  } finally {
    simulationInProgress = false;
  }
}

async function advanceRoundAndSave(roundName) {
  try {
    let nextRound = roundName;
    let winnerId = null;

    if (roundName === 'quarters') {
      bracket.matches.semis[0].team1 = bracket.matches.quarters[0].winner;
      bracket.matches.semis[0].team2 = bracket.matches.quarters[1].winner;
      bracket.matches.semis[1].team1 = bracket.matches.quarters[2].winner;
      bracket.matches.semis[1].team2 = bracket.matches.quarters[3].winner;
      nextRound = 'semis';
    } else if (roundName === 'semis') {
      bracket.matches.final[0].team1 = bracket.matches.semis[0].winner;
      bracket.matches.final[0].team2 = bracket.matches.semis[1].winner;
      nextRound = 'final';
    } else if (roundName === 'final') {
      nextRound = 'done';
      winnerId = bracket.matches.final[0].winner.id;
    }

    const { error } = await supabase
      .from('brackets')
      .update({
        matches: bracket.matches,
        round: nextRound,
        winner_id: winnerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', bracket.id);

    if (error) throw error;

    // Se o campeonato acabou, muda status da sala
    if (nextRound === 'done') {
      await supabase
        .from('rooms')
        .update({ status: 'finished', finished_at: new Date().toISOString() })
        .eq('id', roomId);
    }

  } catch (err) {
    console.error('Erro ao avançar rodada:', err);
  } finally {
    simulationInProgress = false;
  }
}

async function updateUserStats(winner, loser, isChampionship = false, mvp = null) {
  try {
    const winnerUserId = winner?.user_id;
    const loserUserId = loser?.user_id;

    // Só o próprio cliente altera o seu profile (evita erro de RLS)
    if (winnerUserId && winnerUserId === currentUserId) {
      const { data: p } = await supabase.from('profiles').select('wins, championships, shinies, hall_of_fame').eq('id', winnerUserId).single();
      if (p) {
        let newShinies = p.shinies || [];
        if (winner.pokemon) {
          const teamShinies = winner.pokemon.filter(poke => poke.isShiny);
          teamShinies.forEach(ts => {
            if (!newShinies.find(s => s.id === ts.id)) {
              newShinies.push(ts);
            }
          });
        }

        let newHoF = p.hall_of_fame || [];
        if (isChampionship && winner.pokemon) {
          newHoF.push({
            date: new Date().toISOString(),
            team: winner.pokemon,
            mvp: mvp
          });
        }

        await supabase.from('profiles')
          .update({
            wins: p.wins + 1,
            championships: isChampionship ? p.championships + 1 : p.championships,
            shinies: newShinies,
            hall_of_fame: newHoF
          })
          .eq('id', winnerUserId);
      }
    }
    if (loserUserId && loserUserId === currentUserId) {
      const { data: p } = await supabase.from('profiles').select('losses').eq('id', loserUserId).single();
      if (p) {
        await supabase.from('profiles')
          .update({ losses: p.losses + 1 })
          .eq('id', loserUserId);
      }
    }
  } catch (err) {
    console.warn('Erro ao atualizar estatísticas do usuário:', err);
  }
}

function cleanup() {
  clearTimeout(simulationTimer);
  
  // Limpa todos os timers de animação ativos
  for (const matchId in activeAnimations) {
    if (activeAnimations[matchId].interval) {
      clearInterval(activeAnimations[matchId].interval);
    }
  }
  activeAnimations = {};
  animatedMatchIds.clear();

  if (bracketSubscription) {
    bracketSubscription.unsubscribe();
    bracketSubscription = null;
  }
}

export function destroy() {
  cleanup();
}

async function startMatchAnimation(match) {
  // Marca temporariamente como loading para evitar requisições redundantes
  activeAnimations[match.id] = { loading: true };
  
  try {
    const { data, error } = await supabase
      .from('battle_logs')
      .select('log')
      .eq('bracket_id', bracket.id)
      .eq('participant1_id', match.team1.id)
      .eq('participant2_id', match.team2.id)
      .single();
      
    if (error) throw error;
    if (!data || !data.log) throw new Error('Nenhum log encontrado');
    
    const logs = data.log;
    
    // Inicializa o estado dos times para a animação
    const t1 = match.team1.pokemon.map((p, i) => ({ ...p, fainted: false, active: i === 0 }));
    const t2 = match.team2.pokemon.map((p, i) => ({ ...p, fainted: false, active: i === 0 }));
    
    activeAnimations[match.id] = {
      loading: false,
      logs: logs,
      logIndex: 0,
      t1: t1,
      t2: t2,
      match: match
    };
    
    // Atualiza a interface daquela partida específica
    updateMatchCardDOM(match.id);
    
    // Configura o intervalo para avançar a animação (acelerada 3x)
    activeAnimations[match.id].interval = setInterval(() => {
      advanceMatchAnimation(match.id);
    }, 50);
    
  } catch (err) {
    console.error('Erro ao buscar logs para animação no bracket:', err);
    // Se der erro, considera animado e renderiza estático
    delete activeAnimations[match.id];
    animatedMatchIds.add(match.id);
    updateUI();
  }
}

function advanceMatchAnimation(matchId) {
  const anim = activeAnimations[matchId];
  if (!anim) return;
  
  if (anim.logIndex >= anim.logs.length) {
    // Terminou a simulação da partida!
    clearInterval(anim.interval);
    delete activeAnimations[matchId];
    animatedMatchIds.add(matchId);
    
    // Redesenha toda a UI no estado final
    updateUI();
    return;
  }
  
  const event = anim.logs[anim.logIndex];
  
  if (event.type === 'faint') {
    const pokeName = extractBoldName(event.message);
    if (pokeName) {
      let p = anim.t1.find(x => x.displayName === pokeName && !x.fainted);
      if (p) {
        p.fainted = true;
        p.active = false;
      } else {
        p = anim.t2.find(x => x.displayName === pokeName && !x.fainted);
        if (p) {
          p.fainted = true;
          p.active = false;
        }
      }
    }
  } else if (event.type === 'switch') {
    const pokeName = extractBoldName(event.message);
    if (pokeName && event.message.includes('entra em campo')) {
      let isT1 = false;
      let p = anim.t1.find(x => x.displayName === pokeName && !x.fainted);
      if (p) {
        isT1 = true;
      } else {
        p = anim.t2.find(x => x.displayName === pokeName && !x.fainted);
      }
      
      if (p) {
        if (isT1) {
          anim.t1.forEach(x => x.active = false);
        } else {
          anim.t2.forEach(x => x.active = false);
        }
        p.active = true;
      }
    }
  }
  
  anim.logIndex++;
  updateMatchCardDOM(matchId);
}

function updateMatchCardDOM(matchId) {
  const anim = activeAnimations[matchId];
  if (!anim || anim.loading) return;
  
  const cardEl = container.querySelector(`.match-card[data-matchid="${matchId}"]`);
  if (!cardEl) return;
  
  cardEl.classList.remove('pending', 'has-result');
  cardEl.classList.add('animating');
  
  const hintEl = cardEl.querySelector('.match-pending-hint') || cardEl.querySelector('.match-click-hint') || cardEl.querySelector('.match-animating-hint');
  if (hintEl) {
    hintEl.className = 'match-animating-hint';
    hintEl.innerHTML = '<span class="thinking-spinner" style="width: 12px; height: 12px; border-width: 2px; margin-right: 6px;"></span>Simulando...';
  }
  
  const t1El = cardEl.querySelector('.match-team[data-team="1"]');
  if (t1El) {
    t1El.classList.remove('winner', 'loser');
    const crown = t1El.querySelector('.winner-crown');
    if (crown) crown.style.display = 'none';
    
    anim.t1.forEach((p, idx) => {
      const spriteEl = t1El.querySelector(`.match-mini-sprite[data-poke-idx="${idx}"]`);
      if (spriteEl) {
        if (p.fainted) {
          spriteEl.classList.add('fainted');
          spriteEl.classList.remove('active');
        } else if (p.active) {
          spriteEl.classList.add('active');
          spriteEl.classList.remove('fainted');
        } else {
          spriteEl.classList.remove('active', 'fainted');
        }
      }
    });
  }
  
  const t2El = cardEl.querySelector('.match-team[data-team="2"]');
  if (t2El) {
    t2El.classList.remove('winner', 'loser');
    const crown = t2El.querySelector('.winner-crown');
    if (crown) crown.style.display = 'none';
    
    anim.t2.forEach((p, idx) => {
      const spriteEl = t2El.querySelector(`.match-mini-sprite[data-poke-idx="${idx}"]`);
      if (spriteEl) {
        if (p.fainted) {
          spriteEl.classList.add('fainted');
          spriteEl.classList.remove('active');
        } else if (p.active) {
          spriteEl.classList.add('active');
          spriteEl.classList.remove('fainted');
        } else {
          spriteEl.classList.remove('active', 'fainted');
        }
      }
    });
  }
}

function extractBoldName(msg) {
  const match = msg.match(/<b>(.*?)<\/b>/);
  return match ? match[1] : null;
}
