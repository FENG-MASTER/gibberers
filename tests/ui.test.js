// 轻量 DOM 替身验证应用事件与状态衔接；不替代真实浏览器布局/PWA 验收。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createGame} from '../engine.js';
const handlers={}, storage=new Map(), elements=new Map();
function element(id){
  if(elements.has(id))return elements.get(id);
  const listeners={};
  const e={id,innerHTML:'',textContent:'',open:false,hidden:false,style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(type,fn){(listeners[type]??=[]).push(fn);},async emit(type,event){for(const fn of listeners[type]||[])await fn(event);},showModal(){this.open=true;},close(){this.open=false;queueMicrotask(()=>this.emit('close',{}));},prepend(){},click(){},querySelectorAll(){return [];}};
  elements.set(id,e);return e;
}
globalThis.document={querySelector(selector){if(selector==='#timer-value'||selector==='.timer')return null;return element(selector.replace(/^#/,''));},createElement:()=>element('temporary'),addEventListener(type,fn){(handlers[type]??=[]).push(fn);}};
globalThis.window={scrollTo(){},addEventListener(){}};
Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});
globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
globalThis.fetch=async()=>({ok:true,json:async()=>JSON.parse(await fs.readFile(new URL('../assets/cards.json',import.meta.url),'utf8'))});
globalThis.setInterval=()=>0;
globalThis.setTimeout=()=>0;
globalThis.FormData=class{constructor(form){this.values=form.values;}get(key){return this.values[key];}};
await import('../app.js');
const html=()=>element('app').innerHTML;
const saved=()=>JSON.parse(storage.get('gibberers-v1')).game;
async function click(action,data={}){const b={disabled:false,dataset:{action,...data}};for(const fn of handlers.click||[])await fn({target:{closest:()=>b}});}
assert.match(html(),/召集你的文明/);
await element('app').emit('submit',{target:{id:'setup',values:{count:'3',timer:'0',civilization:'<文明>',player0:'甲',player1:'乙',player2:'丙'}},preventDefault(){}});
assert.equal(saved().stage,'foundation');assert.match(html(),/&lt;文明&gt;/);assert.doesNotMatch(html(),/<文明>/);
for(let i=0;i<18;i++)await click('base-plus');
for(let i=0;i<4;i++)await click('essential',{index:String(i)});
await click('encounter');await click('start');
assert.match(html(),/请把设备交给/);
await click('reveal');assert.match(html(),/选择一项知识/);
await click('redraw');assert.equal(saved().turn.candidates.length,2);assert.match(html(),/选择一项知识/);
for(let round=1;round<=15;round++){
  await click('select',{card:String(saved().turn.candidates[0]),entry:'0'});
  assert.equal(saved().stage,'ready');assert.doesNotMatch(html(),/knowledge-option/);
  await click('enlighten');
  if(round===1){await click('auxiliary');await click('confirm-auxiliary');assert.equal(saved().turn.auxiliary,true);await click('hint',{index:'1'});await click('confirm-hint',{index:'1'});assert.equal(saved().tokens,3);await element('modal').close();}
  await click('attempt');assert.equal(saved().stage,'answer');await click('correct');
  assert.equal(saved().stage,'application');
  if(round===1){await click('undo');await click('confirm-undo');assert.equal(saved().stage,'answer');await click('correct');}
  await click('next');
}
assert.equal(saved().stage,'finished');assert.match(html(),/文明潜力/);
await click('history');assert.match(element('modal-content').innerHTML,/世代 5/);await element('modal').close();
await click('home');assert.match(html(),/查看结算/);
// 验证开启第二局的确认回调没有在 dialog close 时丢失。
await element('app').emit('submit',{target:{id:'setup',values:{count:'4',timer:'0',civilization:'新文明'}},preventDefault(){}});
await click('confirm-new');assert.equal(saved().name,'新文明');assert.equal(saved().players.length,4);
// 验证导入确认、格式拒绝和当前存档保护。
const cards=JSON.parse(await fs.readFile(new URL('../assets/cards.json',import.meta.url),'utf8'));
const imported=createGame('来自备份',['一','二','三'],cards);
await element('import-file').emit('change',{target:{files:[{size:2000,text:async()=>JSON.stringify({format:'gibberers-save',version:1,game:imported})}],value:'file'}});
await click('confirm-import');assert.equal(saved().name,'来自备份');
await element('import-file').emit('change',{target:{files:[{size:2000,text:async()=>'{}'}],value:'file'}});
assert.equal(saved().name,'来自备份');assert.match(element('toast').textContent,/无法导入/);
console.log('应用交互衔接通过：创建、基础词、私密选题、重抽、提示、撤销、15 轮、结算、第二局确认、导入与无效存档保护。');
// 自定义知识通过同一张私密页面录入、隐藏、复看、揭晓并恢复存档。
for(let i=0;i<18;i++)await click('base-plus');
for(let i=0;i<4;i++)await click('essential',{index:String(i)});
await click('encounter');await click('start');await click('reveal');
assert.match(html(),/自己创造知识/);await click('custom-editor');assert.match(html(),/custom-knowledge/);
await element('app').emit('submit',{target:{id:'custom-knowledge',values:{meaning:'<萤火虫> / 发光',customType:'3'}},preventDefault(){}});
assert.equal(saved().stage,'ready');assert.doesNotMatch(html(),/萤火虫/);
await click('reveal');assert.match(html(),/&lt;萤火虫&gt;/);assert.doesNotMatch(html(),/<萤火虫>/);
await click('hide-secret');await click('enlighten');await click('attempt');await click('correct');
assert.deepEqual(saved().earned,[0,0,0,1,0]);assert.match(html(),/自定义知识/);
await click('history');assert.match(element('modal-content').innerHTML,/&lt;萤火虫&gt;/);await element('modal').close();
const customSave=saved();await click('undo');await click('confirm-undo');assert.equal(saved().stage,'answer');
await element('import-file').emit('change',{target:{files:[{size:5000,text:async()=>JSON.stringify({format:'gibberers-save',version:1,game:customSave})}],value:'file'}});
await click('confirm-import');assert.equal(saved().stage,'application');assert.match(html(),/&lt;萤火虫&gt;/);
console.log('自定义知识交互通过：私密填写、隐藏、复看、奖励、历史、撤销和存档恢复。');
