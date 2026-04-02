/**
 * fetch-players.js
 * ----------------
 * Downloads the current MLB player roster + season stats from the
 * public MLB Stats API and writes players.json to this directory.
 *
 * Run manually:          node fetch-players.js
 * Run for a prior year:  node fetch-players.js 2024
 *
 * Schedule this script (e.g. weekly via Task Scheduler, cron, or a
 * GitHub Actions workflow) to keep players.json fresh for all users.
 *
 * Requires Node.js 18+ (built-in fetch).  For older Node use:
 *   npm install node-fetch  and add:  import fetch from 'node-fetch';
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(__dirname, 'players.json');
const BASE = 'https://statsapi.mlb.com/api/v1';

function normalizePos(abbr) {
  if (['LF', 'CF', 'RF'].includes(abbr)) return 'OF';
  if (abbr === 'TWP') return 'DH';
  return abbr || 'UTIL';
}

async function fetchMLBPlayers(season) {
  console.log(`Fetching season ${season} data from MLB Stats API…`);

  const [pr, hr, ptr] = await Promise.all([
    fetch(`${BASE}/sports/1/players?season=${season}`),
    fetch(`${BASE}/stats?stats=season&group=hitting&season=${season}&playerPool=ALL&gameType=R&limit=3000`),
    fetch(`${BASE}/stats?stats=season&group=pitching&season=${season}&playerPool=ALL&gameType=R&limit=3000`),
  ]);

  const [pd, hd, ptd] = await Promise.all([
    pr.ok ? pr.json() : Promise.resolve(null),
    hr.ok ? hr.json() : Promise.resolve(null),
    ptr.ok ? ptr.json() : Promise.resolve(null),
  ]);

  if (!pd) throw new Error('Player roster endpoint returned an error.');

  const posMap = {}, teamMap = {};
  (pd.people || []).forEach(p => {
    posMap[p.id] = normalizePos(p.primaryPosition?.abbreviation);
    teamMap[p.id] = p.currentTeam?.abbreviation || '';
  });

  const pitcherRole = {};
  (ptd?.stats?.[0]?.splits || []).forEach(s => {
    const pid = s.player?.id; if (!pid) return;
    const gs = +(s.stat?.gamesStarted || 0), gp = +(s.stat?.gamesPitched || s.stat?.gamesPlayed || 0);
    pitcherRole[pid] = (gs >= 5 && gp > 0 && gs / gp >= 0.5) ? 'SP' : 'RP';
  });

  const result = [], seen = new Set();

  (hd?.stats?.[0]?.splits || []).forEach(s => {
    const pid = s.player?.id; if (!pid || seen.has(pid)) return;
    const pos = posMap[pid] || 'UTIL';
    if (['SP', 'RP', 'P'].includes(pos)) return;
    const st = s.stat || {};
    seen.add(pid);
    result.push({
      name: s.player.fullName, pos, team: s.team?.abbreviation || teamMap[pid] || '',
      hr: st.homeRuns != null ? +st.homeRuns : null,
      avg: st.avg != null ? parseFloat(st.avg) : null,
      rbi: st.rbi != null ? +st.rbi : null,
      sb: st.stolenBases != null ? +st.stolenBases : null,
    });
  });

  (ptd?.stats?.[0]?.splits || []).forEach(s => {
    const pid = s.player?.id; if (!pid || seen.has(pid)) return;
    const pos = pitcherRole[pid] || (posMap[pid] === 'SP' ? 'SP' : 'RP');
    const st = s.stat || {};
    seen.add(pid);
    result.push({
      name: s.player.fullName, pos, team: s.team?.abbreviation || teamMap[pid] || '',
      era: st.era != null ? parseFloat(st.era) : null,
      k: st.strikeOuts != null ? +st.strikeOuts : null,
      w: st.wins != null ? +st.wins : null,
      sv: st.saves != null ? +st.saves : null,
      ip: st.inningsPitched || null,
    });
  });

  // Rostered players without stats (prospects, injured, etc.)
  (pd.people || []).forEach(p => {
    if (seen.has(p.id)) return;
    const pos = posMap[p.id]; if (!pos || pos === 'UTIL' || !teamMap[p.id]) return;
    const isPitcher = ['SP', 'RP', 'P'].includes(pos);
    const entry = { name: p.fullName, pos: pos === 'P' ? 'RP' : pos, team: teamMap[p.id] };
    if (isPitcher) { entry.era = null; entry.k = null; entry.w = null; entry.sv = null; }
    else { entry.hr = null; entry.avg = null; entry.rbi = null; entry.sb = null; }
    result.push(entry); seen.add(p.id);
  });

  return result;
}

async function main() {
  const year = parseInt(process.argv[2]) || new Date().getFullYear();

  let players = await fetchMLBPlayers(year);

  // Fall back to previous year if current season hasn't started yet
  if (players.length < 100) {
    console.log(`Only ${players.length} players found for ${year}, trying ${year - 1}…`);
    players = await fetchMLBPlayers(year - 1);
  }

  if (players.length === 0) {
    console.error('No players returned. players.json was NOT updated.');
    process.exit(1);
  }

  const output = {
    season: year,
    generatedAt: new Date().toISOString(),
    count: players.length,
    players,
  };

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), 'utf8');
  console.log(`✓ Wrote ${players.length} players to players.json (${year} season)`);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
