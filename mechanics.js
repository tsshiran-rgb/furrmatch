/* Match-3 rules. Ordinary pieces are color indexes; specials are {kind, color}.
   Fish (row/column) and paw (area) keep the color of the match that made them and
   only fire when matched with that color or hit by another effect. Yarn is colorless
   and fires when swapped. Swapping two specials together fires a combo.
   Gravity/refill move board values and DOM icons together. */
const SPECIAL_ART = Object.freeze({
  row: 'assets/booster-concepts/goldfish-simple-v2.png',
  column: 'assets/booster-concepts/goldfish-simple-v2.png',
  area: 'assets/booster-concepts/rainbow-paw.png',
  color: 'assets/booster-concepts/yarn-stars-v3.png'
});
const PIECE_COLORS = ['#9d4be2', '#1f9bf0', '#3fb52a', '#e88a00', '#e8263f'];
const SCORE_PER_PIECE = 20;
const SPECIAL_BONUS = Object.freeze({ row: 120, column: 120, area: 200, color: 300 });
const HINT_DELAY_MS = 5000;

function pieceColor(piece) { return piece === null ? null : typeof piece === 'object' ? piece.color : piece; }
function pieceKind(piece) { return piece && typeof piece === 'object' ? piece.kind : null; }
function randomPiece() { return Math.floor(Math.random() * NUM_TYPES); }
function lineKind() { return Math.random() < 0.5 ? 'row' : 'column'; }
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
  if (kind && piece.color !== null) icon.style.setProperty('--piece-color', PIECE_COLORS[piece.color]);
  const img = document.createElement('img');
  img.src = kind ? SPECIAL_ART[kind] : ICONS[piece];
  img.alt = kind ? ({row:'דג זהב: מנקה שורה',column:'דג זהב: מנקה טור',area:'כפה: פיצוץ סביב',color:'צמר: מנקה סוג'})[kind] : '';
  img.draggable = false;
  icon.appendChild(img);
  return icon;
}
function setPiece(r, c, piece, animation) {
  tiles[r][c]?.remove();
  board[r][c] = piece;
  const icon = createIconEl(piece);
  if (animation) icon.classList.add(animation);
  cells[r][c].appendChild(icon);
  tiles[r][c] = icon;
  return icon;
}
function showBanner(text, ms=1100) {
  comboEl.textContent = text;
  comboEl.classList.add('show');
  clearTimeout(showBanner.timer);
  showBanner.timer = setTimeout(() => comboEl.classList.remove('show'), ms);
}

/* ── Matching ── */
function matchRuns() {
  const runs=[];
  for (const horizontal of [true,false]) for(let line=0;line<SIZE;line++) {
    let start=0;
    while(start<SIZE) {
      const r=horizontal?line:start,c=horizontal?start:line,color=pieceColor(board[r][c]);
      let end=start+1;
      if(color!==null) while(end<SIZE && pieceColor(board[horizontal?line:end][horizontal?end:line])===color) end++;
      if(color!==null && end-start>=3) runs.push({color,kind:horizontal?'row':'column',cells:Array.from({length:end-start},(_,i)=>({r:horizontal?line:start+i,c:horizontal?start+i:line}))});
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
    if(anchor) creations.push({...anchor,piece:{kind,color:kind==='color'?null:group[0].color}});
  }
  return {matches:findMatches(),creations};
}
/* Every adjacent swap that would do something, with a rough value for hints. */
function findValidMoves() {
  const moves=[];
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) for(const [dr,dc] of [[0,1],[1,0]]) {
    const r2=r+dr,c2=c+dc;
    if(r2>=SIZE||c2>=SIZE||board[r][c]===null||board[r2][c2]===null) continue;
    const ka=pieceKind(board[r][c]),kb=pieceKind(board[r2][c2]);
    if((ka&&kb)||ka==='color'||kb==='color') {moves.push({move:[r,c,r2,c2],value:20});continue;}
    [board[r][c],board[r2][c2]]=[board[r2][c2],board[r][c]];
    const value=findMatches().length;
    [board[r][c],board[r2][c2]]=[board[r2][c2],board[r][c]];
    if(value) moves.push({move:[r,c,r2,c2],value});
  }
  return moves;
}
function findValidMove() {
  const moves=findValidMoves();
  if(!moves.length) return null;
  const best=Math.max(...moves.map(m=>m.value));
  const top=moves.filter(m=>m.value===best);
  return top[Math.floor(Math.random()*top.length)].move;
}

/* ── Effects ── */
// kind may also be a combo-only shape: cross, bigcross, bigarea, all.
function effectCells(r,c,targetColor=null,kind=pieceKind(board[r][c])) {
  const out=[{r,c}];
  for(let rr=0;rr<SIZE;rr++) for(let cc=0;cc<SIZE;cc++) {
    if(board[rr][cc]===null||(rr===r&&cc===c)) continue;
    const dr=Math.abs(rr-r),dc=Math.abs(cc-c);
    const hit=kind==='row'?rr===r : kind==='column'?cc===c : kind==='area'?dr<=1&&dc<=1
      : kind==='color'?targetColor!==null&&pieceColor(board[rr][cc])===targetColor
      : kind==='cross'?rr===r||cc===c : kind==='bigcross'?dr<=1||dc<=1
      : kind==='bigarea'?dr<=2&&dc<=2 : kind==='all';
    if(hit) out.push({r:rr,c:cc});
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
/* Visual sweep for a firing special; purely cosmetic. */
function showBlastFX(r,c,kind,targetColor=null) {
  const host=document.getElementById('board-inner');
  const add=(cls,style)=>{const fx=document.createElement('div');fx.className='blast-fx '+cls;Object.assign(fx.style,style);host.appendChild(fx);setTimeout(()=>fx.remove(),600);};
  const pct=n=>(n*100/SIZE)+'%', cell=pct(1);
  const rowBeam=row=>add('beam-row',{top:pct(row),height:cell});
  const colBeam=col=>add('beam-col',{left:pct(col),width:cell});
  if(kind==='row') rowBeam(r);
  else if(kind==='column') colBeam(c);
  else if(kind==='cross') {rowBeam(r);colBeam(c);}
  else if(kind==='bigcross') for(let d=-1;d<=1;d++){if(r+d>=0&&r+d<SIZE)rowBeam(r+d);if(c+d>=0&&c+d<SIZE)colBeam(c+d);}
  else if(kind==='area'||kind==='bigarea') {const span=kind==='area'?3:5;add('burst',{left:pct(c-(span-1)/2),top:pct(r-(span-1)/2),width:pct(span),height:pct(span)});}
  else if(kind==='color'||kind==='all') {
    for(let rr=0;rr<SIZE;rr++) for(let cc=0;cc<SIZE;cc++) if(kind==='all'||pieceColor(board[rr][cc])===targetColor) add('zap',{left:pct(cc),top:pct(rr),width:cell,height:cell});
  }
}
async function clearSpecialWave(initial,creations=[],targets=new Map(),fx=[]) {
  const wave=expandSpecialEffects(initial,targets);
  // New pieces survive their own match unless an existing booster hits the anchor.
  const blastKeys=new Set();
  for(const key of wave.activated) {
    const r=Math.floor(key/SIZE),c=key%SIZE,kind=pieceKind(board[r][c]);
    const target=targets.get(key) ?? null;
    fx.push({r,c,kind,target});
    effectCells(r,c,target).forEach(p=>blastKeys.add(p.r*SIZE+p.c));
  }
  fx.forEach(f=>showBlastFX(f.r,f.c,f.kind,f.target));
  const protectedKeys=new Set(creations.filter(p=>!blastKeys.has(p.r*SIZE+p.c)).map(p=>p.r*SIZE+p.c));
  const removed=wave.cells.filter(p=>!protectedKeys.has(p.r*SIZE+p.c));
  const born=creations.filter(p=>protectedKeys.has(p.r*SIZE+p.c));
  const points=removed.length*SCORE_PER_PIECE*Math.max(1,combo)+born.reduce((sum,p)=>sum+SPECIAL_BONUS[p.piece.kind],0);
  score+=points;
  if(fx.length || born.length) sfxBooster(); else sfxPop(removed.length);
  if(combo>1) {sfxCombo(combo);showBanner('🔥 Combo x'+combo+'! +'+points,900);}
  showScorePop(points,removed.length?removed:born);
  removed.forEach(p=>{const icon=tiles[p.r][p.c];if(icon){icon.style.transition='none';icon.classList.add('popping');}});
  await sleep(fx.length?300:240);
  removed.forEach(p=>{tiles[p.r][p.c]?.remove();tiles[p.r][p.c]=null;board[p.r][p.c]=null;});
  born.forEach(p=>setPiece(p.r,p.c,p.piece,'special-born'));
  if(born.length) await sleep(200);
  await dropTiles();await fillNewTiles();updateHUD();
}
async function resolveMatches(preferred=[]) {
  let plan=specialMatchPlan(preferred);
  while(plan.matches.length) {
    combo++;await clearSpecialWave(plan.matches,plan.creations);
    preferred=[];plan=specialMatchPlan();
  }
}

/* ── Special + special swaps ── */
// The two swapped specials are spent by the combo itself, so they are turned into
// plain pieces before the blast (other specials it hits still chain normally).
function spendSpecial(p) { board[p.r][p.c] = pieceColor(board[p.r][p.c]) ?? 0; }
async function fireSpecialCombo(landed, other) {
  const a=board[landed.r][landed.c], b=board[other.r][other.c];
  const ka=pieceKind(a), kb=pieceKind(b);
  combo=1;
  if(ka==='color'&&kb==='color') {
    showBanner('🧶 Yarn storm!');
    spendSpecial(landed);spendSpecial(other);
    await clearSpecialWave(effectCells(landed.r,landed.c,null,'all'),[],new Map(),[{...landed,kind:'all'}]);
    return;
  }
  if(ka==='color'||kb==='color') {
    // Yarn + fish/paw: every piece of the partner's color becomes that special, then all fire.
    const yarn=ka==='color'?landed:other, partner=ka==='color'?other:landed, partnerPiece=ka==='color'?b:a;
    const color=partnerPiece.color, kind=pieceKind(partnerPiece);
    showBanner(kind==='area'?'🐾 Paw party!':'🐟 Fish frenzy!');
    const converted=[];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(board[r][c]===color) {
      setPiece(r,c,{kind:kind==='area'?'area':lineKind(),color},'special-born');converted.push({r,c});
    }
    sfxBooster();await sleep(500);
    spendSpecial(yarn);
    await clearSpecialWave([yarn,partner,...converted]);
    return;
  }
  const lines=[ka,kb].filter(k=>k==='row'||k==='column').length;
  const shape=lines===2?'cross':lines===1?'bigcross':'bigarea';
  showBanner(shape==='bigarea'?'💥 Mega paw!':'✨ Super fish!');
  spendSpecial(landed);spendSpecial(other);
  await clearSpecialWave(effectCells(landed.r,landed.c,null,shape),[],new Map(),[{...landed,kind:shape}]);
}

/* ── Hint & shuffle ── */
let hintTimer=null, hintEls=[];
function clearHint() {
  clearTimeout(hintTimer);
  hintEls.forEach(el=>el.classList.remove('hint'));
  hintEls=[];
}
function scheduleHint() {
  clearHint();
  hintTimer=setTimeout(function() {
    if(document.body.dataset.screen!=='game'||movesLeft<=0) return;
    if(busy) return scheduleHint();
    const move=findValidMove();
    if(!move) return;
    hintEls=[tiles[move[0]][move[1]],tiles[move[2]][move[3]]].filter(Boolean);
    hintEls.forEach(el=>el.classList.add('hint'));
  },HINT_DELAY_MS);
}
boardEl.addEventListener('pointerdown',scheduleHint);
function rebuildIcons(animation) {
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) setPiece(r,c,board[r][c],animation);
}
/* Guarantees the board has no standing matches and at least one move. */
function makePlayable(pieces) {
  for(let attempt=0;attempt<200;attempt++) {
    for(let i=pieces.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pieces[i],pieces[j]]=[pieces[j],pieces[i]];}
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) board[r][c]=pieces[r*SIZE+c];
    if(!findMatches().length&&findValidMoves().length) return;
  }
  // Rare fallback: keep specials, redraw ordinary pieces.
  do {
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(!pieceKind(board[r][c])) board[r][c]=null;
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(board[r][c]===null) board[r][c]=safeRand(r,c,board);
  } while(findMatches().length||!findValidMoves().length);
}
async function shuffleBoard() {
  showBanner('🔀 מערבבים!');
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) tiles[r][c]?.classList.add('popping');
  await sleep(450);
  makePlayable(board.flat());
  rebuildIcons('special-born');
  await sleep(350);
}

/* ── Level end ── */
async function fireAllSpecials() {
  for(let guard=0;guard<30;guard++) {
    const specials=[];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(pieceKind(board[r][c])) specials.push({r,c});
    if(!specials.length) return;
    combo=1;await clearSpecialWave(specials);await resolveMatches();
  }
}
// Target reached: remaining specials fire, then each leftover move becomes a fish.
async function furrFrenzy() {
  showBanner('🐾 Furr Frenzy!',1400);
  await sleep(800);
  await fireAllSpecials();
  while(movesLeft>0) {
    const plain=[];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(board[r][c]!==null&&!pieceKind(board[r][c])) plain.push({r,c});
    for(let i=plain.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[plain[i],plain[j]]=[plain[j],plain[i]];}
    const batch=plain.slice(0,Math.min(movesLeft,8));
    if(!batch.length) break;
    for(const p of batch) {
      setPiece(p.r,p.c,{kind:lineKind(),color:board[p.r][p.c]},'special-born');
      movesLeft--;updateHUD();sfxSwap();await sleep(110);
    }
    await sleep(250);
    await fireAllSpecials();
  }
}
async function finishTurn() {
  const level=LEVELS[currentLevel];
  if(score>=level.target){await furrFrenzy();await sleep(400);await endLevel(true);return;}
  if(movesLeft<=0){await sleep(300);await endLevel(false);return;}
  if(!findValidMoves().length) await shuffleBoard();
}

async function trySwap(r1,c1,r2,c2) {
  if(busy||movesLeft<=0||Math.abs(r1-r2)+Math.abs(c1-c2)!==1)return;
  busy=true;clearHint();
  try {
    const first=board[r1][c1],second=board[r2][c2],el1=tiles[r1][c1],el2=tiles[r2][c2];
    if(!el1||!el2)return;
    sfxSwap();slideTile(el1,r1,c1,r2,c2,170);slideTile(el2,r2,c2,r1,c1,170);await sleep(185);
    const swap=()=>{[board[r1][c1],board[r2][c2]]=[board[r2][c2],board[r1][c1]];[tiles[r1][c1],tiles[r2][c2]]=[tiles[r2][c2],tiles[r1][c1]];commitIconToCell(tiles[r1][c1],r1,c1);commitIconToCell(tiles[r2][c2],r2,c2);};
    swap();
    const k1=pieceKind(first),k2=pieceKind(second);
    const specialPair=Boolean(k1&&k2),colorSwap=k1==='color'||k2==='color';
    if(!specialPair&&!colorSwap&&!findMatches().length) {
      slideTile(el2,r1,c1,r2,c2,170);slideTile(el1,r2,c2,r1,c1,170);await sleep(185);swap();return;
    }
    movesLeft--;combo=0;updateHUD();
    if(specialPair) await fireSpecialCombo({r:r2,c:c2},{r:r1,c:c1});
    else if(colorSwap) {
      const initial=[],targets=new Map();
      if(k1==='color'){initial.push({r:r2,c:c2});targets.set(r2*SIZE+c2,pieceColor(second));}
      if(k2==='color'){initial.push({r:r1,c:c1});targets.set(r1*SIZE+c1,pieceColor(first));}
      combo=1;await clearSpecialWave(initial,[],targets);
    }
    await resolveMatches([{r:r2,c:c2},{r:r1,c:c1}]);updateHUD();
    await finishTurn();
  } finally {busy=false;scheduleHint();}
}
