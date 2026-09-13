// ==========================================
// ANTIGRAVITY: NEON DEFENDER - Cyber Arcade
// Pure Vanilla JavaScript Game Engine
// ==========================================

// --- AUDIO SYNTHESIZER (Web Audio API) ---
class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playLaser() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  playExplosion(intensity = 1) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.25 * intensity;
    const bufferSize = this.ctx.sampleRate * dur;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450 * intensity, now);
    filter.frequency.linearRampToValueAtTime(50, now + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  playPowerup() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [330, 440, 554, 659, 880];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.04;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.1);
    });
  }

  playShieldHit() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }
}

const sounds = new SoundController();

// --- GAME LOGIC & STATE ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let W = (canvas.width = window.innerWidth);
let H = (canvas.height = window.innerHeight);

window.addEventListener('resize', () => {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  initStars();
});

// HUD Elements
const healthFill = document.getElementById('healthFill');
const shieldFill = document.getElementById('shieldFill');
const scoreVal = document.getElementById('scoreVal');
const waveVal = document.getElementById('waveVal');
const comboBadge = document.getElementById('comboBadge');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalScoreVal = document.getElementById('finalScoreVal');
const highScoreVal = document.getElementById('highScoreVal');
const btnStartGame = document.getElementById('btnStartGame');
const btnRestartGame = document.getElementById('btnRestartGame');
const soundToggle = document.getElementById('sound-toggle');
const soundIconOn = document.getElementById('soundIconOn');
const soundIconOff = document.getElementById('soundIconOff');

let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let highScore = parseInt(localStorage.getItem('antigravity_highscore') || '0');
let wave = 1;
let combo = 0;
let comboTimer = 0;
let screenShake = 0;

// Input Management
const keys = { w: false, a: false, s: false, d: false, Space: false, Shift: false };
const mouse = { x: W / 2, y: H / 2, isDown: false };

window.addEventListener('keydown', (e) => {
  if (['KeyW', 'ArrowUp'].includes(e.code)) keys.w = true;
  if (['KeyA', 'ArrowLeft'].includes(e.code)) keys.a = true;
  if (['KeyS', 'ArrowDown'].includes(e.code)) keys.s = true;
  if (['KeyD', 'ArrowRight'].includes(e.code)) keys.d = true;
  if (e.code === 'Space') keys.Space = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.Shift = true;
});

window.addEventListener('keyup', (e) => {
  if (['KeyW', 'ArrowUp'].includes(e.code)) keys.w = false;
  if (['KeyA', 'ArrowLeft'].includes(e.code)) keys.a = false;
  if (['KeyS', 'ArrowDown'].includes(e.code)) keys.s = false;
  if (['KeyD', 'ArrowRight'].includes(e.code)) keys.d = false;
  if (e.code === 'Space') keys.Space = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.Shift = false;
});

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener('mousedown', (e) => {
  if (e.button === 0) mouse.isDown = true;
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.isDown = false;
});

// Sound Toggle Button
soundToggle.addEventListener('click', () => {
  sounds.init();
  sounds.enabled = !sounds.enabled;
  soundIconOn.style.display = sounds.enabled ? 'block' : 'none';
  soundIconOff.style.display = sounds.enabled ? 'none' : 'block';
});

// --- PARALLAX STARFIELD ---
const stars = [];
function initStars() {
  stars.length = 0;
  for (let i = 0; i < 180; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 1.5 + 0.2,
      opacity: Math.random() * 0.7 + 0.3,
      color: Math.random() > 0.8 ? '#00f0ff' : Math.random() > 0.6 ? '#ff007f' : '#ffffff'
    });
  }
}
initStars();

// --- PLAYER SHIP ---
class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 18;
    this.angle = 0;
    this.maxSpeed = 7.5;
    this.accel = 0.45;
    this.friction = 0.965;
    this.health = 100;
    this.maxHealth = 100;
    this.shield = 100;
    this.maxShield = 100;
    this.shieldRegenDelay = 0;
    this.shootCooldown = 0;
    this.tripleShotTimer = 0;
    this.overdriveTimer = 0;
    this.dashCooldown = 0;
  }

  update() {
    // Rotation towards mouse
    const dx = mouse.x - this.x;
    const dy = mouse.y - this.y;
    this.angle = Math.atan2(dy, dx);

    // Thruster acceleration
    let moveX = 0;
    let moveY = 0;
    if (keys.w) moveY -= 1;
    if (keys.s) moveY += 1;
    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;

    // Normalize diagonal movement
    if (moveX !== 0 && moveY !== 0) {
      moveX *= 0.7071;
      moveY *= 0.7071;
    }

    this.vx += moveX * this.accel;
    this.vy += moveY * this.accel;

    // Warp Dash (Shift key)
    if (keys.Shift && this.dashCooldown <= 0 && (moveX !== 0 || moveY !== 0)) {
      this.vx += moveX * 12;
      this.vy += moveY * 12;
      this.dashCooldown = 60; // 1 second cooldown
      screenShake = 12;
      createSparks(this.x, this.y, '#00f0ff', 24);
      sounds.playLaser();
    }
    if (this.dashCooldown > 0) this.dashCooldown--;

    // Speed Cap & Inertial Drag
    const currentSpeed = Math.hypot(this.vx, this.vy);
    const speedLimit = keys.Shift ? this.maxSpeed * 1.6 : this.maxSpeed;
    if (currentSpeed > speedLimit) {
      this.vx = (this.vx / currentSpeed) * speedLimit;
      this.vy = (this.vy / currentSpeed) * speedLimit;
    }
    this.vx *= this.friction;
    this.vy *= this.friction;

    this.x += this.vx;
    this.y += this.vy;

    // Screen Boundary Bounce
    if (this.x < this.radius) { this.x = this.radius; this.vx *= -0.5; }
    if (this.x > W - this.radius) { this.x = W - this.radius; this.vx *= -0.5; }
    if (this.y < this.radius) { this.y = this.radius; this.vy *= -0.5; }
    if (this.y > H - this.radius) { this.y = H - this.radius; this.vy *= -0.5; }

    // Thruster exhaust particles
    if (moveX !== 0 || moveY !== 0) {
      const exhaustAngle = this.angle + Math.PI + (Math.random() - 0.5) * 0.4;
      particles.push(new Particle(
        this.x - Math.cos(this.angle) * 14,
        this.y - Math.sin(this.angle) * 14,
        Math.cos(exhaustAngle) * (Math.random() * 3 + 2),
        Math.sin(exhaustAngle) * (Math.random() * 3 + 2),
        Math.random() > 0.4 ? '#00f0ff' : '#ff007f',
        Math.random() * 3 + 1,
        25
      ));
    }

    // Shield Regeneration
    if (this.shieldRegenDelay > 0) {
      this.shieldRegenDelay--;
    } else if (this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + 0.15);
    }

    // Weapons Cooldown
    if (this.shootCooldown > 0) this.shootCooldown--;
    if (this.tripleShotTimer > 0) this.tripleShotTimer--;
    if (this.overdriveTimer > 0) this.overdriveTimer--;

    // Shooting
    const fireInterval = this.overdriveTimer > 0 ? 5 : 10;
    if ((mouse.isDown || keys.Space) && this.shootCooldown <= 0) {
      this.shoot();
      this.shootCooldown = fireInterval;
    }
  }

  shoot() {
    sounds.playLaser();
    const noseX = this.x + Math.cos(this.angle) * 22;
    const noseY = this.y + Math.sin(this.angle) * 22;
    const speed = 16;

    if (this.tripleShotTimer > 0) {
      // 3-way spread
      [-0.18, 0, 0.18].forEach((offset) => {
        bullets.push(new Bullet(
          noseX,
          noseY,
          Math.cos(this.angle + offset) * speed,
          Math.sin(this.angle + offset) * speed,
          '#00f0ff',
          true
        ));
      });
    } else {
      bullets.push(new Bullet(
        noseX,
        noseY,
        Math.cos(this.angle) * speed,
        Math.sin(this.angle) * speed,
        '#00f0ff',
        true
      ));
    }
  }

  takeDamage(amt) {
    screenShake = 16;
    this.shieldRegenDelay = 180; // 3 seconds before recharge

    if (this.shield > 0) {
      sounds.playShieldHit();
      const absorbed = Math.min(this.shield, amt);
      this.shield -= absorbed;
      amt -= absorbed;
      createSparks(this.x, this.y, '#00f0ff', 16);
    }

    if (amt > 0) {
      sounds.playExplosion(0.8);
      this.health -= amt;
      createSparks(this.x, this.y, '#ff007f', 24);
    }

    if (this.health <= 0) {
      this.health = 0;
      gameOver();
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Shield Aura
    if (this.shield > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 240, 255, ${0.25 + (this.shield / this.maxShield) * 0.45})`;
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 15;
      ctx.stroke();
    }

    // Ship Hull (Futuristic Arrowhead)
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-14, -14);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-14, 14);
    ctx.closePath();

    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.stroke();

    // Neon Cockpit
    ctx.beginPath();
    ctx.arc(2, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = this.overdriveTimer > 0 ? '#ffe600' : '#ff007f';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.fill();

    ctx.restore();
  }
}

// --- PROJECTILES ---
class Bullet {
  constructor(x, y, vx, vy, color = '#00f0ff', isPlayer = true) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.isPlayer = isPlayer;
    this.radius = isPlayer ? 4 : 5;
    this.life = 70;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
  }

  draw() {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.restore();
  }
}

// --- ENEMIES & OBSTACLES ---
class Enemy {
  constructor(type = 'drone') {
    this.type = type; // 'drone', 'cruiser', 'asteroid'
    this.radius = type === 'cruiser' ? 26 : type === 'asteroid' ? 28 : 16;

    // Spawn from edge
    if (Math.random() > 0.5) {
      this.x = Math.random() > 0.5 ? -40 : W + 40;
      this.y = Math.random() * H;
    } else {
      this.x = Math.random() * W;
      this.y = Math.random() > 0.5 ? -40 : H + 40;
    }

    this.vx = 0;
    this.vy = 0;
    this.speed = type === 'drone' ? 2.5 + wave * 0.2 : type === 'cruiser' ? 1.2 : 1.5;
    this.health = type === 'cruiser' ? 6 : type === 'asteroid' ? 4 : 2;
    this.shootTimer = Math.floor(Math.random() * 60) + 60;
    this.color = type === 'cruiser' ? '#9d4edd' : type === 'asteroid' ? '#f59e0b' : '#ff007f';
    this.angle = 0;
  }

  update(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (this.type === 'drone') {
      // Direct homing tracking
      this.vx = (dx / dist) * this.speed;
      this.vy = (dy / dist) * this.speed;
      this.angle = Math.atan2(dy, dx);
    } else if (this.type === 'cruiser') {
      // Keep distance and strafe
      this.angle = Math.atan2(dy, dx);
      if (dist > 300) {
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
      } else {
        // Orbit
        this.vx = (-dy / dist) * this.speed;
        this.vy = (dx / dist) * this.speed;
      }

      // Cruiser shooting
      this.shootTimer--;
      if (this.shootTimer <= 0) {
        this.shootTimer = 110;
        bullets.push(new Bullet(
          this.x,
          this.y,
          (dx / dist) * 7,
          (dy / dist) * 7,
          '#ff007f',
          false
        ));
      }
    } else if (this.type === 'asteroid') {
      if (this.vx === 0 && this.vy === 0) {
        this.vx = (dx / dist + (Math.random() - 0.5) * 0.5) * this.speed;
        this.vy = (dy / dist + (Math.random() - 0.5) * 0.5) * this.speed;
      }
      this.angle += 0.02;
    }

    this.x += this.vx;
    this.y += this.vy;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    ctx.strokeStyle = this.color;
    ctx.fillStyle = '#0a0d1a';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 12;

    if (this.type === 'drone') {
      // Stealth Triangular Scout
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-14, -12);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (this.type === 'cruiser') {
      // Heavy Cruiser Pentagon
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(8, -18);
      ctx.lineTo(-20, -14);
      ctx.lineTo(-20, 14);
      ctx.lineTo(8, 18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Jagged Asteroid
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const rad = (Math.PI * 2 / 7) * i;
        const d = this.radius * (0.8 + (i % 2) * 0.4);
        const px = Math.cos(rad) * d;
        const py = Math.sin(rad) * d;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

// --- POWER-UPS ---
class PowerUp {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    const types = ['triple', 'shield', 'overdrive', 'repair'];
    this.type = types[Math.floor(Math.random() * types.length)];
    this.radius = 14;
    this.life = 450; // 7.5 seconds
    this.pulse = 0;
  }

  update() {
    this.life--;
    this.pulse += 0.08;
  }

  draw() {
    const scale = 1 + Math.sin(this.pulse) * 0.15;
    const colors = {
      triple: '#00f0ff',
      shield: '#3b82f6',
      overdrive: '#ffe600',
      repair: '#00ff88'
    };
    const col = colors[this.type];

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);

    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.shadowColor = col;
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 11px Orbitron';
    ctx.fillStyle = col;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labels = { triple: '3X', shield: '🛡️', overdrive: '⚡', repair: '❤️' };
    ctx.fillText(labels[this.type], 0, 0);

    ctx.restore();
  }
}

// --- PARTICLES & FLOATING TEXT ---
class Particle {
  constructor(x, y, vx, vy, color, size = 3, maxLife = 40) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.life = maxLife;
    this.maxLife = maxLife;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.96;
    this.vy *= 0.96;
    this.life--;
  }

  draw() {
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class FloatingText {
  constructor(x, y, text, color = '#ffe600') {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 45;
  }

  update() {
    this.y -= 1.2;
    this.life--;
  }

  draw() {
    const alpha = this.life / 45;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '800 16px Orbitron';
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

function createSparks(x, y, color, count = 18) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 6 + 1;
    particles.push(new Particle(
      x,
      y,
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      color,
      Math.random() * 3 + 1.5,
      Math.floor(Math.random() * 30 + 15)
    ));
  }
}

// --- GAME COLLECTIONS ---
const player = new Player();
const bullets = [];
const enemies = [];
const powerups = [];
const particles = [];
const floatingTexts = [];

let spawnTimer = 0;

// --- GAME LOOP ---
function startGame() {
  sounds.init();
  player.reset();
  bullets.length = 0;
  enemies.length = 0;
  powerups.length = 0;
  particles.length = 0;
  floatingTexts.length = 0;

  score = 0;
  wave = 1;
  combo = 0;
  gameState = 'PLAYING';

  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
}

function gameOver() {
  gameState = 'GAMEOVER';
  sounds.playExplosion(2.2);

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('antigravity_highscore', highScore.toString());
  }

  finalScoreVal.textContent = score.toLocaleString();
  highScoreVal.textContent = highScore.toLocaleString();
  gameOverScreen.classList.remove('hidden');
}

btnStartGame.addEventListener('click', startGame);
btnRestartGame.addEventListener('click', startGame);

function updateGame() {
  if (gameState !== 'PLAYING') return;

  player.update();

  // Screen Shake decay
  if (screenShake > 0) screenShake *= 0.9;

  // Combo timer decay
  if (comboTimer > 0) {
    comboTimer--;
    if (comboTimer === 0) {
      combo = 0;
      comboBadge.classList.remove('active');
    }
  }

  // Wave & Spawn Management
  spawnTimer--;
  if (spawnTimer <= 0) {
    const enemyTypes = ['drone', 'asteroid'];
    if (wave >= 2) enemyTypes.push('cruiser');

    const chosenType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    enemies.push(new Enemy(chosenType));
    spawnTimer = Math.max(30, 95 - wave * 7);
  }

  // Wave advancement every 1500 points
  const targetWave = Math.floor(score / 1500) + 1;
  if (targetWave > wave) {
    wave = targetWave;
    floatingTexts.push(new FloatingText(W / 2, H / 3, `¡OLEADA ${wave} INICIADA!`, '#00f0ff'));
    sounds.playPowerup();
  }

  // Update Bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.update();

    if (b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H) {
      bullets.splice(i, 1);
      continue;
    }

    // Player bullets hit enemies
    if (b.isPlayer) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const en = enemies[j];
        if (Math.hypot(b.x - en.x, b.y - en.y) < b.radius + en.radius) {
          bullets.splice(i, 1);
          en.health--;
          createSparks(b.x, b.y, en.color, 8);

          if (en.health <= 0) {
            sounds.playExplosion(1);
            createSparks(en.x, en.y, en.color, 24);

            // Combo & Score
            combo++;
            comboTimer = 160;
            comboBadge.textContent = `COMBO x${combo}`;
            comboBadge.classList.add('active');

            const earnedScore = (en.type === 'cruiser' ? 250 : 100) * combo;
            score += earnedScore;
            floatingTexts.push(new FloatingText(en.x, en.y, `+${earnedScore}`));

            // Random Power-Up drop (18% chance)
            if (Math.random() < 0.2) {
              powerups.push(new PowerUp(en.x, en.y));
            }

            enemies.splice(j, 1);
          }
          break;
        }
      }
    } else {
      // Enemy bullets hit player
      if (Math.hypot(b.x - player.x, b.y - player.y) < b.radius + player.radius) {
        bullets.splice(i, 1);
        player.takeDamage(15);
      }
    }
  }

  // Update Enemies & Player Collisions
  for (let i = enemies.length - 1; i >= 0; i--) {
    const en = enemies[i];
    en.update(player);

    if (Math.hypot(en.x - player.x, en.y - player.y) < en.radius + player.radius) {
      createSparks(en.x, en.y, en.color, 20);
      player.takeDamage(en.type === 'asteroid' ? 30 : 20);
      enemies.splice(i, 1);
    }
  }

  // Update Powerups
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.update();

    if (p.life <= 0) {
      powerups.splice(i, 1);
      continue;
    }

    if (Math.hypot(p.x - player.x, p.y - player.y) < p.radius + player.radius) {
      sounds.playPowerup();
      if (p.type === 'triple') {
        player.tripleShotTimer = 450;
        floatingTexts.push(new FloatingText(player.x, player.y, '¡TRIPLE DISPARO!', '#00f0ff'));
      } else if (p.type === 'shield') {
        player.shield = player.maxShield;
        floatingTexts.push(new FloatingText(player.x, player.y, '¡ESCUDO RECARGADO!', '#3b82f6'));
      } else if (p.type === 'overdrive') {
        player.overdriveTimer = 350;
        floatingTexts.push(new FloatingText(player.x, player.y, '¡HIPER VELOCIDAD!', '#ffe600'));
      } else if (p.type === 'repair') {
        player.health = Math.min(player.maxHealth, player.health + 35);
        floatingTexts.push(new FloatingText(player.x, player.y, '+35% CASCO', '#00ff88'));
      }
      createSparks(p.x, p.y, '#00f0ff', 15);
      powerups.splice(i, 1);
    }
  }

  // Update HUD elements
  healthFill.style.width = `${Math.max(0, (player.health / player.maxHealth) * 100)}%`;
  shieldFill.style.width = `${Math.max(0, (player.shield / player.maxShield) * 100)}%`;
  scoreVal.textContent = score.toString().padStart(6, '0');
  waveVal.textContent = wave;
}

function render() {
  ctx.save();

  // Screen shake translation
  if (screenShake > 0.5) {
    const sx = (Math.random() - 0.5) * screenShake;
    const sy = (Math.random() - 0.5) * screenShake;
    ctx.translate(sx, sy);
  }

  ctx.clearRect(0, 0, W, H);

  // Render Starfield with warp effect
  stars.forEach((star) => {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fillStyle = star.color;
    ctx.globalAlpha = star.opacity;
    ctx.shadowBlur = star.size > 1.8 ? 6 : 0;
    ctx.shadowColor = star.color;
    ctx.fill();

    // Subtle drift
    star.y += star.speed * (keys.Shift ? 2.5 : 1);
    if (star.y > H) {
      star.y = 0;
      star.x = Math.random() * W;
    }
  });
  ctx.globalAlpha = 1.0;

  // Render Game Entities
  powerups.forEach((p) => p.draw());
  bullets.forEach((b) => b.draw());
  enemies.forEach((e) => e.draw());

  if (gameState === 'PLAYING') {
    player.draw();
  }

  // Render Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    p.draw();
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Render Floating Combat Text
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.update();
    ft.draw();
    if (ft.life <= 0) floatingTexts.splice(i, 1);
  }

  ctx.restore();
}

function loop() {
  updateGame();
  render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
