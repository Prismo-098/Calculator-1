(function(){
  var valEl=document.getElementById('val'), histEl=document.getElementById('hist'), lcd=document.getElementById('lcd');
  var muteBtn=document.getElementById('mute'), pad=document.getElementById('pad');
  var cur='0', prev=null, op=null, fresh=true, muted=false, ctx=null, lastExpr='';

  /* ---------- sound ---------- */
  function audio(){
    if(!ctx){try{ctx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}
    if(ctx&&ctx.state==='suspended')ctx.resume();
    return ctx;
  }
  function tone(f,d,type,vol,to,delay){
    if(muted)return; var c=audio(); if(!c)return;
    var t=c.currentTime+(delay||0), o=c.createOscillator(), g=c.createGain();
    o.type=type||'sine'; o.frequency.setValueAtTime(f,t);
    if(to)o.frequency.exponentialRampToValueAtTime(to,t+d);
    g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol||0.15,t+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t+d+0.02);
  }
  var scale=[130.8,146.8,155.6,196,207.7,261.6,293.7,311.1,392,415.3];
  var sfx={
    digit:function(n){tone(scale[n]*2,0.16,'sawtooth',0.07);tone(scale[n],0.2,'sine',0.14)},
    dot:function(){tone(700,0.05,'square',0.05)},
    op:function(){tone(180,0.09,'square',0.08,120);tone(540,0.05,'triangle',0.08)},
    fn:function(){tone(420,0.08,'sine',0.12,300)},
    clear:function(){tone(700,0.28,'sawtooth',0.07,120)},
    eq:function(){tone(55,0.7,'sine',0.35,30);tone(2000,0.08,'square',0.08,200);[110,164.8,220,329.6,440].forEach(function(f,i){tone(f,0.22,'triangle',0.13,null,i*0.06)})},
    err:function(){tone(110,0.35,'sawtooth',0.14,70);tone(117,0.35,'square',0.06,75)}
  };

  /* ---------- helpers ---------- */
  function haptic(ms){if(navigator.vibrate)try{navigator.vibrate(ms)}catch(e){}}
  function fmt(s){
    if(s==='Error')return s;
    var neg=s[0]==='-'; if(neg)s=s.slice(1);
    var p=s.split('.'), i=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,',');
    return (neg?'-':'')+i+(p.length>1?'.'+p[1]:'');
  }
  function render(anim){
    var t=fmt(cur); valEl.textContent=t;
    var n=t.length; valEl.style.fontSize=(n>14?24:n>11?30:n>8?38:n>6?44:52)+'px';
    if(anim){valEl.classList.remove('pop','flash');void valEl.offsetWidth;valEl.classList.add(anim)}
    histEl.textContent=lastExpr;
    [].forEach.call(pad.querySelectorAll('.op'),function(b){b.classList.toggle('active',!!op&&fresh&&b.dataset.k===op)});
  }
  function clean(n){return String(parseFloat(n.toPrecision(12)))}
  function compute(a,b,o){
    a=parseFloat(a);b=parseFloat(b);var r;
    if(o==='+')r=a+b;else if(o==='−')r=a-b;else if(o==='×')r=a*b;else{if(b===0)return null;r=a/b}
    return isFinite(r)?clean(r):null;
  }
  function fail(){
    cur='Error';prev=null;op=null;fresh=true;lastExpr='';render('pop');
    lcd.classList.remove('err');void lcd.offsetWidth;lcd.classList.add('err');sfx.err();haptic([40,30,40]);
  }

  /* ---------- logic ---------- */
  function press(k){
    if(window.__burst)window.__burst(k);
    if(cur==='Error'&&k!=='AC'){cur='0';fresh=true}
    if(/^[0-9]$/.test(k)){
      if(fresh){cur=k;fresh=false}else if(cur==='0')cur=k;
      else if(cur.replace(/[-.]/g,'').length<12)cur+=k;
      sfx.digit(+k);render('pop');return;
    }
    if(k==='.'){
      if(fresh){cur='0.';fresh=false}else if(cur.indexOf('.')<0)cur+='.';
      sfx.dot();render('pop');return;
    }
    if(k==='AC'){cur='0';prev=null;op=null;fresh=true;lastExpr='';sfx.clear();render('pop');return}
    if(k==='⌫'){
      if(!fresh){cur=cur.length>1&&!(cur.length===2&&cur[0]==='-')?cur.slice(0,-1):'0';if(cur==='0')fresh=true}
      sfx.fn();render('pop');return;
    }
    if(k==='±'){if(cur!=='0'){cur=cur[0]==='-'?cur.slice(1):'-'+cur}sfx.fn();render('pop');return}
    if(k==='%'){var pc=parseFloat(cur),pend=op!==null&&prev!==null;cur=clean(pend&&(op==='+'||op==='−')?parseFloat(prev)*pc/100:pc/100);fresh=!pend;sfx.fn();render('pop');return}
    if(k==='='){
      if(op===null||prev===null){sfx.fn();return}
      var r=compute(prev,cur,op); if(r===null)return fail();
      lastExpr=fmt(prev)+' '+op+' '+fmt(cur)+' =';
      cur=r;prev=null;op=null;fresh=true;sfx.eq();haptic(25);render('flash');return;
    }
    /* operator */
    if(op!==null&&prev!==null&&!fresh){
      var s=compute(prev,cur,op); if(s===null)return fail(); cur=s;
    }
    prev=cur;op=k;fresh=true;lastExpr=fmt(prev)+' '+op;sfx.op();render('pop');
  }

  /* ---------- input ---------- */
  function ripple(btn,e){
    var r=btn.getBoundingClientRect(), s=Math.max(r.width,r.height)*2, d=document.createElement('span');
    var x=(e&&e.clientX?e.clientX:r.left+r.width/2)-r.left-s/2, y=(e&&e.clientY?e.clientY:r.top+r.height/2)-r.top-s/2;
    d.className='rip';d.style.cssText='width:'+s+'px;height:'+s+'px;left:'+x+'px;top:'+y+'px';
    btn.appendChild(d);setTimeout(function(){d.remove()},520);
  }
  pad.addEventListener('pointerdown',function(e){
    var b=e.target.closest('.k'); if(!b)return;
    audio(); ripple(b,e); haptic(8); press(b.dataset.k);
  });
  pad.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' ')e.preventDefault() });
  var map={'*':'×','/':'÷','-':'−','Enter':'=','=':'=','Escape':'AC','Backspace':'⌫','c':'AC','C':'AC'};
  document.addEventListener('keydown',function(e){
    if(e.metaKey||e.ctrlKey||e.altKey)return;
    var k=map[e.key]||e.key;
    var btn=pad.querySelector('[data-k="'+k+'"]');
    if(!btn&&k==='⌫'){press('⌫');return}
    if(!btn)return;
    e.preventDefault();
    btn.classList.add('down');ripple(btn);press(k);
    setTimeout(function(){btn.classList.remove('down')},110);
  });
  muteBtn.addEventListener('click',function(){
    muted=!muted;muteBtn.setAttribute('aria-pressed',muted);muteBtn.textContent=muted?'Sound off':'Sound on';
    if(!muted){audio();sfx.fn()}
  });
  render();

  /* ---------- animated background ---------- */
  var cv=document.getElementById('bg'), cx=cv.getContext('2d'), W=0, H=0, dpr=Math.min(window.devicePixelRatio||1,2);
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;
  var syms=['+','\u2212','\u00d7','\u00f7','=','0','1','2','3','4','5','6','7','8','9'];
  var cols=['43,63,209','255,122,61','255,190,40','133,145,230'];
  syms=['✦','✿','❀','✧','★','♪','☆','✦','❀'];cols=['255,170,210','255,255,255','255,225,77','127,216,255'];syms=['呪','術','祗','闇','影','式','結','結'];cols=['45,226,255','168,85,247','255,45,77','233,230,255'];var items=[], bits=[];
  function mk(y){
    return{x:Math.random()*W,y:y!==undefined?y:Math.random()*H,s:22+Math.random()*46,v:.15+Math.random()*.5,
      r:Math.random()*6.28,vr:(Math.random()-.5)*.012,sw:Math.random()*6.28,
      c:cols[Math.random()*cols.length|0],t:syms[Math.random()*syms.length|0],a:.18+Math.random()*.32};
  }
  function init(){
    W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;cx.setTransform(dpr,0,0,dpr,0,0);
    var n=Math.max(14,Math.min(50,Math.round(W*H/22000)));items=[];
    for(var i=0;i<n;i++)items.push(mk());
  }
  function draw(){
    cx.clearRect(0,0,W,H);cx.textAlign='center';cx.textBaseline='middle';
    items.forEach(function(it){
      if(!reduce){it.y-=it.v;it.sw+=.01;it.x+=Math.sin(it.sw)*.35;it.r+=it.vr;
        if(it.y<-70){var f=mk(H+70);for(var k in f)it[k]=f[k]}}
      cx.save();cx.translate(it.x,it.y);cx.rotate(it.r);
      cx.font='700 '+it.s+'px "Space Grotesk",system-ui,sans-serif';
      cx.fillStyle='rgba('+it.c+','+it.a+')';cx.fillText(it.t,0,0);cx.restore();
    });
    for(var i=bits.length-1;i>=0;i--){
      var b=bits[i];b.x+=b.vx;b.y+=b.vy;b.vy+=.12;b.vx*=.99;b.l-=.018;b.r+=b.vr;
      if(b.l<=0){bits.splice(i,1);continue}
      cx.save();cx.translate(b.x,b.y);cx.rotate(b.r);cx.fillStyle='rgba('+b.c+','+(b.l*.85)+')';
      if(b.sq)cx.fillRect(-b.s/2,-b.s/2,b.s,b.s*.6);else{cx.beginPath();cx.arc(0,0,b.s/2,0,6.28);cx.fill()}
      cx.restore();
    }
    if(!reduce)requestAnimationFrame(draw);
  }
  var BODY='<path d="M10 300C10 215 55 188 100 188S190 215 190 300Z"/><rect x="86" y="160" width="28" height="36"/><ellipse cx="100" cy="122" rx="38" ry="46"/>';
  var HAIR=['<path d="M58 118L48 56 74 84 82 36 100 80 120 32 126 82 152 50 142 118 128 92 72 92Z"/><rect class="a" x="56" y="110" width="88" height="17"/>',
    '<path d="M58 122C50 60 150 60 142 122L156 215 128 150Z"/><circle cx="100" cy="58" r="15"/><path class="e" d="M72 122l20 5M128 122l-20 5"/>',
    '<path d="M52 135C44 55 156 55 148 135L170 200 30 200Z"/><path class="e" d="M72 122l20 5M128 122l-20 5"/>',
    '<path d="M60 112L54 66 80 90 100 60 120 90 146 66 140 112 128 96 72 96Z"/><rect class="a" x="62" y="132" width="76" height="30"/>'];
  function cutin(){
    var col=['#2de2ff','#ff2d4d','#a855f7'][Math.random()*3|0], a=Math.random()*4|0, b=(a+1+(Math.random()*3|0))%4;
    var word=['領域展開','黒閃','術式反転','呪力解放'][Math.random()*4|0];
    function fig(i,c){return '<svg class="fig '+c+'" viewBox="0 0 200 300">'+BODY+HAIR[i]+'</svg>'}
    var d=document.createElement('div');d.className='cutin';d.style.setProperty('--g',col);
    d.innerHTML='<div class="band"></div><div class="row">'+fig(a,'l')+'<div class="word">'+word+'</div>'+fig(b,'r')+'</div>';
    document.body.appendChild(d);setTimeout(function(){d.remove()},1200);
  }
  function popup(k){
    var words=/^[0-9]$/.test(k)?['ピコ!','ポン!','タッ!','ピッ!']:k==='='?['キラーン!','ズバッ!','ドーン!']:k==='AC'?['シュッ!']:k==='.'?['チョン']:k==='⌫'?['ポロ']:['ドン!','バシッ!','ガッ!'];
    var el=pad.querySelector('[data-k="'+k+'"]'), r=el?el.getBoundingClientRect():{left:W/2,top:H/2,width:0,height:0};
    var d=document.createElement('div');d.className='sfx';var W2=/^[0-9]$/.test(k)?['呪','術','力','式','闇','影','結']:k==='='?['領域展開','黒閃']:k==='AC'?['祗']:k==='.'?['点']:k==='⌫'?['戻']:(k==='÷'||k==='×')?['赫','蒼']:['茈','蒼','赫'];
    d.textContent=W2[Math.random()*W2.length|0];d.style.setProperty('--g',k==='='?'#ff2d4d':/^[0-9]$/.test(k)?'#2de2ff':'#a855f7');
    d.style.left=(r.left+r.width/2+(Math.random()*30-15))+'px';d.style.top=(r.top-6)+'px';
    if(k==='=')d.style.display='none';
    document.body.appendChild(d);setTimeout(function(){d.remove()},720);
    if(k==='='){var f=document.createElement('div');f.className='flashbg';document.querySelector('.calc').animate([{transform:'translate(0,0)'},{transform:'translate(-7px,3px) skewX(-2deg)'},{transform:'translate(6px,-3px)'},{transform:'none'}],{duration:280});document.body.appendChild(f);setTimeout(function(){f.remove()},520)}
  }
  window.__burst=function(k){
    if(reduce)return;
    popup(k);if(k==='=')cutin();
    var el=pad.querySelector('[data-k="'+k+'"]'), r=el?el.getBoundingClientRect():{left:W/2,top:H/2,width:0,height:0};
    var ox=r.left+r.width/2, oy=r.top+r.height/2, n=k==='='?40:k==='AC'?26:10;
    for(var i=0;i<n;i++){
      var a=Math.random()*6.28, sp=(k==='='?3:2)+Math.random()*(k==='='?7:4);
      bits.push({x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-2,l:1,s:5+Math.random()*9,r:0,vr:(Math.random()-.5)*.3,
        c:cols[Math.random()*cols.length|0],sq:k==='='||Math.random()<.3});
    }
  };
  window.addEventListener('resize',function(){init();if(reduce)draw()});
  init();draw();
})();
