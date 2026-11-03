export const TYPES = ['日常', '概念', '武力', '科学', '奇迹'];
export const LIMITS = [4, 5, 3, 2, 1];
export const HINTS = [
  {name: '祖先', cost: 1, description: '查看第 0 世代绘图卡，并在线下指向其中一幅图。'},
  {name: '心灵感应', cost: 2, description: '导师在本轮辅助词的纸条上补写含义。需要先添加辅助词。'},
  {name: '灵感', cost: 3, description: '共同在纸上新增一个词，写下发音与含义，放入词典；现在起即可使用。'}
];
export function shuffle(items, random = Math.random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function createGame(name, players, cards, minutes = 0) {
  if (!Array.isArray(players) || players.length < 3 || players.length > 5 || players.some(p => typeof p !== 'string' || !p.trim() || p.length > 30)) throw Error('请输入 3～5 位玩家，每个姓名不超过 30 字。');
  return {version: 1, name: name.trim() || '未命名文明', players, created: new Date().toISOString(), stage: 'foundation', baseCount: 0, essentials: [false,false,false,false], mentor: 0, generation: 1, round: 1, used: [0,0,0,0,0], decks: [1,2,3,4,5].map(g => shuffle(cards.filter(c => c.generation === g).map(c => c.id))), tokens: 0, earned: [0,0,0,0,0], spent: [0,0,0,0,0], minutes, turn: null, log: [], rewards: 0};
}
function requireState(condition, message = '当前阶段不能进行此操作。') { if (!condition) throw Error(message); }
function prepare(s) {
  s.stage = 'prepare';
  s.tokens = Math.min(5, s.tokens + 6 - s.generation);
  const id = s.decks[s.generation - 1].shift();
  requireState(id !== undefined, '牌堆已空。');
  s.turn = {candidates: [id], selected: null, redrawn: false, hints: [false,false,false], auxiliary: false, attempts: 0, success: null, events: []};
}
function finishRound(s, cards, success) {
  const card = cards.find(c => c.id === s.turn.selected.card);
  const entry = card.entries[s.turn.selected.entry];
  s.turn.success = success;
  if (success) for (const icon of entry.icons) s.earned[icon]++;
  s.used[s.generation - 1]++;
  s.log.push({round: s.round, generation: s.generation, mentor: s.mentor, card: card.id, entry: s.turn.selected.entry, success, attempts: s.turn.attempts, hints: [...s.turn.hints], events: [...s.turn.events]});
  s.stage = 'application';
}
export function transition(state, action, cards) {
  const s = structuredClone(state);
  switch(action.type) {
    case 'base':
      requireState(s.stage === 'foundation');
      s.baseCount = Math.max(0, Math.min(18, s.baseCount + action.delta)); break;
    case 'essential':
      requireState(s.stage === 'foundation' && Number.isInteger(action.index) && action.index >= 0 && action.index < 4);
      s.essentials[action.index] = !s.essentials[action.index]; break;
    case 'encounter':
      requireState(s.stage === 'foundation' && s.baseCount === 18 && s.essentials.every(Boolean), '请先在线下完成 18 个基础词和四个必备词。');
      s.stage = 'encounter'; break;
    case 'start': requireState(s.stage === 'encounter'); prepare(s); break;
    case 'redraw': {
      requireState(s.stage === 'prepare' && !s.turn.redrawn);
      const id = s.decks[s.generation - 1].shift();
      requireState(id !== undefined, '没有可重抽的卡。');
      s.turn.candidates.push(id); s.turn.redrawn = true; break;
    }
    case 'select': {
      requireState(s.stage === 'prepare' && s.turn.candidates.includes(action.card) && Number.isInteger(action.entry) && action.entry >= 0 && action.entry < 5);
      s.turn.selected = {card: action.card, entry: action.entry};
      for (const id of s.turn.candidates) if(id !== action.card) s.decks[s.generation - 1].push(id);
      s.stage = 'ready'; break;
    }
    case 'enlighten': requireState(s.stage === 'ready'); s.stage = 'enlighten'; break;
    case 'auxiliary': requireState(s.stage === 'enlighten' && !s.turn.auxiliary); s.turn.auxiliary = true; break;
    case 'hint': {
      const h = HINTS[action.index];
      requireState(s.stage === 'enlighten' && h && !s.turn.hints[action.index] && s.tokens >= h.cost && (action.index !== 1 || s.turn.auxiliary), '标记不足、提示已使用，或尚未添加辅助词。');
      s.tokens -= h.cost; s.turn.hints[action.index] = true;
      s.turn.events.push(`使用${h.name}（${h.cost}）`);
      if (s.tokens === 0) finishRound(s, cards, false);
      break;
    }
    case 'attempt':
      requireState(s.stage === 'enlighten' && s.tokens > 0);
      s.tokens--; s.turn.attempts++; s.stage = 'answer';
      s.turn.events.push('作答（1）'); break;
    case 'judge':
      requireState(s.stage === 'answer' && typeof action.success === 'boolean');
      if (action.success || s.tokens === 0) finishRound(s, cards, action.success);
      else s.stage = 'enlighten'; break;
    case 'reward': {
      const i = action.index;
      requireState(s.stage === 'application' && Number.isInteger(i) && i >= 0 && i < 5);
      const cost = i === 4 ? 1 : 2;
      requireState(s.earned[i] - s.spent[i] >= cost, '可用发展标记不足。');
      s.spent[i] += cost; s.rewards++; break;
    }
    case 'next':
      requireState(s.stage === 'application');
      if (s.generation === 5) { s.stage = 'finished'; break; }
      if (s.used[s.generation - 1] === LIMITS[s.generation - 1]) { s.decks[s.generation - 1] = []; s.generation++; }
      s.round++; s.mentor = (s.mentor + 1) % s.players.length; prepare(s); break;
    default: throw Error('未知操作。');
  }
  return s;
}
export function score(earned) {
  const basic = earned.slice(0,4).reduce((a,b) => a+b, 0) + earned[4] * 3;
  let sets = 0;
  while (earned.slice(0,4).reduce((n,v) => n + Math.max(0, sets + 1 - v), 0) <= earned[4]) sets++;
  const total = basic + sets * 4;
  const level = total >= 67 ? '等级 3 · 银河文明' : total >= 35 ? '等级 2 · 恒星文明' : total >= 24 ? '等级 1 · 行星文明' : total >= 19 ? '规则未定义等级' : '等级 0 · 地球文明';
  return {basic, sets, bonus: sets * 4, total, level};
}
// 导入不可信 JSON 时逐项校验，再由 UI 接管；绝不执行存档内容。
export function validateGame(s, cards) {
  const int = (x, min, max) => Number.isInteger(x) && x >= min && x <= max;
  const five = (a, max) => Array.isArray(a) && a.length === 5 && a.every(x => int(x,0,max));
  const bools = (a,n) => Array.isArray(a) && a.length === n && a.every(x => typeof x === 'boolean');
  const stages = ['foundation','encounter','prepare','ready','enlighten','answer','application','finished'];
  requireState(s && s.version === 1 && typeof s.name === 'string' && s.name.length <= 60 && typeof s.created === 'string' && !Number.isNaN(Date.parse(s.created)), '存档格式或版本不正确。');
  requireState(Array.isArray(s.players) && int(s.players.length,3,5) && s.players.every(p => typeof p === 'string' && p.trim() && p.length <= 30), '存档玩家信息不正确。');
  requireState(stages.includes(s.stage) && int(s.mentor,0,s.players.length-1) && int(s.generation,1,5) && int(s.round,1,15) && int(s.tokens,0,5) && int(s.baseCount,0,18) && bools(s.essentials,4) && int(s.minutes,0,120) && int(s.rewards,0,100), '存档进度不正确。');
  requireState(five(s.used,5) && s.used.every((v,i) => v <= LIMITS[i]) && five(s.earned,100) && five(s.spent,100) && s.spent.every((v,i) => v <= s.earned[i]), '存档标记不正确。');
  requireState(Array.isArray(s.decks) && s.decks.length === 5 && s.decks.every((deck,i) => Array.isArray(deck) && new Set(deck).size === deck.length && deck.every(id => cards.some(c => c.id === id && c.generation === i+1))), '存档牌库不正确。');
  requireState(Array.isArray(s.log) && s.log.length <= 15 && s.log.every(l => l && int(l.round,1,15) && int(l.generation,1,5) && int(l.mentor,0,s.players.length-1) && cards.some(c => c.id === l.card && c.generation === l.generation) && int(l.entry,0,4) && typeof l.success === 'boolean' && int(l.attempts,0,5) && bools(l.hints,3) && Array.isArray(l.events) && l.events.length <= 10 && l.events.every(e => typeof e === 'string' && e.length < 100)), '存档历史不正确。');
  const totalUsed = s.used.reduce((a,b) => a+b,0);
  const applied = ['application','finished'].includes(s.stage);
  requireState(s.log.length === totalUsed && s.round === totalUsed + (applied ? 0 : 1), '存档轮数与历史不一致。');
  requireState(s.used.every((v,i) => i < s.generation-1 ? v === LIMITS[i] : i > s.generation-1 ? v === 0 : true), '存档世代进度不一致。');
  requireState(s.stage !== 'finished' || (s.generation === 5 && totalUsed === 15), '存档尚未完成全部世代。');
  requireState(s.mentor === (s.round-1) % s.players.length, '存档导师与座次不一致。');
  const counted = [0,0,0,0,0];
  const usedCards = new Set();
  for (const [i,l] of s.log.entries()) {
    requireState(l.round === i+1 && l.mentor === i % s.players.length && !usedCards.has(l.card), '存档历史顺序不正确。');
    usedCards.add(l.card);
    if (l.success) for (const icon of cards.find(c => c.id === l.card).entries[l.entry].icons) counted[icon]++;
  }
  requireState(counted.every((n,i) => n === s.earned[i]), '存档发展标记与历史不一致。');
  if (['foundation','encounter'].includes(s.stage)) requireState(s.turn === null);
  else {
    const t = s.turn;
    requireState(t && Array.isArray(t.candidates) && int(t.candidates.length,1,2) && new Set(t.candidates).size === t.candidates.length && t.candidates.every(id => cards.some(c => c.id === id && c.generation === s.generation)) && bools(t.hints,3) && typeof t.auxiliary === 'boolean' && typeof t.redrawn === 'boolean' && int(t.attempts,0,5) && [null,true,false].includes(t.success) && Array.isArray(t.events) && t.events.length <= 10 && t.events.every(e => typeof e === 'string' && e.length < 100), '存档回合不正确。');
    if(s.stage !== 'prepare') requireState(t.selected && t.candidates.includes(t.selected.card) && int(t.selected.entry,0,4), '存档选题不正确。');
    else requireState(t.selected === null);
  }
  return s;
}
