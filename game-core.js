'use strict';
const canvas=document.getElementById('battle'),ctx=canvas.getContext('2d',{alpha:false});
const W=1672,H=941,CELL=96,GROUND=[650,708,766],LEFT_BASE_X=246,RIGHT_BASE_X=1426;
ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const UI={leftHpBar:$('#leftHpBar'),rightHpBar:$('#rightHpBar'),leftHpText:$('#leftHpText'),rightHpText:$('#rightHpText'),mana:$('#manaText'),gold:$('#goldText'),kills:$('#killsText'),combo:$('#comboText'),wave:$('#waveText'),status:$('#statusText'),army:$('#armyText'),next:$('#nextWaveText'),hero:$('#heroState'),order:$('#orderText'),log:$('#battleLog'),frontBlue:$('#frontBlue'),frontRed:$('#frontRed'),frontMarker:$('#frontMarker'),banner:$('#waveBanner'),toast:$('#toast'),end:$('#endOverlay'),endTitle:$('#endTitle'),endText:$('#endText')};
const IMG={};
const load=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Failed '+src));i.src=src;});

const DEF={
 sword:{name:'Swordsman',sheet:'raven_sword',team:'player',cost:55,hp:270,dmg:29,speed:72,range:58,rate:.88,w:150,h:150,kind:'melee',cool:1.0},
 spear:{name:'Spearman',sheet:'raven_spear',team:'player',cost:70,hp:270,dmg:36,speed:66,range:54,rate:.96,w:164,h:164,kind:'spear',cool:1.05},
 archer:{name:'Archer',sheet:'raven_archer',team:'player',cost:85,hp:150,dmg:30,speed:60,range:410,rate:1.18,w:158,h:158,kind:'ranged',cool:1.28},
 cavalry:{name:'Cavalry',sheet:'raven_cavalry',team:'player',cost:125,hp:390,dmg:44,speed:112,range:68,rate:.96,w:222,h:180,kind:'cavalry',cool:1.9},
 arthos:{name:'Arthos',sheet:'raven_sword',team:'player',cost:140,hp:760,dmg:59,speed:80,range:64,rate:.72,w:192,h:192,kind:'hero',cool:0},
 legion:{name:'Legionary',sheet:'obs_legion',team:'enemy',hp:245,dmg:27,speed:68,range:58,rate:.94,w:150,h:150,kind:'melee'},
 halberd:{name:'Halberdier',sheet:'obs_halberd',team:'enemy',hp:280,dmg:36,speed:62,range:56,rate:1.0,w:166,h:166,kind:'spear'},
 enemyArcher:{name:'Obsidian Archer',sheet:'obs_archer',team:'enemy',hp:145,dmg:28,speed:58,range:395,rate:1.22,w:158,h:158,kind:'ranged'},
 dreadCav:{name:'Dread Cavalry',sheet:'obs_cavalry',team:'enemy',hp:400,dmg:45,speed:108,range:70,rate:.97,w:224,h:182,kind:'cavalry'},
 boss:{name:'Obsidian Warmaster',sheet:'obs_cavalry',team:'enemy',hp:1350,dmg:72,speed:94,range:82,rate:.78,w:292,h:238,kind:'boss'}
};

const OFF={sword:[0,0],spear:[384,0],archer:[0,288],cavalry:[384,288],arthos:[0,0],legion:[0,0],halberd:[384,0],enemyArcher:[0,288],dreadCav:[384,288],boss:[384,288]};
const WAVES=[
 ['legion','legion','halberd'],
 ['legion','enemyArcher','legion','halberd'],
 ['halberd','enemyArcher','legion','dreadCav','legion'],
 ['dreadCav','enemyArcher','halberd','legion','enemyArcher','legion'],
 ['dreadCav','dreadCav','halberd','enemyArcher','legion','halberd'],
 ['boss','dreadCav','enemyArcher','halberd','legion','enemyArcher']
];
const st={units:[],projectiles:[],particles:[],numbers:[],meteors:[],embers:[],smoke:[],groundFx:[],mana:300,maxMana:500,gold:0,kills:0,combo:0,comboT:0,wave:0,queue:[],spawnT:1.2,nextWaveT:0,leftHp:5000,rightHp:5000,maxHp:5000,time:0,speed:1,paused:false,order:'assault',shake:0,heroCd:0,meteorCd:0,rallyCd:0,healCd:0,rallyT:0,healGlow:0,finished:false,cool:{sword:0,spear:0,archer:0,cavalry:0},logs:[],waveBannerT:0,spawnedBoss:false};

function log(t){st.logs.unshift(t);st.logs=st.logs.slice(0,6);UI.log.innerHTML=st.logs.map(x=>`<div>• ${x}</div>`).join('');}
function toast(t){UI.toast.textContent=t;UI.toast.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>UI.toast.classList.remove('show'),1200)}
function banner(t){UI.banner.textContent=t;UI.banner.classList.add('show');clearTimeout(banner.t);banner.t=setTimeout(()=>UI.banner.classList.remove('show'),1300)}
function laneY(i){return GROUND[i]}
function makeUnit(key,team,x,lane){const d=DEF[key];return{id:Math.random().toString(36).slice(2),key,team:team||d.team,x,y:laneY(lane),lane,hp:d.hp,maxHp:d.hp,attackT:Math.random()*.3,anim:Math.random()*3,state:'walk',dead:false,deathT:0,hitT:0,recoil:0,chargeT:0,charging:false,shotReady:true,buffT:0,spawnT:.18,dir:(team||d.team)==='player'?1:-1};}
function alive(team){return st.units.filter(u=>u.team===team&&!u.dead)}
function spawnPlayer(key,free=false,lane=Math.floor(Math.random()*3)){if(st.finished||st.paused)return;const d=DEF[key];if(!free&&st.mana<d.cost)return toast('Not enough mana');if(st.cool[key]>0)return toast(`${d.name} is regrouping`);if(!free)st.mana-=d.cost;st.cool[key]=d.cool||0;st.units.push(makeUnit(key,'player',LEFT_BASE_X+24+Math.random()*22,lane));log(`${d.name} deployed.`)}
function spawnEnemy(key){const lane=Math.floor(Math.random()*3);st.units.push(makeUnit(key,'enemy',RIGHT_BASE_X-24-Math.random()*22,lane));}
function setWave(i){st.wave=i;st.queue=[...WAVES[i]];st.spawnT=.8;st.nextWaveT=0;banner(i===5?'FINAL WAVE · WARMASTER':'WAVE '+(i+1));log(`Obsidian wave ${i+1} advances.`)}

function nearest(u){let best=null,bd=1e9;for(const v of st.units){if(v.dead||v.team===u.team||v.lane!==u.lane)continue;const d=Math.abs(v.x-u.x);if(d<bd){bd=d;best=v}}return[best,bd]}
function spacing(u){let push=0;for(const v of st.units){if(v===u||v.dead||v.team!==u.team||v.lane!==u.lane)continue;const dx=u.x-v.x;if(Math.abs(dx)<52){const want=52-Math.abs(dx);push+=Math.sign(dx||1)*want*.9}}return push}
function damage(att,target,amount,crit=false){if(target.dead)return;let mult=1;if(att&&DEF[att.key]?.kind==='spear'&&['cavalry','boss'].includes(DEF[target.key]?.kind))mult=1.7;amount=Math.round(amount*mult*(att?.buffT>0?1.22:1));target.hp-=amount;target.hitT=.14;target.recoil=(att?.team==='player'?1:-1)*(crit?14:8);st.numbers.push({x:target.x,y:target.y-115,t:0,life:.75,text:String(amount),crit:crit||mult>1,color:att?.team==='player'?'#d9f0ff':'#ffd7d7'});burst(target.x,target.y-84,crit?18:10,att?.team==='player'?'#8bcfff':'#ff7f79');if(target.hp<=0){target.dead=true;target.deathT=1.35;target.state='dead';st.groundFx.push({x:target.x,y:target.y+3,life:10,size:18+Math.random()*18,team:target.team});if(att?.team==='player'){st.kills++;st.gold+=DEF[target.key]?.kind==='boss'?150:10;st.combo++;st.comboT=4;if(st.combo%5===0)toast(`${st.combo} KILL COMBO`)}if(DEF[target.key]?.kind==='boss')log('The Obsidian Warmaster has fallen!')}}
function burst(x,y,n,color){for(let i=0;i<n;i++)st.particles.push({x,y,vx:(Math.random()*2-1)*120,vy:-40-Math.random()*160,life:.32+Math.random()*.35,size:1.5+Math.random()*3.5,color})}
function launchArrow(u,t){const dir=u.team==='player'?1:-1;st.projectiles.push({x:u.x+dir*38,y:u.y-95,sx:u.x+dir*38,sy:u.y-95,tx:t.x,ty:t.y-92,target:t.id,team:u.team,dmg:DEF[u.key].dmg,t:0,speed:480+Math.random()*50,type:'arrow'});}
function meleeAttack(u,t){const d=DEF[u.key];const crit=['cavalry','hero','boss'].includes(d.kind)||(d.kind==='spear'&&['cavalry','boss'].includes(DEF[t.key].kind));let dmg=d.dmg;if(d.kind==='cavalry'&&u.chargeT>1.1){dmg*=1.65;u.chargeT=0;st.shake=Math.max(st.shake,5)}if(d.kind==='hero'&&Math.random()<.22){dmg*=1.45;st.shake=Math.max(st.shake,4)}damage(u,t,dmg,crit)}
