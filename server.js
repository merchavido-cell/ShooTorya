// ShooTorya server: node server.js  (PORT, ROOM_SIZE, WAIT_SECONDS are optional env vars)
const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000,SIZE=+process.env.ROOM_SIZE||8,WAIT=+process.env.WAIT_SECONDS||20;
const W=2400,H=2400,R=20,SPEED=235,WORLDS=['desert','forest','ice','field','mountain'];
const NAMES=['דני','נועה','רון','מאיה','איתי','שירה','עומר','ליאור','תומר','יעל','גיל','הדס','אורי','טל','אבי'];
const COLS=['#ff5a5a','#ffb02e','#5ad1ff','#a96bff','#ff6bd6','#6bffb0','#ffe45a','#ff8a5a','#5a8aff','#b0ff5a','#ff5a9a','#5affef','#d0a0ff','#ffa0a0','#a0ffd0'];
const rooms=new Set();let waiting=null;
const cl=(v,a,b)=>Math.max(a,Math.min(b,v)),r1=v=>Math.round(v*10)/10,rn=(a,b)=>a+Math.random()*(b-a);
const pts=e=>e.cap.length+e.ch,snd=(ws,s)=>{if(ws&&ws.readyState===1)ws.send(s)};

class Room{
 constructor(){this.pl=[];this.state='wait';this.left=WAIT;this.sT=0;this.ev=[];this.bombs=[];this.bul=[];this.ents=[];this.world=WORLDS[Math.floor(Math.random()*5)]}
 sendWait(){const m=JSON.stringify({t:'wait',n:this.pl.length,max:SIZE,left:Math.ceil(this.left)});this.pl.forEach(p=>snd(p.ws,m))}
 leave(ws){
  if(this.state==='wait'){this.pl=this.pl.filter(p=>p.ws!==ws);if(!this.pl.length){rooms.delete(this);if(waiting===this)waiting=null}else this.sendWait()}
  else{const e=ws.ent;if(e){e.bot=true;e.ws=null;e.name+=' 🤖'}if(this.ents.every(x=>x.bot))rooms.delete(this)}
  ws.room=null;ws.ent=null}
 start(){
  this.state='run';if(waiting===this)waiting=null;
  const n=SIZE,used=new Set(),pos=[...Array(n).keys()].sort(()=>Math.random()-.5);
  const names=this.pl.map(p=>{let nm=p.name,k=2;while(used.has(nm))nm=p.name+' '+k++;used.add(nm);return nm});
  let botN=0;
  for(let i=0;i<n;i++){const h=this.pl[i],a=pos[i]*Math.PI*2/n;
   const e={id:i,name:h?names[i]:'בוט'+(++botN),col:COLS[i],x:W/2+Math.cos(a)*900,y:H/2+Math.sin(a)*900,hp:1000,ds:0,cap:[],ch:0,alive:true,cool:0,aim:a+Math.PI,bot:!h,ws:h?h.ws:null,in:{dx:0,dy:0,aim:a+Math.PI,fire:false},bcd:0,t:0,sd:1};
   if(h)h.ws.ent=e;this.ents.push(e)}
  this.obs=[];this.chests=[];this.decor=[];
  while(this.obs.length<48){const o={x:rn(80,W-80),y:rn(80,H-80),r:rn(28,76)};if(this.ents.some(e=>Math.hypot(e.x-o.x,e.y-o.y)<o.r+90))continue;this.obs.push(o)}
  while(this.chests.length<n*2){const c={x:rn(80,W-80),y:rn(80,H-80),taken:false};if(this.obs.some(o=>Math.hypot(o.x-c.x,o.y-c.y)<o.r+40))continue;this.chests.push(c)}
  for(let i=0;i<260;i++)this.decor.push([Math.round(rn(0,W)),Math.round(rn(0,H)),Math.round(rn(6,28))]);
  const init={t:'init',world:this.world,obs:this.obs.map(o=>[Math.round(o.x),Math.round(o.y),Math.round(o.r)]),decor:this.decor,ents:this.ents.map(e=>({id:e.id,name:e.name,col:e.col}))};
  this.pl.forEach(p=>snd(p.ws,JSON.stringify({...init,id:p.ws.ent.id})));
  this.ph='ready';this.pt=0;this.time=240}
 m(txt,kind){this.ev.push(['m',txt,kind])}
 los(a,b){const d=Math.hypot(b.x-a.x,b.y-a.y),n=Math.ceil(d/30);for(let i=1;i<n;i++){const x=a.x+(b.x-a.x)*i/n,y=a.y+(b.y-a.y)*i/n;for(const o of this.obs)if(Math.hypot(o.x-x,o.y-y)<o.r)return false}return true}
 move(e,dx,dy,sp,dt){e.x+=dx*sp*dt;e.y+=dy*sp*dt;for(const o of this.obs){const d=Math.hypot(e.x-o.x,e.y-o.y),m=o.r+R;if(d<m&&d>0){e.x=o.x+(e.x-o.x)/d*m;e.y=o.y+(e.y-o.y)/d*m}}e.x=cl(e.x,R,W-R);e.y=cl(e.y,R,H-R)}
 fire(e,ang,dmg){this.ev.push(['s',Math.round(e.x),Math.round(e.y),Math.round(ang*100)/100,e.id]);this.bul.push({x:e.x+Math.cos(ang)*26,y:e.y+Math.sin(ang)*26,vx:Math.cos(ang)*760,vy:Math.sin(ang)*760,o:e,l:.9,d:dmg})}
 hit(t,dmg,by){
  this.ev.push(['n',Math.round(t.x),Math.round(t.y-30),dmg,t.ds>0?1:0]);
  if(t.ds>0){t.ds-=dmg;if(t.ds<=0){t.ds=0;if(pts(t)>0){const n=t.cap.length;
    t.cap.forEach((c,i)=>{c.alive=true;c.by=null;c.hp=1000;c.ds=0;const a=i*6.28/n;c.x=cl(t.x+Math.cos(a)*90,60,W-60);c.y=cl(t.y+Math.sin(a)*90,60,H-60)});
    for(let i=0;i<t.ch;i++)this.chests.push({x:cl(t.x+rn(-100,100),60,W-60),y:cl(t.y+rn(-100,100),60,H-60),taken:false});
    t.cap=[];t.ch=0;this.m('💥 ה-DS של '+t.name+' נשבר! '+(n?n+' שבויים שוחררו, ':'')+'הוא איבד את כל הנקודות','b')}}return}
  t.hp-=dmg;
  if(t.hp<=0){t.hp=0;t.alive=false;t.by=by;by.cap.push(t);by.ds+=200;this.bombs=this.bombs.filter(b=>b.o!==t);this.m('⛓️ '+by.name+' תפס את '+t.name,'k');
   if(this.ents.filter(e=>e.alive).length<=1&&this.ph==='play')this.finish(true)}}
 ai(b,dt){
  b.t-=dt;
  if(b.t<=0){b.t=.35+Math.random()*.4;let best=null,bd=1e9;for(const e of this.ents)if(e!==b&&e.alive){const d=Math.hypot(e.x-b.x,e.y-b.y)*(pts(e)>2&&e.ds<300?.7:1);if(d<bd){bd=d;best=e}}b.tg=best;b.td=best?Math.hypot(best.x-b.x,best.y-b.y):1e9;
   let bc=null,cd=1e9;for(const c of this.chests)if(!c.taken){const d=Math.hypot(c.x-b.x,c.y-b.y);if(d<cd){cd=d;bc=c}}b.cs=bc;b.cd=cd;if(b.sw===undefined||--b.sw<=0){b.sd=Math.random()<.5?1:-1;b.sw=4+Math.floor(Math.random()*5)}}
  const t=b.tg;let mx=0,my=0;
  if(b.cs&&(!t||b.td>430||b.cd<260)){const d=Math.hypot(b.cs.x-b.x,b.cs.y-b.y)||1;mx=(b.cs.x-b.x)/d;my=(b.cs.y-b.y)/d}
  else if(t){const dx=t.x-b.x,dy=t.y-b.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;let k=d>340?1:d<210?-1:0;if(b.hp<250&&b.ds<=0)k=-1;mx=ux*k-uy*b.sd;my=uy*k+ux*b.sd}
  if(b.x<160)mx+=1;else if(b.x>W-160)mx-=1;if(b.y<160)my+=1;else if(b.y>H-160)my-=1;
  let l=Math.hypot(mx,my);if(l<.2){if(b.wa===undefined||Math.random()<.02)b.wa=Math.random()*6.28;mx=Math.cos(b.wa);my=Math.sin(b.wa);l=1}
  mx/=l;my/=l;const px=b.x,py=b.y;this.move(b,mx,my,SPEED,dt);if(Math.hypot(b.x-px,b.y-py)<SPEED*dt*.3){b.sd=-b.sd;b.wa=Math.random()*6.28}
  b.cool-=dt;
  if(t&&t.alive){const ta=Math.atan2(t.y-b.y,t.x-b.x);let df=ta-b.aim;df=Math.atan2(Math.sin(df),Math.cos(df));b.aim+=cl(df,-5*dt,5*dt);
   if(b.td<580&&Math.abs(df)<.18&&b.cool<=0&&this.los(b,t)){b.cool=.3+Math.random()*.15;this.fire(b,b.aim+(Math.random()-.5)*.26,50)}}}
 bomb(e,x,y){
  if(this.ph!=='play'||!e.alive||e.bcd>0||!isFinite(x)||!isFinite(y))return;
  this.bombs.push({x:cl(x,0,W),y:cl(y,0,H),timer:3,o:e});e.bcd=30;this.m('💣 '+e.name+' הטיל פצצה! ברחו!','b')}
 boomAt(B){
  for(const e of this.ents){if(!e.alive||e===B.o)continue;const d=Math.hypot(e.x-B.x,e.y-B.y);if(d<=900)this.hit(e,Math.max(50,400-Math.floor(d/200)*50),B.o)}
  this.ev.push(['x',Math.round(B.x),Math.round(B.y)])}
 sim(dt){
  const E=this.ents;
  for(const B of this.bombs)B.timer-=dt;
  const due=this.bombs.filter(b=>b.timer<=0);this.bombs=this.bombs.filter(b=>b.timer>0);
  for(const B of due)if(B.o.alive)this.boomAt(B);
  for(const e of E){e.bcd=Math.max(0,e.bcd-dt);if(!e.alive)continue;
   if(!e.bot){const i=e.in;this.move(e,i.dx,i.dy,i.dx||i.dy?SPEED:0,dt);e.aim=i.aim;e.cool-=dt;if(i.fire&&e.cool<=0){e.cool=.13;this.fire(e,e.aim+(Math.random()-.5)*.05,50)}}
   else this.ai(e,dt);
   for(const c of this.chests)if(!c.taken&&Math.hypot(c.x-e.x,c.y-e.y)<46){c.taken=true;e.ch++;e.ds+=200;this.m('💰 '+e.name+' מצא תיבת אוצר','c')}}
  for(let i=this.bul.length-1;i>=0;i--){const b=this.bul[i];if(!b)break;b.x+=b.vx*dt;b.y+=b.vy*dt;b.l-=dt;let dead=b.l<=0||!b.o.alive;
   if(!dead)for(const o of this.obs)if(Math.hypot(o.x-b.x,o.y-b.y)<o.r){dead=true;break}
   if(!dead)for(const e of E)if(e.alive&&e!==b.o&&Math.hypot(e.x-b.x,e.y-b.y)<R+3){this.hit(e,b.d,b.o);dead=true;break}
   if(dead)this.bul.splice(i,1)}}
 finish(full){
  if(this.ph==='over')return;this.ph='over';this.pt=0;this.full=full;this.bul.length=0;this.bombs=[];
  const L=[...this.ents].sort((a,b)=>pts(b)-pts(a)||b.hp-a.hp);this.win=(full&&this.ents.find(e=>e.alive))||L[0]}
 snap(){
  const base={t:'s',ph:this.ph,pt:r1(this.pt),tm:r1(this.time),
   e:this.ents.map(e=>[r1(e.x),r1(e.y),Math.round(e.aim*100)/100,Math.round(e.hp),Math.round(e.ds),e.alive?1:0,e.cap.length,e.ch,e.by&&!e.alive?e.by.id:-1]),
   b:this.bul.map(b=>[Math.round(b.x),Math.round(b.y),Math.round(b.vx),Math.round(b.vy),b.o.id]),
   ch:this.chests.filter(c=>!c.taken).map(c=>[Math.round(c.x),Math.round(c.y)]),
   bm:this.bombs.map(b=>[Math.round(b.x),Math.round(b.y),r1(b.timer)]),ev:this.ev};
  if(this.ph==='over'){base.w=this.win.id;base.f=this.full}
  for(const e of this.ents)if(e.ws)snd(e.ws,JSON.stringify({...base,cd:r1(e.bcd)}));
  this.ev=[]}
 close(){const w=this.win;for(const e of this.ents)if(e.ws){snd(e.ws,JSON.stringify({t:'end',wid:w.id,wn:w.name,wp:pts(w)}));e.ws.room=null;e.ws.ent=null}rooms.delete(this)}
 update(dt){
  if(this.state==='wait'){this.left-=dt;this.sT-=dt;if(this.sT<=0){this.sT=1;this.sendWait()}if(this.left<=0)this.start();return}
  this.pt+=dt;const p=this.ph;
  if(p==='ready'&&this.pt>=5){this.ph='set';this.pt=0}
  else if(p==='set'&&this.pt>=2){this.ph='play';this.pt=0}
  else if(p==='play'){this.sim(dt);this.time-=dt;if(this.time<=0){this.time=0;this.finish(false)}}
  else if(p==='over'&&this.pt>7){this.close();return}
  this.snap()}
}

const srv=http.createServer((q,r)=>{
 if(q.url==='/health'){r.end('ok');return}
 fs.readFile(path.join(__dirname,'public','index.html'),(e,d)=>{if(e){r.writeHead(500);r.end('error');return}r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(d)})});
const wss=new WebSocketServer({server:srv,maxPayload:2048});
wss.on('connection',ws=>{
 ws.on('message',raw=>{let d;try{d=JSON.parse(raw)}catch{return}
  if(d.t==='join'&&!ws.room){
   const name=String(d.name||'').replace(/[<>&"'`\\]/g,'').trim().slice(0,14)||'שחקן';
   if(!waiting){waiting=new Room();rooms.add(waiting)}
   ws.room=waiting;waiting.pl.push({ws,name});waiting.sendWait();
   if(waiting.pl.length>=SIZE)waiting.start()}
  else if(d.t==='leave'&&ws.room&&ws.room.state==='wait')ws.room.leave(ws);
  else if(d.t==='in'&&ws.ent){const i=ws.ent.in;i.dx=cl(+d.dx||0,-1,1);i.dy=cl(+d.dy||0,-1,1);if(isFinite(d.aim))i.aim=+d.aim;i.fire=!!d.fire}
  else if(d.t==='bomb'&&ws.ent&&ws.room)ws.room.bomb(ws.ent,+d.x,+d.y)});
 ws.on('close',()=>{if(ws.room)ws.room.leave(ws)});
 ws.on('error',()=>{})});
let last=Date.now();
setInterval(()=>{const now=Date.now(),dt=Math.min(.05,(now-last)/1000);last=now;for(const r of [...rooms])r.update(dt)},33);
srv.listen(PORT,()=>console.log('ShooTorya server on :'+PORT));
