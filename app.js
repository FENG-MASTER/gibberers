import {MIN_PLAYERS, MAX_PLAYERS, TYPES, LIMITS, HINTS, createGame, transition, score, validateGame, gameCards} from './engine.js';
const $ = s => document.querySelector(s);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLORS = ['#b68a4b','#68839d','#ac6250','#678561','#947697'];
const KEY = 'gibberers-v1', TIMER_KEY = 'gibberers-timer-v1';
let cards, game = null, undo = [], privateView = false, customEditor = false, home = true, storageError = '', timer = null, toastTimeout, imageIndex = 1;
const button = (text, action, secondary = false, disabled = false, extra = '') => `<button class="button ${secondary?'secondary':''}" data-action="${action}" ${disabled?'disabled':''} ${extra}>${text}</button>`;
function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('visible'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('#toast').classList.remove('visible'),4500); }
function modal(html, closeText = '关闭') { $('#modal-content').innerHTML = html; $('#modal-close').textContent = closeText; if (!$('#modal').open) $('#modal').showModal(); }
function closeModal() { $('#modal').close(); }
function save() {
  try { localStorage.setItem(KEY,JSON.stringify({game,undo})); storageError = ''; }
  catch { storageError = '浏览器未能保存进度。请导出存档，避免关闭后丢失。'; toast(storageError); }
}
function saveTimer() { try { localStorage.setItem(TIMER_KEY,JSON.stringify(timer)); } catch {} }
function resetTimer() { timer = null; saveTimer(); }
function timerRemaining() { return timer ? (timer.deadline ? Math.max(0,timer.deadline-Date.now()) : timer.remaining) : 0; }
function run(action) {
  try {
    const next = transition(game,action,cards);
    undo.push(structuredClone(game)); if (undo.length > 40) undo.shift();
    game = next; privateView = false; customEditor = false;
    if (action.type === 'enlighten' && game.minutes > 0) { timer = {round:game.round,created:game.created,deadline:Date.now()+game.minutes*60000,remaining:game.minutes*60000}; saveTimer(); }
    if (['application','finished'].includes(game.stage)) resetTimer();
    save(); render();
    if (['start','next','select','custom'].includes(action.type)) window.scrollTo({top:0,behavior:'instant'});
    return true;
  } catch(e) { toast(e.message); return false; }
}
function renderHome() {
  return `${game ? `<section class="panel resume"><div><div class="eyebrow">保存在这台设备上的文明</div><h3>${esc(game.name)}</h3><p class="muted">${game.players.length} 位参与者 · ${game.stage==='finished'?'已结束':game.stage==='foundation'||game.stage==='encounter'?'第 0 世代':`第 ${game.generation} 世代 · 第 ${game.round} / 15 轮`}</p></div><div class="actions">${button(game.stage==='finished'?'查看结算':'继续上局','resume')}${button('导出存档','export',true)}</div></section>`:''}
  <section class="hero"><div class="hero-copy"><div class="eyebrow">一张桌子，一门新语言</div><h1>从第一句话，<br>到一个文明。</h1><p class="description">把词语写在纸上，把想象留给彼此。<br>这里帮你抽卡、记录启迪，陪伴文明走过五个世代。</p><div class="hero-tags"><span>3—10 人合作</span><span>约 180 分钟</span><span>纸笔造词</span></div><div class="illustration" aria-hidden="true"><div class="paper-note"><small>PRONUNCIATION / 发音</small><strong>Poipa</strong><span>我们的第一句话</span></div><div class="paper-note"><small>MEANING / 含义</small><strong>我 · 知道</strong><span>每个词，都从理解开始</span></div></div></div>
  <form class="panel" id="setup"><div class="eyebrow">新的开始 / NEW CIVILIZATION</div><h2>召集你的文明</h2><label class="field"><span>文明名称</span><input name="civilization" type="text" maxlength="60" placeholder="为你们的文明起个名字" autocomplete="off"></label><div class="form-row"><label class="field"><span>参与人数</span><select id="player-count" name="count">${Array.from({length:MAX_PLAYERS-MIN_PLAYERS+1},(_,i)=>{const n=i+MIN_PLAYERS;return `<option value="${n}" ${n===4?'selected':''}>${n} 人</option>`;}).join('')}</select></label><label class="field"><span>启迪计时（默认关闭）</span><select name="timer" id="timer-setting"><option value="0">不限时</option><option value="3">3 分钟</option><option value="5">5 分钟</option><option value="10">10 分钟</option><option value="custom">自定义</option></select></label></div><label class="field" id="custom-timer-field" hidden><span>每轮时长（1～120 分钟）</span><input name="customMinutes" type="number" min="1" max="120" value="5"></label><div class="field"><span>按顺时针座次填写 · 第一位担任首任导师</span><div class="players" id="players">${playerFields(4)}</div></div><p class="muted">准备好纸笔和桌面词典，所有人共用这台设备。</p><button class="button full" type="submit">开启文明 <span aria-hidden="true">→</span></button><div class="toolbar">${button('导入存档','import',true,false,'type="button"')}${button('玩法速查','rules',true,false,'type="button"')}</div></form></section>`;
}
function playerFields(count, values = []) { return Array.from({length:count},(_,i)=>`<label class="seat"><span>${String(i+1).padStart(2,'0')}</span><input type="text" name="player${i}" maxlength="30" aria-label="第 ${i+1} 位玩家" placeholder="玩家 ${i+1}" value="${esc(values[i]||'')}" autocomplete="off"></label>`).join(''); }
function sidePanel() {
  const s = game; const showResources = !['foundation','encounter'].includes(s.stage);
  return `<aside class="panel side-panel"><div><h3>${showResources?'可用启迪标记':'桌面准备'}</h3>${showResources?`<div class="tokens" aria-label="${s.tokens} 个可用启迪标记">${Array.from({length:5},(_,i)=>`<span class="token ${i>=s.tokens?'empty':''}">${i<s.tokens?'✦':'·'}</span>`).join('')}</div><p class="muted">剩余 ${s.tokens} / 5 · 作答消耗 1 个<br>下一轮保留余量，按世代补充。</p>`:`<p class="muted">纸笔 · 公共词典区<br>按顺时针顺序入座<br>第 0 世代绘图卡已备好</p>`}${s.minutes>0&&['enlighten','answer'].includes(s.stage)?`<div class="timer"><div class="stage-label">本轮启迪计时</div><div id="timer-value">--:--</div><div class="row"><button class="text-button" data-action="timer-toggle" id="timer-toggle">暂停</button><button class="text-button" data-action="timer-reset">重新计时</button></div><small class="muted" id="timer-note">到时提醒，由全体决定后续处理。</small></div>`:''}</div><div class="resources"><h3>文明发展 <span class="muted">累计 / 可用</span></h3>${TYPES.map((t,i)=>`<div class="stat-line"><span><i class="type-mark" style="--mark:${COLORS[i]}"></i>${t}</span><strong>${s.earned[i]} <span class="muted">/ ${s.earned[i]-s.spent[i]}</span></strong></div>`).join('')}<p class="muted" style="margin:12px 0 0">已兑换的标记仍参与结算。</p></div></aside>`;
}
function foundation() {
  return `<div class="stage-label">第 0 世代 · 创造基础词语</div><h2>先给世界，十八个名字。</h2><p class="description">从导师开始，顺时针轮流造词。在纸上先写发音，再写含义；放入公共词典区。这里只记录完成数量。</p><div class="count-control">${button('−','base-minus',true,game.baseCount===0,'aria-label="减少一个基础词"')}<strong>${game.baseCount}<small> / 18</small></strong>${button('＋','base-plus',true,game.baseCount===18,'aria-label="增加一个基础词"')}</div><h3>确认这四个含义已包含在 18 个词里</h3><div class="checks">${['是','否','我','知道'].map((t,i)=>`<button class="check ${game.essentials[i]?'checked':''}" aria-pressed="${game.essentials[i]}" data-action="essential" data-index="${i}">${game.essentials[i]?'✓ ':''}${t}</button>`).join('')}</div><div class="callout">发音采用同一种旧语言的风格；不能与已有词同音，也不能与含义的原读音相同或相似。建议 1～4 个音节。</div><div class="actions">${button('查看第 0 世代绘图卡','ancestors',true)}${button('基础词已完成 →','encounter',false,game.baseCount!==18||!game.essentials.every(Boolean))}</div>`;
}
function encounter() { return `<div class="stage-label">第 0 世代 · 相遇仪式</div><h2>用你们的语言，认识彼此。</h2><p class="description">从导师开始，按顺时针顺序，仅使用基础词语进行自我介绍。使用刚刚创造的“我”和“知道”。</p><div class="callout">检查：18 张纸条都已经写好发音和含义，并按发音首字母整理到公共词典区。</div><p class="muted">下一步由 ${esc(game.players[game.mentor])} 担任导师，私下抽取第一张知识卡。</p><div class="actions">${button('所有人已完成介绍 · 开始第一轮','start')}</div>`; }
function secretGate() { return `<div class="stage-label">准备 · 导师私密选题</div><div class="secret-gate"><div class="secret-symbol" aria-hidden="true">◇</div><h2>请把设备交给<br>${esc(game.players[game.mentor])}</h2><p class="description">接下来只有导师查看卡牌。其他人请移开视线；选好题目后，屏幕会自动隐藏答案。</p>${button('我是导师 · 私下看题','reveal')}<p class="muted" style="margin-top:20px">第 ${game.generation} 世代 · 本轮可${game.turn.redrawn?'重抽已用':'重抽一次'}</p></div>`; }
function customForm() {
  const multiple=game.generation>=4;
  return `<div class="row" style="justify-content:space-between"><div class="stage-label">仅导师可见 · 自定义知识</div>${button('立即隐藏','hide-secret',true)}</div><h2>给这张卡，一个自己的含义。</h2><p class="description">填写想让大家猜的知识，并选择猜对后获得的发展类型。发音仍在线下纸条上创造。</p><form id="custom-knowledge"><label class="field"><span>知识含义（最多 120 字）</span><textarea name="meaning" maxlength="120" rows="3" required placeholder="例如：萤火虫 / 发光"></textarea></label><fieldset class="custom-types"><legend>发展类型 · ${multiple?'可多选，每种获得 1 个标记':'请选择一种'}</legend>${TYPES.map((t,i)=>`<label class="type-choice"><input type="${multiple?'checkbox':'radio'}" name="customType${multiple?i:''}" value="${i}" ${multiple?'':'required'}><i class="type-mark" style="--mark:${COLORS[i]}"></i>${t}</label>`).join('')}</fieldset><div class="callout">本轮会计入当前世代进度。已抽出的卡会放回牌堆底部；自定义含义和类型会随本局存档保存。请根据当前世代选择合适的知识难度。</div><div class="actions"><button class="button" type="submit">使用这项知识 · 隐藏题目</button>${button('返回抽卡','cancel-custom',true,false,'type="button"')}</div></form>`;
}
function secretCards() {
  if(customEditor && game.stage==='prepare') return customForm();
  const ready = game.stage !== 'prepare';
  const list = ready ? [game.turn.selected.card] : game.turn.candidates;
  return `<div class="row" style="justify-content:space-between"><div class="stage-label">仅导师可见 · 请勿向其他人展示</div>${button('立即隐藏','hide-secret',true)}</div><h2>${ready?'本轮所选知识':'选择一项知识'}</h2><p class="description">${ready?'查看完毕后隐藏屏幕，继续用新语言解释。':'选择后，请在线下纸条上创造并写下一个新发音，暂不填写含义。'}</p><div class="cards">${list.map(id=>{const c=gameCards(game,cards).find(c=>c.id===id);return `<section class="knowledge-card"><h3>世代 ${c.generation} / 知识卡 ${typeof c.id==='number'?String(c.id).padStart(2,'0'):'自定义'}</h3>${c.entries.map((e,i)=>ready&&i!==game.turn.selected.entry?'':`<${ready?'div':'button'} class="knowledge-option" ${ready?'':`data-action="select" data-card="${id}" data-entry="${i}"`}><span><strong>${esc(e.text)}</strong><small>${esc(e.en)}</small></span><span class="icons">${e.icons.map(t=>TYPES[t]).join(' · ')}${ready?'':' →'}</span></${ready?'div':'button'}>`).join('')}</section>`;}).join('')}</div>${!ready?`<div class="actions">${button('自己创造知识','custom-editor',true)}${button(game.turn.redrawn?'本轮重抽已使用':'重抽一次 · 两张中任选','redraw',true,game.turn.redrawn)}</div><p class="muted" style="margin-top:12px">未选的卡会放回本世代牌堆底部。每张卡只选一项知识。</p>`:''}`;
}
function ready() { return `<div class="stage-label">准备 · 题目已隐藏</div><h2>把新发音，写在纸上。</h2><p class="description">导师写好发音后，向学生展示纸条。不要写含义。大家准备好后，点击开始启迪。</p><div class="callout">${game.generation<=2?'本世代导师可以配合手势说明。':'从第 3 世代起，导师不可以使用手势说明。'}启迪开始后只能使用新语言交流，学生正式作答时可以用旧语言说答案。</div><div class="actions">${button('已写好发音 · 开始启迪','enlighten')}${button('导师复看题目','reveal',true)}</div>`; }
function enlighten() {
  return `<div class="stage-label">启迪 · 只用你们的新语言</div><h2>让彼此，听懂这个世界。</h2><p class="description">导师解释，学生讨论与提问。准备作答时，先用新语言说“我知道”，再支付 1 个启迪标记，用旧语言说出答案。</p><div class="row">${button('我要作答 · 消耗 1 个','attempt',false,game.tokens<1)}${button(game.turn.auxiliary?'本轮已添加辅助词':'添加辅助词（免费一次）','auxiliary',true,game.turn.auxiliary)}</div><div class="hint-list">${HINTS.map((h,i)=>`<div class="hint"><div><strong>${h.name} <span class="muted">/ ${h.cost} 个标记</span></strong><p>${i===0?'指向第 0 世代绘图中的一幅图':i===1?'揭示本轮辅助词的含义':'在纸上新增一个完整词语'}</p></div>${button(game.turn.hints[i]?'已使用':'使用','hint',true,game.turn.hints[i]||game.tokens<h.cost||(i===1&&!game.turn.auxiliary),`data-index="${i}"`)}</div>`).join('')}</div><p class="muted" style="margin:16px 0 0">提示须全体同意，每种每轮限一次。${game.generation<=2?'本世代导师可以使用手势。':'本世代不能使用手势说明。'}</p><div class="toolbar"><button class="text-button" data-action="reveal">导师私下复看题目</button>${game.turn.hints[0]?'<button class="text-button" data-action="ancestors">再次查看祖先绘图</button>':''}</div>`;
}
function answering() { return `<div class="stage-label">启迪 · 第 ${game.turn.attempts} 次作答</div><h2>请说出，你理解的含义。</h2><p class="description">已消耗 1 个启迪标记。学生用旧语言说出答案，导师用新语言回应，再在这里记录判断。</p><div class="callout">由导师判断是否大致正确，不必逐字相同。若知识列出多个含义，答中任意一组即可。</div><div class="actions">${button('回答正确','correct')}${button('回答错误','incorrect',true)}</div><div class="toolbar"><button class="text-button" data-action="reveal">导师私下核对题目</button></div><p class="muted" style="margin-top:20px">${game.tokens===0?'这是最后一次作答；回答正确仍算成功。回答错误则本轮失败。':`回答错误后，仍可使用剩余 ${game.tokens} 个启迪标记。`}</p>`; }
function rewards() { return `<h3>发展奖励 · 在纸上创造额外词语</h3><p class="muted">消耗 2 个同类标记，或 1 个奇迹标记。共同讨论含义，导师决定发音；可多次兑换。已用标记仍计分。</p>${TYPES.map((t,i)=>`<div class="reward-row"><span><i class="type-mark" style="--mark:${COLORS[i]}"></i>${t} · 可用 ${game.earned[i]-game.spent[i]}</span>${button(`用 ${i===4?1:2} 个换新词`,'reward',true,game.earned[i]-game.spent[i]<(i===4?1:2),`data-index="${i}"`)}</div>`).join('')}`; }
function application() {
  const c=gameCards(game,cards).find(c=>c.id===game.turn.selected.card), e=c.entries[game.turn.selected.entry];
  const advancing=game.used[game.generation-1]===LIMITS[game.generation-1];
  return `<div class="stage-label">应用 · 现在可以使用旧语言</div><h2>${game.turn.success?'理解，让文明向前一步。':'这次没猜中，词语仍会留下。'}</h2><div class="answer-box"><div class="stage-label">${game.turn.success?'启迪成功':'启迪失败'} · ${typeof c.id==='number'?'知识卡 '+c.id:'自定义知识'}</div><div class="answer">${esc(e.text)}</div><p class="muted">${esc(e.en)}</p>${game.turn.success?e.icons.map(i=>`<span class="badge">＋1 ${TYPES[i]}</span>`).join(''):'<span class="muted">本轮未获得发展标记</span>'}</div><div class="callout">无论成败，请把上述含义全部补写到本轮词语纸条上，再按发音索引放回词典。</div>${advancing?`<p class="muted">${game.generation===5?'第 5 世代已完成。处理完本轮纸条与奖励后，即可结算。':`第 ${game.generation} 世代已完成 ${LIMITS[game.generation-1]} 轮，剩余牌将移出游戏。下一轮进入第 ${game.generation+1} 世代。`}</p>`:''}${rewards()}<div class="actions">${button(game.generation===5?'纸条已整理 · 文明结算':'纸条已整理 · 交给下一位导师','next')}</div>`;
}
function finished() {
  const result=score(game.earned);
  return `<div class="stage-label">文明结算 · ${esc(game.name)}</div><h2>你们共同创造了一个世界。</h2><div class="score-hero"><div class="eyebrow">文明潜力</div><strong>${result.total}</strong><p>${result.level}</p></div><div class="score-breakdown"><div><strong>${result.basic}</strong><small>发展标记分</small></div><div><strong>${result.sets} × 4</strong><small>完整套组奖励</small></div><div><strong>${game.log.filter(l=>l.success).length} / 15</strong><small>启迪成功</small></div></div><p class="muted">日常、概念、武力、科学每个 1 分，奇迹每个 3 分。每套四类标记额外得 4 分，奇迹自动补齐套组；兑换过奖励的标记全部计入。</p>${result.total>=19&&result.total<=23?'<div class="callout">现有规则没有定义 19～23 分对应的等级，因此只记录分数，不补设等级。</div>':''}<div class="callout">最后一起挑选最喜欢的词，在线下文明记录册上写下它们的发音、含义和用法。把这门语言留作纪念。</div><div class="actions">${button('导出这段文明','export')}${button('回顾 15 轮历程','history',true)}${button('返回开始页','home',true)}</div>`;
}
function render() {
  const app=$('#app');
  if(home) app.innerHTML = renderHome();
  else {
    const s=game, zero=['foundation','encounter'].includes(s.stage);
    const stageHtml=privateView?secretCards():({foundation,encounter,prepare:secretGate,ready,enlighten,answer:answering,application,finished}[s.stage])();
    app.innerHTML = `<div class="game-header"><div><div class="eyebrow">${zero?'语言的诞生':s.stage==='finished'?'文明的回响':`第 ${s.round} / 15 轮 · 共同的旅程`}</div><h1>${esc(s.name)}</h1><p class="muted" style="margin:0">${s.players.map(esc).join(' · ')}</p></div><div class="mentor-badge"><small>本轮导师</small>${esc(s.players[s.mentor])}</div></div>${!zero?`<div class="generations" aria-label="世代进度">${LIMITS.map((n,i)=>`<div class="generation ${s.generation===i+1?'active':''} ${s.used[i]===n?'done':''}">第 ${i+1} 世代<span>${s.used[i]} / ${n}</span></div>`).join('')}</div>`:''}<div class="game-grid"><section class="panel stage-content">${stageHtml}</section>${sidePanel()}</div><nav class="toolbar" aria-label="对局工具">${button('撤销上一步','undo',true,!undo.length)}${button('玩法速查','rules',true)}${button('对局记录','history',true)}<button class="text-button" data-action="export">导出存档</button><button class="text-button" data-action="home">保存并返回</button></nav>`;
  }
  if(storageError) { const warning=document.createElement('div'); warning.className='notice'; warning.textContent=storageError; app.prepend(warning); }
  updateTimer();
}
function ancestors(index = 1) {
  imageIndex=index;
  modal(`<div class="eyebrow">第 0 世代 · 公共绘图卡</div><h2>从图画里寻找线索</h2><p class="muted">点击图片可以标出一处位置。${game?.stage==='enlighten'?'只指图，不用旧语言解释。':'可放大查看，也可以直接指向屏幕上的图画。'}</p><div class="ancestor-tabs">${[1,2,3,4,5].map(i=>button(`绘图 ${i}`,'ancestor-tab',true,false,`data-index="${i}" aria-pressed="${i===index}" style="${i===index?'background:var(--ink);color:white':''}"`)).join('')}</div><div class="image-wrap" id="ancestor-map"><img class="ancestor-image" src="./assets/ancestor-${index}.png" alt="第 0 世代绘图卡 ${index}"><span class="image-pointer" hidden></span></div>`);
}
function rules() {
  modal(`<div class="eyebrow">专家规则 · 桌边速查</div><h2>把规则交给这里，把交流留给彼此。</h2><ol class="rules-list"><li><strong>第 0 世代：</strong>共同造 18 个基础词，包含“是、否、我、知道”。先发音、后含义，再用新语言自我介绍。</li><li><strong>准备：</strong>导师抽最低世代的一张卡，从五项知识中选一项。可额外抽一次，两张任选，弃选卡放回牌堆底。纸上写新发音，暂不写含义。</li><li><strong>启迪：</strong>只用新语言解释、讨论和提问。第 1、2 世代导师可配合手势，第 3 世代起不可。导师每轮可免费增加一个只写发音的辅助词。</li><li><strong>作答：</strong>先用新语言说“我知道”，支付 1 个启迪标记，再用旧语言回答；导师用新语言反馈。大致正确即可，多含义知识答中任意一组即可。</li><li><strong>提示：</strong>全体同意后使用，每种每轮限一次。祖先 1 个（指绘图）；心灵感应 2 个（补写辅助词含义）；灵感 3 个（共同增加完整新词）。用完标记仍未答中，本轮失败。</li><li><strong>启迪标记：</strong>总量 5 个，每轮保留剩余；第 1～5 世代分别补充 5、4、3、2、1 个，最多 5 个。</li><li><strong>应用：</strong>成功获得所选知识的发展标记；无论成败，都补写词语含义并计算使用卡数。各世代分别使用 4、5、3、2、1 张卡，合计 15 轮。</li><li><strong>发展奖励：</strong>2 个同类发展标记或 1 个奇迹标记兑换一个新词。标记翻为已用，不丢弃，仍参与结算；一次应用可以多次兑换。</li><li><strong>结算：</strong>普通标记每个 1 分、奇迹 3 分；日常＋概念＋武力＋科学每套加 4 分，奇迹可以补缺。67 分起等级 3，35 分起等级 2，24 分起等级 1，低于 19 分等级 0；19～23 分原规则未定义。</li></ol><div class="callout">使用 Excel v3 牌库，表中“军事”在界面统一称为“武力”。多数发展图标为 v3 推定值。计时默认关闭；开启需全体同意，到时只提醒，不自动判负。</div>`);
}
function history() {
  if(!game) return;
  modal(`<div class="eyebrow">${esc(game.name)} · 文明历程</div><h2>每一次尝试，都留下了词语。</h2>${game.log.length?`<ol class="history-list">${game.log.map(l=>{const e=gameCards(game,cards).find(c=>c.id===l.card).entries[l.entry];return `<li><span class="instruction-number">${String(l.round).padStart(2,'0')}</span><div><strong>${esc(e.text)}</strong><small>世代 ${l.generation}${typeof l.card==='string'?' · 自定义知识':''} · 导师 ${esc(game.players[l.mentor])} · 作答 ${l.attempts} 次</small><small>提示：${l.hints.map((v,i)=>v?HINTS[i].name:null).filter(Boolean).join('、')||'未使用'}</small></div><span class="result">${l.success?'✓ 成功':'未猜中'}</span></li>`}).join('')}</ol>`:'<p class="muted">完成第一轮启迪后，记录会出现在这里。当前未揭晓的题目不会显示。</p>'}<p class="muted">已兑换 ${game.rewards} 次发展奖励。发音与词典保存在你们的纸条上。</p>`);
}
function exportGame() {
  if(!game) return;
  const blob = new Blob([JSON.stringify({format:'gibberers-save',version:1,game},null,2)],{type:'application/json'});
  const a=document.createElement('a'), url=URL.createObjectURL(blob); a.href=url; a.download=`语言大爆炸-${game.name.replace(/[\\/:*?"<>|]/g,'-')}-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('已导出存档。请在需要时通过开始页导入。');
}
function updateTimer() {
  const el=$('#timer-value'); if(!el) return;
  if(!timer || timer.round!==game.round || timer.created!==game.created) { timer={round:game.round,created:game.created,deadline:null,remaining:game.minutes*60000}; saveTimer(); }
  const seconds=Math.ceil(timerRemaining()/1000); el.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  $('.timer').classList.toggle('expired',seconds===0);
  $('#timer-toggle').textContent=timer.deadline?'暂停':'继续';
  $('#timer-toggle').disabled=seconds===0;
  $('#timer-note').textContent=seconds===0?'时间已到。由全体决定继续或线下处理，不自动判负。':'到时提醒，由全体决定后续处理。';
}
function confirmation(title, description, action, label='确认') { modal(`<h2>${title}</h2><p class="description">${description}</p><div class="actions">${button(label,action)}</div>`,'取消'); }
$('#app').addEventListener('submit',e=>{
  if(e.target.id==='custom-knowledge') {
    e.preventDefault();
    if (!privateView || game.stage !== 'prepare') return;
    const f=new FormData(e.target);
    const icons=game.generation<=3 ? (f.get('customType') == null ? [] : [Number(f.get('customType'))]) : TYPES.map((_,i)=>i).filter(i=>f.get(`customType${i}`));
    run({type:'custom',text:f.get('meaning'),icons});
    return;
  }
  if(e.target.id!=='setup') return; e.preventDefault();
  const f=new FormData(e.target), count=Number(f.get('count'));
  const minutes=f.get('timer')==='custom'?Number(f.get('customMinutes')):Number(f.get('timer'));
  if(!Number.isInteger(minutes)||minutes<0||minutes>120||(f.get('timer')==='custom'&&minutes===0)) return toast('计时时长需为 1～120 分钟。');
  const players=Array.from({length:count},(_,i)=>String(f.get(`player${i}`)||'').trim()||`玩家 ${i+1}`);
  try {
    const next=createGame(String(f.get('civilization')),players,cards,minutes);
    const start=()=>{game=next;undo=[];home=false;privateView=false;resetTimer();save();render();window.scrollTo(0,0);};
    if(game) {
      confirmation('开启一个新的文明？','当前设备只保存一局。可以先导出旧存档，再开始新的一局。','confirm-new','替换本机存档并开始');
      pendingNew=start;
    } else start();
  } catch(err) { toast(err.message); }
});
let pendingNew=null, pendingImport=null;
$('#app').addEventListener('change',e=>{
  if(e.target.id==='player-count') { const values=[...$('#players').querySelectorAll('input')].map(i=>i.value); $('#players').innerHTML=playerFields(Number(e.target.value),values); }
  if(e.target.id==='timer-setting') $('#custom-timer-field').hidden=e.target.value!=='custom';
});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]'); if(!b || b.disabled) return;
  const action=b.dataset.action, index=Number(b.dataset.index);
  if(action==='resume') { home=false;privateView=false;render(); }
  else if(action==='home') { home=true;privateView=false;closeModal();render();window.scrollTo(0,0); }
  else if(action==='rules') rules();
  else if(action==='ancestors') ancestors();
  else if(action==='ancestor-tab') ancestors(index);
  else if(action==='history') history();
  else if(action==='export') exportGame();
  else if(action==='import') $('#import-file').click();
  else if(action==='confirm-import' && pendingImport) {game=pendingImport;pendingImport=null;undo=[];privateView=false;home=false;resetTimer();save();closeModal();render();toast('存档已恢复，秘密题目保持隐藏。');}
  else if(action==='confirm-new' && pendingNew) { closeModal(); pendingNew();pendingNew=null; }
  else if(action==='reveal') { privateView=true;customEditor=false;render(); }
  else if(action==='custom-editor' && game.stage==='prepare' && privateView) { customEditor=true;render(); }
  else if(action==='cancel-custom') { customEditor=false;render(); }
  else if(action==='hide-secret') { privateView=false;render(); }
  else if(action==='redraw') { if(run({type:'redraw'})) {privateView=true;render();} }
  else if(action==='select') run({type:'select',card:Number(b.dataset.card),entry:Number(b.dataset.entry)});
  else if(action==='base-plus'||action==='base-minus') run({type:'base',delta:action==='base-plus'?1:-1});
  else if(action==='essential') run({type:'essential',index});
  else if(['encounter','start','enlighten','attempt','next'].includes(action)) run({type:action});
  else if(action==='correct'||action==='incorrect') run({type:'judge',success:action==='correct'});
  else if(action==='auxiliary') confirmation('在线下增加一个辅助词','导师在新纸条上只写发音，不写含义，放入公共词典。每轮可免费增加一次。','confirm-auxiliary','纸上已写好发音');
  else if(action==='confirm-auxiliary') {closeModal();run({type:'auxiliary'});}
  else if(action==='hint') {
    const h=HINTS[index];
    modal(`<div class="eyebrow">全体同意后使用</div><h2>${h.name} · ${h.cost} 个启迪标记</h2><p>${h.description}</p>${game.tokens===h.cost?'<div class="callout">此提示将耗尽剩余标记，无法再支付正式作答费用，本轮会失败。提示新增的词语仍然保留。通常应至少留 1 个标记作答。</div>':''}<div class="actions">${button('全体同意 · 使用提示','confirm-hint',false,false,`data-index="${index}"`)}</div>`,'取消');
  }
  else if(action==='confirm-hint') {
    closeModal();
    if(run({type:'hint',index})) {
      if(index===0) ancestors();
      else modal(`<h2>${HINTS[index].name}</h2><p>${HINTS[index].description}</p><p class="muted">请先完成纸面操作，再继续游戏。</p>`,'纸面操作已完成');
    }
  }
  else if(action==='reward') confirmation('兑换一次发展奖励',`使用 ${index===4?1:2} 个${TYPES[index]}标记。共同讨论新词含义，由导师决定发音，并在线下纸条上写好。标记仍参与最终计分。`,`confirm-reward-${index}`,'新词已写好 · 确认兑换');
  else if(action.startsWith('confirm-reward-')) {closeModal();run({type:'reward',index:Number(action.split('-').at(-1))});}
  else if(action==='undo') confirmation('撤销上一步？','恢复上一步操作之前的牌堆、标记和阶段。已经写在纸上的内容请自行对应调整。题目会重新隐藏；如回到启迪阶段，计时会重置并暂停。','confirm-undo','确认撤销');
  else if(action==='confirm-undo'&&undo.length) {game=undo.pop();privateView=false;resetTimer();save();closeModal();render();toast('已撤销，请同步检查纸面操作。');}
  else if(action==='timer-toggle') { const remaining=timerRemaining();timer.deadline=timer.deadline?null:Date.now()+remaining;timer.remaining=remaining;saveTimer();updateTimer(); }
  else if(action==='timer-reset') { timer={round:game.round,created:game.created,deadline:null,remaining:game.minutes*60000};saveTimer();updateTimer();toast('计时已重置并暂停，点击“继续”开始。'); }
});
$('#modal-content').addEventListener('click',e=>{
  const map=e.target.closest('#ancestor-map');if(!map)return;
  const rect=map.getBoundingClientRect(),pointer=map.querySelector('.image-pointer');pointer.hidden=false;pointer.style.left=`${100*(e.clientX-rect.left)/rect.width}%`;pointer.style.top=`${100*(e.clientY-rect.top)/rect.height}%`;
});
$('#modal-close').addEventListener('click',closeModal);
$('#modal').addEventListener('close',()=>{pendingNew=null;pendingImport=null;});
$('#import-file').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  try {
    if(file.size>2*1024*1024) throw Error('存档文件不能超过 2 MB。');
    const data=JSON.parse(await file.text());
    if(data.format!=='gibberers-save'||data.version!==1)throw Error('这不是支持的语言大爆炸存档。');
    pendingImport=validateGame(data.game,cards);
    confirmation('恢复这份文明存档？',`${esc(pendingImport.name)} · ${pendingImport.players.length} 位玩家。${game?'导入会替换当前对局，请先导出需要保留的存档。':'存档只保存在当前设备。'}`,'confirm-import','恢复存档');
  }catch(err){pendingImport=null;toast(`无法导入：${err.message}`);}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&privateView){privateView=false;render();}});
window.addEventListener('pagehide',()=>{privateView=false;});
window.addEventListener('pageshow',()=>{if(cards){privateView=false;render();}});
setInterval(updateTimer,500);
async function initOffline() {
  if(!('serviceWorker' in navigator)){ $('#offline-status').textContent='浏览器不支持离线缓存';return; }
  try {
    const registration=await navigator.serviceWorker.register('./sw.js');
    const ready=await navigator.serviceWorker.ready;
    const check=()=>{
      const channel=new MessageChannel();
      channel.port1.onmessage=e=>{if(e.data?.type==='CACHE_READY'){$('#offline-status').textContent='已可离线使用';$('#offline-dot').classList.add('ready');}channel.port1.close();};
      ready.active?.postMessage({type:'CHECK_CACHE'},[channel.port2]);
    };
    check(); navigator.serviceWorker.addEventListener('controllerchange',check);
    registration.addEventListener('updatefound',()=>{ const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)toast('发现新版本。当前对局已保存，关闭所有工具页面后重新打开即可更新。');}); });
  }catch{ $('#offline-status').textContent='离线缓存未完成'; }
}
try {
  const response=await fetch('./assets/cards.json');if(!response.ok)throw Error('牌库加载失败');cards=await response.json();
  try {
    const saved=localStorage.getItem(KEY);
    if(saved){const data=JSON.parse(saved);game=validateGame(data.game,cards);try{undo=Array.isArray(data.undo)?data.undo.slice(-40).map(s=>validateGame(s,cards)):[];}catch{undo=[];}}
    const t=JSON.parse(localStorage.getItem(TIMER_KEY)||'null');
    if(t&&Number.isFinite(t.remaining)&&t.remaining>=0&&t.remaining<=7200000&&(t.deadline===null||Number.isFinite(t.deadline)))timer=t;
  }catch{storageError='无法读取本机存档。可导入之前导出的存档，或开始新的一局。';}
  render();initOffline();
}catch(err){$('#app').innerHTML=`<div class="panel"><h2>暂时没有取到牌库</h2><p>请联网后重新打开页面。离线功能需要首次成功加载并缓存。</p><p class="muted">本地预览请通过 HTTP 服务打开，不能直接双击 HTML 文件。</p><button class="button" onclick="location.reload()">重新加载</button></div>`;}
