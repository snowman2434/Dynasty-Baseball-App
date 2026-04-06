const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const MLB_BASE = 'https://statsapi.mlb.com/api/v1';

app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'DraftDay MLB proxy running' });
});

// ── GET /players
// Returns all active MLB players for a given season
// Query params: season (default: current year)
app.get('/players', async (req, res) => {
  const season = req.query.season || new Date().getFullYear();
  try {
    const { data } = await axios.get(`${MLB_BASE}/sports/1/players`, {
      params: { season, gameType: 'R' },
    });
    const players = (data.people || []).map(p => ({
      id: p.id,
      name: p.fullName,
      firstName: p.firstName,
      lastName: p.lastName,
      pos: p.primaryPosition?.abbreviation || 'N/A',
      team: p.currentTeam?.name || 'Free Agent',
      teamAbbr: p.currentTeam?.abbreviation || 'FA',
      jerseyNumber: p.primaryNumber || '',
      batSide: p.batSide?.code || '',
      pitchHand: p.pitchHand?.code || '',
    }));
    res.json({ season, count: players.length, players });
  } catch (err) {
    console.error('Error fetching players:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /players/:id/stats
// Returns hitting or pitching season stats for one player
// Query params: season, group (hitting | pitching, default: hitting)
app.get('/players/:id/stats', async (req, res) => {
  const { id } = req.params;
  const season = req.query.season || new Date().getFullYear();
  const group = req.query.group || 'hitting';
  try {
    const { data } = await axios.get(`${MLB_BASE}/people/${id}/stats`, {
      params: { stats: 'season', season, group },
    });
    const splits = data.stats?.[0]?.splits || [];
    const stats = splits[0]?.stat || {};
    res.json({ id: Number(id), season, group, stats });
  } catch (err) {
    console.error('Error fetching player stats:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /players/:id
// Returns bio info for one player
app.get('/players/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data } = await axios.get(`${MLB_BASE}/people/${id}`);
    const p = data.people?.[0];
    if (!p) return res.status(404).json({ error: 'Player not found' });
    res.json({
      id: p.id,
      name: p.fullName,
      pos: p.primaryPosition?.abbreviation,
      team: p.currentTeam?.name,
      teamAbbr: p.currentTeam?.abbreviation,
      birthDate: p.birthDate,
      age: p.currentAge,
      height: p.height,
      weight: p.weight,
      batSide: p.batSide?.description,
      pitchHand: p.pitchHand?.description,
    });
  } catch (err) {
    console.error('Error fetching player:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /teams
// Returns all active MLB teams
app.get('/teams', async (req, res) => {
  const season = req.query.season || new Date().getFullYear();
  try {
    const { data } = await axios.get(`${MLB_BASE}/teams`, {
      params: { sportId: 1, season },
    });
    const teams = (data.teams || []).map(t => ({
      id: t.id,
      name: t.name,
      abbreviation: t.abbreviation,
      division: t.division?.name,
      league: t.league?.name,
      venue: t.venue?.name,
    }));
    res.json({ season, count: teams.length, teams });
  } catch (err) {
    console.error('Error fetching teams:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /teams/:id/roster
// Returns the active roster for a team
// Query params: rosterType (active | fullRoster | 40Man, default: active)
app.get('/teams/:id/roster', async (req, res) => {
  const { id } = req.params;
  const rosterType = req.query.rosterType || 'active';
  const season = req.query.season || new Date().getFullYear();
  try {
    const { data } = await axios.get(`${MLB_BASE}/teams/${id}/roster`, {
      params: { rosterType, season },
    });
    const roster = (data.roster || []).map(p => ({
      id: p.person.id,
      name: p.person.fullName,
      pos: p.position?.abbreviation,
      jerseyNumber: p.jerseyNumber,
      status: p.status?.description,
    }));
    res.json({ teamId: Number(id), rosterType, season, count: roster.length, roster });
  } catch (err) {
    console.error('Error fetching roster:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /stats/leaders
// Returns league leaders for a given stat category
// Query params: season, statType (season), leaderCategories (homeRuns, battingAverage, etc.)
app.get('/stats/leaders', async (req, res) => {
  const season = req.query.season || new Date().getFullYear();
  const leaderCategories = req.query.leaderCategories || 'homeRuns';
  const limit = req.query.limit || 50;
  try {
    const { data } = await axios.get(`${MLB_BASE}/stats/leaders`, {
      params: { season, statType: 'season', leaderCategories, limit, sportId: 1 },
    });
    const categories = (data.leagueLeaders || []).map(cat => ({
      category: cat.leaderCategory,
      leaders: (cat.leaders || []).map(l => ({
        rank: l.rank,
        value: l.value,
        playerId: l.person?.id,
        playerName: l.person?.fullName,
        team: l.team?.name,
        teamAbbr: l.team?.abbreviation,
      })),
    }));
    res.json({ season, categories });
  } catch (err) {
    console.error('Error fetching leaders:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /auction/players
// Purpose-built endpoint for DraftDay: returns all active players
// with hitting OR pitching stats in one call, ready for the auction pool
app.get('/auction/players', async (req, res) => {
  const season = req.query.season || new Date().getFullYear();
  try {
    // Fetch all active players
    const { data: peopleData } = await axios.get(`${MLB_BASE}/sports/1/players`, {
      params: { season, gameType: 'R' },
    });
    const people = peopleData.people || [];

    // Fetch hitting leaders (covers all batters with PA)
    const { data: hitData } = await axios.get(`${MLB_BASE}/stats`, {
      params: {
        stats: 'season',
        group: 'hitting',
        season,
        sportId: 1,
        limit: 1000,
        offset: 0,
      },
    });

    // Fetch pitching leaders
    const { data: pitchData } = await axios.get(`${MLB_BASE}/stats`, {
      params: {
        stats: 'season',
        group: 'pitching',
        season,
        sportId: 1,
        limit: 500,
        offset: 0,
      },
    });

    // Index stats by player id
    const hitMap = {};
    (hitData.stats?.[0]?.splits || []).forEach(s => {
      hitMap[s.player?.id] = s.stat;
    });
    const pitchMap = {};
    (pitchData.stats?.[0]?.splits || []).forEach(s => {
      pitchMap[s.player?.id] = s.stat;
    });

    // Merge
    const players = people.map(p => {
      const pos = p.primaryPosition?.abbreviation || 'N/A';
      const isPitcher = ['SP', 'RP', 'P'].includes(pos);
      const stats = isPitcher ? (pitchMap[p.id] || null) : (hitMap[p.id] || null);
      return {
        id: p.id,
        name: p.fullName,
        pos,
        team: p.currentTeam?.abbreviation || 'FA',
        teamFull: p.currentTeam?.name || 'Free Agent',
        isPitcher,
        stats: stats ? (isPitcher ? {
          era: stats.era,
          wins: stats.wins,
          losses: stats.losses,
          saves: stats.saves,
          strikeouts: stats.strikeOuts,
          whip: stats.whip,
          ip: stats.inningsPitched,
          gamesStarted: stats.gamesStarted,
        } : {
          avg: stats.avg,
          hr: stats.homeRuns,
          rbi: stats.rbi,
          sb: stats.stolenBases,
          runs: stats.runs,
          obp: stats.obp,
          slg: stats.slg,
          ops: stats.ops,
          hits: stats.hits,
          ab: stats.atBats,
        }) : null,
      };
    });

    res.json({ season, count: players.length, players });
  } catch (err) {
    console.error('Error fetching auction players:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`DraftDay MLB proxy listening on port ${PORT}`);
});
