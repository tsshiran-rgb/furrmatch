/* Fish and paw are wildcard pieces; color-clearing yarn is colorless.
   Gravity/refill move board values and DOM icons together as before. */
const SPECIAL_ART = Object.freeze({
  row: 'assets/booster-concepts/goldfish-simple-v2.png',
  column: 'assets/booster-concepts/goldfish-simple-v2.png',
  area: 'assets/booster-concepts/rainbow-paw.png',
  color: 'assets/booster-concepts/yarn-stars-v3.png'
});
const PIECE_COLORS = ['#9d4be2', '#21bfe9', '#84bd32', '#b0aeb9', '#ff7aab'];
function pieceColor(piece) { return piece === null ? null : typeof piece === 'object' ? null : piece; }
function pieceKind(piece) { return piece && typeof piece === 'object' ? piece.kind : null; }
function safeRand(r, c, grid) {
  const blocked = new Set();
  const at = (rr, cc) => pieceColor(grid[rr]?.[cc] ?? null);
  if (c >= 2 && at(r,c-1) === at(r,c-2)) blocked.add(at(r,c-1));
  if (r >= 2 && at(r-1,c) === at(r-2,c)) blocked.add(at(r-1,c));
  if (at(r,c-1) !== null && at(r,c-1) === at(r,c+1)) blocked.add(at(r,c-1));
  if (at(r,c+1) !== null && at(r,c+1) === at(r,c+2)) blocked.add(at(r,c+1));
  if (at(r-1,c) !== null && at(r-1,c) === at(r+1,c)) blocked.add(at(r-1,c));
  if (at(r+1,c) !== null && at(r+1,c) === at(r+2,c)) blocked.add(at(r+1,c));
  let pool = Array.from({length:NUM_TYPES}, (_,i)=>i).filter(i=>!blocked.has(i));
  if(!pool.length) pool=Array.from({length:NUM_TYPES},(_,i)=>i);
  return pool[Math.floor(Math.random()*pool.length)];
}
function createIconEl(piece) {
  const icon = document.createElement('div');
  const kind = pieceKind(piece);
  icon.className = 'icon' + (kind ? ' special-piece special-' + kind : '');
  const img = document.createElement('img');
  img.src = kind ? SPECIAL_ART[kind] : ICONS[piece];
  img.alt = kind ? ({row:'דג זהב: מנקה שורה',column:'דג זהב: מנקה טור',area:'כפה: פיצוץ סביב',color:'צמר: מנקה סוג'})[kind] : '';
  img.draggable = false;
  icon.appendChild(img);
  return icon;
}
function isWildcard(piece) { return ['row','column','area'].includes(pieceKind(piece)); }
function matchRuns() {
  const runs=[];
  for(const horizontal of [true,false]) for(let line=0;line<SIZE;line++) for(let color=0;color<NUM_TYPES;color++) {
    let start=0;
    const at=pos=>board[horizontal?line:pos][horizontal?pos:line];
    const fits=piece=>isWildcard(piece)||pieceColor(piece)===color;
    while(start<SIZE) {
      if(!fits(at(start))){start++;continue;}
      let end=start,ordinary=0;
      while(end<SIZE&&fits(at(end))){if(!pieceKind(at(end)))ordinary++;end++;}
      // A wildcard plus two identical ordinary tiles makes a match.
      if(end-start>=3&&ordinary>=2) runs.push({color,kind:horizontal?'row':'column',cells:Array.from({length:end-start},(_,i)=>({r:horizontal?line:start+i,c:horizontal?start+i:line}))});
      start=end;
    }
  }
  return runs;
}
function findMatches() {
  const unique=new Map();
  matchRuns().forEach(run=>run.cells.forEach(p=>unique.set(p.r*SIZE+p.c,p)));
  return [...unique.values()];
}
function specialMatchPlan(preferred=[]) {
  const runs=matchRuns(), groups=[];
  const key=p=>p.r*SIZE+p.c;
  while(runs.length) {
    const group=[runs.shift()]; let added=true;
    while(added) {added=false;for(let i=runs.length-1;i>=0;i--) if(group.some(a=>a.cells.some(p=>runs[i].cells.some(q=>key(p)===key(q))))) {group.push(runs.splice(i,1)[0]);added=true;}}
    groups.push(group);
  }
  const creations=[];
  for(const group of groups) {
    const long=group.find(run=>run.cells.length>=5);
    const intersections=[];
    for(const a of group) for(const b of group) if(a.kind!==b.kind) a.cells.forEach(p=>{if(b.cells.some(q=>key(p)===key(q))) intersections.push(p);});
    const four=group.find(run=>run.cells.length>=4);
    const kind=long?'color':intersections.length?'area':four?four.kind:null;
    if(!kind) continue;
    const eligible=long?long.cells:intersections.length?intersections:four.cells;
    // Never overwrite an existing special that must activate in this match.
    const plain=eligible.filter(p=>!pieceKind(board[p.r][p.c]));
    const anchor=preferred.find(p=>plain.some(q=>key(p)===key(q))) || plain[Math.floor(plain.length/2)];
    if(anchor) creations.push({...anchor,piece:{kind,color:null}});
  }
  return {matches:findMatches(),creations};
}
function effectCells(r,c,targetColor=null) {
  const kind=pieceKind(board[r][c]),out=[{r,c}];
  for(let rr=0;rr<SIZE;rr++) for(let cc=0;cc<SIZE;cc++) {
    if(board[rr][cc]===null) continue;
    if(kind==='row'&&rr===r || kind==='column'&&cc===c || kind==='area'&&Math.abs(rr-r)<=1&&Math.abs(cc-c)<=1 || kind==='color'&&targetColor!==null&&pieceColor(board[rr][cc])===targetColor) out.push({r:rr,c:cc});
  }
  return out;
}
function expandSpecialEffects(initial,colorTargets=new Map()) {
  const hit=new Map(),queue=initial.slice(),activated=new Set();
  while(queue.length) {
    const p=queue.shift(),key=p.r*SIZE+p.c;
    if(board[p.r][p.c]===null)continue;
    hit.set(key,p);
    const kind=pieceKind(board[p.r][p.c]);
    if(!kind||activated.has(key))continue;
    activated.add(key);
    let target=colorTargets.get(key);
    if(kind==='color'&&target===undefined) {
      const counts=Array(NUM_TYPES).fill(0);
      board.flat().forEach(piece=>{const color=pieceColor(piece);if(color!==null)counts[color]++;});
      target=counts.indexOf(Math.max(...counts));
      colorTargets.set(key,target);
    }
    queue.push(...effectCells(p.r,p.c,target));
  }
  return {cells:[...hit.values()],activated};
}
async function clearSpecialWave(initial,creations=[],targets=new Map()) {
  const wave=expandSpecialEffects(initial,targets);
  // New pieces survive their own match unless an existing booster hits the anchor.
  const blastKeys=new Set();
  for(const key of wave.activated) {
    const r=Math.floor(key/SIZE),c=key%SIZE;
    const target=targets.get(key) ?? null;
    effectCells(r,c,target).forEach(p=>blastKeys.add(p.r*SIZE+p.c));
  }
  const protectedKeys=new Set(creations.filter(p=>!blastKeys.has(p.r*SIZE+p.c)).map(p=>p.r*SIZE+p.c));
  const removed=wave.cells.filter(p=>!protectedKeys.has(p.r*SIZE+p.c));
  const points=removed.length*10*Math.max(1,combo);
  score+=points;
  if(wave.activated.size || creations.length) sfxBooster(); else sfxPop(removed.length);
  if(combo>1) {sfxCombo(combo);comboEl.textContent='🔥 Combo x'+combo+'! +'+points;comboEl.classList.add('show');}
  showScorePop(points,removed);
  removed.forEach(p=>{const icon=tiles[p.r][p.c];if(icon){icon.style.transition='transform 160ms ease-out, opacity 160ms';icon.style.transform='scale(0) rotate(15deg)';icon.style.opacity='0';}});
  await sleep(170);
  removed.forEach(p=>{tiles[p.r][p.c]?.remove();tiles[p.r][p.c]=null;board[p.r][p.c]=null;});
  creations.forEach(p=>{if(!protectedKeys.has(p.r*SIZE+p.c))return;tiles[p.r][p.c]?.remove();board[p.r][p.c]=p.piece;const icon=createIconEl(p.piece);cells[p.r][p.c].appendChild(icon);tiles[p.r][p.c]=icon;});
  await dropTiles();await fillNewTiles();updateHUD();
}
async function resolveMatches(preferred=[]) {
  let plan=specialMatchPlan(preferred);
  while(plan.matches.length) {
    combo++;await clearSpecialWave(plan.matches,plan.creations);
    preferred=[];plan=specialMatchPlan();
  }
  setTimeout(()=>comboEl.classList.remove('show'),900);
}
async function trySwap(r1,c1,r2,c2) {
  if(busy||movesLeft<=0||Math.abs(r1-r2)+Math.abs(c1-c2)!==1)return;
  busy=true;
  try {
    const first=board[r1][c1],second=board[r2][c2],el1=tiles[r1][c1],el2=tiles[r2][c2];
    if(!el1||!el2)return;
    sfxSwap();slideTile(el1,r1,c1,r2,c2,130);slideTile(el2,r2,c2,r1,c1,130);await sleep(145);
    const swap=()=>{[board[r1][c1],board[r2][c2]]=[board[r2][c2],board[r1][c1]];[tiles[r1][c1],tiles[r2][c2]]=[tiles[r2][c2],tiles[r1][c1]];commitIconToCell(tiles[r1][c1],r1,c1);commitIconToCell(tiles[r2][c2],r2,c2);};
    swap();
    const colorSwap=pieceKind(first)==='color'||pieceKind(second)==='color';
    if(!colorSwap&&!findMatches().length) {
      slideTile(el2,r1,c1,r2,c2,130);slideTile(el1,r2,c2,r1,c1,130);await sleep(145);swap();return;
    }
    movesLeft--;combo=0;
    if(colorSwap) {
      const initial=[],targets=new Map();
      if(pieceKind(first)==='color'){initial.push({r:r2,c:c2});targets.set(r2*SIZE+c2,pieceColor(second));}
      if(pieceKind(second)==='color'){initial.push({r:r1,c:c1});targets.set(r1*SIZE+c1,pieceColor(first));}
      // Two colorless yarn pieces fire their ordinary effects, no combo power yet.
      for(const [key,color] of targets)if(color===null)targets.delete(key);
      combo=1;await clearSpecialWave(initial,[],targets);
    }
    await resolveMatches([{r:r2,c:c2},{r:r1,c:c1}]);updateHUD();
    const level=LEVELS[currentLevel];
    if(score>=level.target){await sleep(300);await endLevel(true);}else if(movesLeft<=0){await sleep(300);await endLevel(false);}
  } finally {busy=false;}
}
