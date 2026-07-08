/* ==========================================================
   Vexity · Minigame runner compartilhado
   Usa canvas #game-canvas e overlay #game-over.
   Chame initGame() para iniciar, stopGame() para parar,
   resetGame() para reiniciar.
   ========================================================== */
(function () {
  'use strict';

  let gameRunning = false;
  let gameId = null;
  let score = 0;
  let highScore = Number(localStorage.getItem('contabil_highscore') || 0);
  let lastMilestone = 0;
  let canvas = null;
  let ctx = null;

  const GAME = {
    baseGroundY: 222,
    gravity: 0.62,
    jumpPower: -12.2,
    baseSpeed: 4.25,
    maxSpeed: 11.5,
    accelPerSec: 0.18
  };
  const player = {
    x: 92,
    y: GAME.baseGroundY - 36,
    size: 36,
    vy: 0,
    grounded: true,
    rotation: 0,
    color: '#9fda68'
  };
  let obstacles = [];
  let coins = [];
  let terrain = [];
  let particles = [];
  let stars = [];
  let frame = 0;
  let elapsed = 0;
  let nextSpawn = 92;
  let nextCoin = 130;
  let nextStep = 220;
  let gameFlash = 0;
  let currentGroundY = GAME.baseGroundY;

  function makeStars() {
    if (!canvas) return;
    stars = Array.from({ length: 58 }, () => ({
      x: Math.random() * canvas.width,
      y: 18 + Math.random() * 154,
      r: 0.7 + Math.random() * 1.7,
      speed: 0.12 + Math.random() * 0.42,
      alpha: 0.14 + Math.random() * 0.42
    }));
  }

  function initGame() {
    if (document.documentElement.classList.contains('emag-focus-mode')) return;
    canvas = document.getElementById('game-canvas');
    ctx = canvas ? canvas.getContext('2d') : null;
    if (!canvas || !ctx || gameRunning) return;
    gameRunning = true;
    score = 0;
    lastMilestone = 0;
    frame = 0;
    elapsed = 0;
    nextSpawn = 92;
    nextCoin = 130;
    nextStep = 220;
    gameFlash = 0;
    obstacles = [];
    coins = [];
    particles = [];
    currentGroundY = GAME.baseGroundY;
    terrain = [{ x: 0, w: canvas.width + 200, top: GAME.baseGroundY }];
    makeStars();
    player.y = GAME.baseGroundY - player.size;
    player.vy = 0;
    player.grounded = true;
    player.rotation = 0;
    player.color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#9fda68';
    const go = document.getElementById('game-over');
    if (go) go.style.display = 'none';

    window.addEventListener('keydown', handleJump);
    canvas.addEventListener('mousedown', handleJump);
    canvas.addEventListener('touchstart', handleJump, { passive: false });
    gameLoop();
  }

  function stopGame() {
    gameRunning = false;
    if (gameId) cancelAnimationFrame(gameId);
    window.removeEventListener('keydown', handleJump);
    if (canvas) {
      canvas.removeEventListener('mousedown', handleJump);
      canvas.removeEventListener('touchstart', handleJump);
    }
  }

  function handleJump(e) {
    const isJump = e.type === 'mousedown' || e.type === 'touchstart' ||
      e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW';
    if (!isJump) return;
    // Só bloqueia scroll quando o jogo está rodando ou o overlay está aberto (evita atrapalhar o resto do site)
    const go = document.getElementById('game-over');
    if (!gameRunning && (!go || go.style.display !== 'flex')) return;
    if (e.preventDefault) e.preventDefault();
    if (!gameRunning && go && go.style.display === 'flex') { resetGame(); return; }
    if (player.grounded && gameRunning) {
      player.vy = GAME.jumpPower;
      player.grounded = false;
      gameFlash = 0.7;
      burstParticles(player.x + player.size / 2, player.y + player.size, 9, '#9fda68');
    }
  }

  function resetGame() { stopGame(); initGame(); }

  function currentSpeed() {
    return Math.min(GAME.maxSpeed, GAME.baseSpeed + elapsed * GAME.accelPerSec + score / 900);
  }

  function terrainTopAt(worldX) {
    for (let i = 0; i < terrain.length; i++) {
      const t = terrain[i];
      if (worldX >= t.x && worldX < t.x + t.w) return t.top;
    }
    return GAME.baseGroundY;
  }
  function terrainSupportUnder(px, pxRight) {
    let best = null;
    for (let i = 0; i < terrain.length; i++) {
      const t = terrain[i];
      const overlap = Math.min(pxRight, t.x + t.w) - Math.max(px, t.x);
      if (overlap > 2) if (best === null || t.top < best) best = t.top;
    }
    return best == null ? GAME.baseGroundY : best;
  }
  function lastTerrainEnd() {
    let end = 0;
    for (let i = 0; i < terrain.length; i++) {
      const e = terrain[i].x + terrain[i].w;
      if (e > end) end = e;
    }
    return end;
  }

  function spawnObstacle() {
    const level = Math.min(1, elapsed / 60);
    const roll = Math.random();
    const groundTop = terrainTopAt(canvas.width + 20);
    if (roll < 0.20 + level * 0.10) {
      obstacles.push({ type: 'double-spike', x: canvas.width + 14, y: groundTop - 32, w: 50, h: 32, passed: false });
    } else {
      obstacles.push({ type: 'spike', x: canvas.width + 14, y: groundTop - 32, w: 28, h: 32, passed: false });
    }
    nextSpawn = Math.max(38, 90 + Math.floor(Math.random() * 60) - Math.floor(level * 34));
  }
  function spawnCoin() {
    const groundTop = terrainTopAt(canvas.width + 30);
    const y = groundTop - 60 - Math.random() * 44;
    coins.push({ x: canvas.width + 24, y: y, r: 13, pulse: Math.random() * Math.PI * 2, used: false });
    nextCoin = 110 + Math.floor(Math.random() * 130);
  }
  function spawnTerrainStep() {
    const level = Math.min(1, elapsed / 45);
    const last = terrain[terrain.length - 1];
    const currentTop = last.top;
    const stepH = 26 + Math.floor(Math.random() * 22);
    let dir;
    if (currentTop <= GAME.baseGroundY - 70) dir = -1;
    else if (currentTop >= GAME.baseGroundY + 30) dir = 1;
    else dir = Math.random() < 0.55 ? -1 : 1;
    const newTop = Math.max(GAME.baseGroundY - 90, Math.min(GAME.baseGroundY + 30, currentTop + dir * stepH));
    const startX = lastTerrainEnd();
    const w = 130 + Math.floor(Math.random() * 120);
    terrain.push({ x: startX, w: w, top: newTop });
    nextStep = Math.max(90, 200 + Math.floor(Math.random() * 140) - Math.floor(level * 60));
  }

  function burstParticles(x, y, total, color) {
    for (let i = 0; i < total; i++) {
      particles.push({
        x, y,
        vx: -1.2 - Math.random() * 2.8,
        vy: -2 + Math.random() * 3.4,
        life: 24 + Math.random() * 16,
        maxLife: 42,
        size: 1.8 + Math.random() * 3.2,
        color
      });
    }
  }
  function circleRectHit(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < cr * cr;
  }

  function isLightMode() {
    return document.documentElement.classList.contains('emag-theme-light');
  }

  function drawBackground(speed) {
    const w = canvas.width, h = canvas.height;
    const light = isLightMode();
    const grd = ctx.createLinearGradient(0, 0, 0, h);
    
    if (light) {
      grd.addColorStop(0, '#f8fafc'); grd.addColorStop(0.55, '#f1f5f9'); grd.addColorStop(1, '#e2e8f0');
    } else {
      grd.addColorStop(0, '#111b2c'); grd.addColorStop(0.55, '#0b1020'); grd.addColorStop(1, '#060a12');
    }
    
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
    
    stars.forEach(star => {
      star.x -= star.speed * speed;
      if (star.x < -8) { star.x = w + 8; star.y = 18 + Math.random() * 154; }
      ctx.globalAlpha = star.alpha; 
      ctx.fillStyle = light ? '#64748b' : '#bef264';
      ctx.beginPath(); ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2); ctx.fill();
    });
    
    ctx.globalAlpha = 1;
    const gridOffset = (frame * speed * 0.42) % 40;
    ctx.strokeStyle = light ? 'rgba(0,0,0,0.04)' : 'rgba(159,218,104,0.065)'; 
    ctx.lineWidth = 1;
    for (let x = -gridOffset; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 20; y < GAME.baseGroundY; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }

  function drawGround() {
    const light = isLightMode();
    ctx.fillStyle = light ? '#cbd5e1' : '#111827';
    for (let i = 0; i < terrain.length; i++) {
      const t = terrain[i];
      ctx.fillRect(t.x, t.top, t.w, canvas.height - t.top);
    }
    
    const strokeColor = light ? '#64748b' : '#9fda68';
    ctx.strokeStyle = strokeColor; 
    ctx.lineWidth = 3; 
    ctx.shadowColor = strokeColor; 
    ctx.shadowBlur = light ? 4 : 14;
    
    for (let i = 0; i < terrain.length; i++) {
      const t = terrain[i];
      ctx.beginPath(); ctx.moveTo(t.x, t.top); ctx.lineTo(t.x + t.w, t.top); ctx.stroke();
      if (i < terrain.length - 1) {
        const next = terrain[i + 1]; const jx = t.x + t.w;
        ctx.beginPath(); ctx.moveTo(jx, t.top); ctx.lineTo(jx, next.top); ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = light ? 'rgba(0,0,0,0.06)' : 'rgba(159,218,104,0.20)'; 
    ctx.lineWidth = 1;
    const offset = (frame * 2) % 34;
    for (let x = -offset; x < canvas.width; x += 34) {
      const topAt = terrainTopAt(x);
      ctx.beginPath(); ctx.moveTo(x, topAt + 8); ctx.lineTo(x + 18, canvas.height); ctx.stroke();
    }
  }
  function drawSpike(o, shift) {
    shift = shift || 0;
    const x = o.x + shift, y = o.y;
    ctx.fillStyle = '#ef4444'; ctx.strokeStyle = '#fecaca'; ctx.lineWidth = 2;
    ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(x, y + o.h); ctx.lineTo(x + o.w / 2, y); ctx.lineTo(x + o.w, y + o.h);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  function drawObstacle(o) {
    if (o.type === 'spike') drawSpike(o);
    else if (o.type === 'double-spike') { drawSpike({ ...o, w: 25 }, 0); drawSpike({ ...o, w: 25 }, 25); }
  }
  function drawCoin(c) {
    const pulse = 1 + Math.sin(frame * 0.10 + c.pulse) * 0.10;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(pulse, pulse);
    ctx.shadowColor = '#facc15'; ctx.shadowBlur = 20;
    const grad = ctx.createRadialGradient(0, -4, 2, 0, 0, c.r);
    grad.addColorStop(0, '#fff7cc'); grad.addColorStop(0.55, '#facc15'); grad.addColorStop(1, '#b45309');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#7c2d12'; ctx.font = '900 16px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 1);
    ctx.restore();
  }
  function drawPlayer() {
    const cx = player.x + player.size / 2;
    const cy = player.y + player.size / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(player.rotation);
    ctx.shadowColor = player.color; ctx.shadowBlur = 20;
    ctx.fillStyle = player.color;
    ctx.fillRect(-player.size / 2, -player.size / 2, player.size, player.size);
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ecfccb'; ctx.lineWidth = 3;
    ctx.strokeRect(-player.size / 2 + 2, -player.size / 2 + 2, player.size - 4, player.size - 4);
    ctx.fillStyle = 'rgba(12,17,27,0.78)';
    ctx.fillRect(-9, -8, 6, 6); ctx.fillRect(6, -8, 6, 6); ctx.fillRect(-7, 8, 20, 4);
    ctx.restore();
  }
  function drawParticles() {
    particles.forEach((p, index) => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.055; p.life--;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      if (p.life <= 0) particles.splice(index, 1);
    });
    ctx.globalAlpha = 1;
  }
  function drawHud() {
    const light = isLightMode();
    ctx.font = '900 16px Inter, sans-serif'; 
    ctx.fillStyle = light ? '#1e293b' : '#ecfccb'; 
    ctx.textAlign = 'left';
    ctx.fillText('VEXITY DASH', 22, 32);
    
    ctx.font = '800 13px Inter, sans-serif'; 
    ctx.fillStyle = light ? 'rgba(30,41,59,0.7)' : 'rgba(226,232,240,0.78)';
    ctx.fillText('PONTOS ' + String(score).padStart(4, '0'), 22, 54);
    
    ctx.textAlign = 'right';
    ctx.fillText('RECORDE ' + String(highScore).padStart(4, '0'), canvas.width - 22, 32);
  }
  function hitsObstacle(o) {
    const px = player.x + 7, py = player.y + 7, ps = player.size - 14;
    return px < o.x + o.w - 8 && px + ps > o.x + 8 && py < o.y + o.h && py + ps > o.y + 13;
  }

  function gameLoop() {
    if (!gameRunning) return;
    const speed = currentSpeed();
    drawBackground(speed);

    for (let i = 0; i < terrain.length; i++) terrain[i].x -= speed;
    while (terrain.length > 1 && terrain[0].x + terrain[0].w < -20) terrain.shift();
    nextStep--;
    let safety = 8;
    while (lastTerrainEnd() < canvas.width + 120 && safety-- > 0) {
      if (nextStep <= 0) spawnTerrainStep();
      else { terrain[terrain.length - 1].w += 160; }
    }

    drawGround();

    player.vy += GAME.gravity;
    player.y += player.vy;

    const px1 = player.x + 6;
    const px2 = player.x + player.size - 6;
    const supportTop = terrainSupportUnder(px1, px2);
    currentGroundY = supportTop;

    const feet = player.y + player.size;
    if (feet >= supportTop && player.vy >= 0) {
      player.y = supportTop - player.size;
      player.vy = 0;
      player.grounded = true;
      player.rotation += (Math.round(player.rotation / (Math.PI / 2)) * (Math.PI / 2) - player.rotation) * 0.24;
    } else {
      player.grounded = false;
      player.rotation += 0.095;
    }

    if (player.y > canvas.height + 60) { gameOver(); return; }

    if (--nextSpawn <= 0) spawnObstacle();
    if (--nextCoin <= 0) spawnCoin();

    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.x -= speed;
      drawCoin(c);
      if (!c.used && circleRectHit(c.x, c.y, c.r + 3, player.x + 4, player.y + 4, player.size - 8, player.size - 8)) {
        c.used = true;
        score += 10;
        gameFlash = 0.95;
        burstParticles(c.x, c.y, 20, '#facc15');
        checkScoreMilestone();
      }
      if (c.used || c.x < -40) coins.splice(i, 1);
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= speed;
      const topUnder = terrainTopAt(o.x + o.w / 2);
      o.y = topUnder - o.h;
      drawObstacle(o);
      if (!o.passed && o.x + o.w < player.x) {
        o.passed = true;
        score += o.type === 'double-spike' ? 3 : 2;
        burstParticles(player.x + player.size, player.y + player.size / 2, 5, '#bef264');
        checkScoreMilestone();
      }
      if (hitsObstacle(o)) { gameOver(); return; }
      if (o.x + o.w < -40) obstacles.splice(i, 1);
    }

    if (frame % 12 === 0 && player.grounded) {
      particles.push({
        x: player.x + 4, y: currentGroundY - 5,
        vx: -speed * 0.30, vy: -0.5 - Math.random(),
        life: 18, maxLife: 18, size: 2, color: '#9fda68'
      });
    }

    drawParticles();
    drawPlayer();
    drawHud();

    if (gameFlash > 0.01) {
      ctx.globalAlpha = gameFlash * 0.08; ctx.fillStyle = '#9fda68';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1; gameFlash *= 0.86;
    }

    if (frame % 16 === 0) { score += 1; checkScoreMilestone(); }
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('contabil_highscore', highScore);
    }
    frame++;
    elapsed += 1 / 60;
    gameId = requestAnimationFrame(gameLoop);
  }

  function checkScoreMilestone() {
    const milestones = [100, 1000, 10000];
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (score >= m && lastMilestone < m) {
        lastMilestone = m;
        const messages = {
          100:   { title: '🎉 100 pontos!',    text: 'Boa! Continue coletando os $.' },
          1000:  { title: '🚀 1.000 pontos!',  text: 'Impressionante! O jogo está pegando fogo.' },
          10000: { title: '👑 10.000 pontos!', text: 'Lenda do jogo!' }
        };
        const msg = messages[m];
        if (typeof window.showGenericCelebration === 'function') {
          window.showGenericCelebration(msg.title, msg.text, {
            fireworks: m === 10000 ? 10 : (m === 1000 ? 8 : 5),
            duration: 1400
          });
        }
      }
    }
  }

  function gameOver() {
    gameRunning = false;
    burstParticles(player.x + player.size / 2, player.y + player.size / 2, 28, '#ef4444');
    drawParticles();
    const go = document.getElementById('game-over');
    if (go) go.style.display = 'flex';
    const gs = document.getElementById('game-score');
    if (gs) gs.textContent = 'Pontuação: ' + score + ' · Recorde: ' + highScore;
  }

  // Exponhe globalmente
  window.initGame = initGame;
  window.stopGame = stopGame;
  window.resetGame = resetGame;
})();
