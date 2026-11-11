// js/sounds.js
import {
    BLOCK_GRASS, BLOCK_DIRT, BLOCK_STONE, BLOCK_LOG, BLOCK_LEAVES,
    BLOCK_SAND, BLOCK_PLANKS, BLOCK_COBBLESTONE, BLOCK_WATER,
    BLOCK_BEDROCK, BLOCK_DIAMOND_ORE, BLOCK_CRAFTING_TABLE,
    BLOCK_COAL_ORE, BLOCK_GRAVEL, BLOCK_JUNGLE_LOG, BLOCK_JUNGLE_LEAVES,
    BLOCK_GRASS_PLANT, BLOCK_FLESH,
} from './constants.js';

/** Возвращает тип поверхности для звука (grass/stone/sand/wood/water). */
export function materialFromBlock(blockType) {
    switch (blockType) {
        case BLOCK_GRASS:
        case BLOCK_DIRT:
        case BLOCK_LEAVES:
        case BLOCK_JUNGLE_LEAVES:
        case BLOCK_GRASS_PLANT:
        case BLOCK_FLESH:
            return 'grass';
        case BLOCK_STONE:
        case BLOCK_COBBLESTONE:
        case BLOCK_BEDROCK:
        case BLOCK_DIAMOND_ORE:
        case BLOCK_COAL_ORE:
            return 'stone';
        case BLOCK_SAND:
        case BLOCK_GRAVEL:
            return 'sand';
        case BLOCK_LOG:
        case BLOCK_JUNGLE_LOG:
        case BLOCK_PLANKS:
        case BLOCK_CRAFTING_TABLE:
            return 'wood';
        case BLOCK_WATER:
            return 'water';
        default:
            return 'stone';
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.sfx = null;
        this.ambient = null;

        this._ambientStarted = false;
        this._windGain = null;

        this.muted = false;
        this.volume = 0.7;
    }

    /** Создаёт AudioContext. Вызывать только после user gesture (клик). */
    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(this.ctx.destination);

        this.sfx = this.ctx.createGain();
        this.sfx.gain.value = 1.0;
        this.sfx.connect(this.master);

        this.ambient = this.ctx.createGain();
        this.ambient.gain.value = 0.35;
        this.ambient.connect(this.master);

        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    resume() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    setVolume(v) {
        this.volume = Math.max(0, Math.min(1, v));
        if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
        return this.muted;
    }

    // ==================== ПРИМИТИВЫ ====================
    _playNoise(duration, volume, opts = {}) {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        const decay = opts.decay ?? 4;
        for (let i = 0; i < bufferSize; i++) {
            const t = i / ctx.sampleRate;
            data[i] = (Math.random() * 2 - 1) * Math.exp(-t * decay);
        }

        const src = ctx.createBufferSource();
        src.buffer = buffer;

        let prev = src;
        if (opts.highpass) {
            const f = ctx.createBiquadFilter();
            f.type = 'highpass';
            f.frequency.value = opts.highpass;
            f.Q.value = opts.q ?? 1;
            prev.connect(f);
            prev = f;
        }
        if (opts.lowpass) {
            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = opts.lowpass;
            f.Q.value = opts.q ?? 1;
            prev.connect(f);
            prev = f;
        }

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        prev.connect(gain);
        gain.connect(opts.toAmbient ? this.ambient : this.sfx);

        src.start(now);
        src.stop(now + duration + 0.01);
    }

    _playTone(freq, duration, volume, type = 'sine', slideTo = null) {
        if (!this.ctx) return;
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(this.sfx);
        osc.start(now);
        osc.stop(now + duration + 0.01);
    }

    // ==================== ШАГИ ====================
    footstep(material = 'grass') {
        if (!this.ctx) return;
        const vol = 0.14;
        switch (material) {
            case 'grass':
                this._playNoise(0.08, vol, { lowpass: 1200, decay: 8 });
                this._playNoise(0.06, vol * 0.55, { highpass: 800, decay: 10 });
                break;
            case 'stone':
                this._playNoise(0.06, vol, { lowpass: 3200, highpass: 400, decay: 12 });
                break;
            case 'sand':
                this._playNoise(0.13, vol * 0.75, { highpass: 1800, decay: 5 });
                break;
            case 'wood':
                this._playNoise(0.07, vol, { lowpass: 900, decay: 10 });
                this._playTone(180 + Math.random() * 60, 0.04, 0.04, 'triangle');
                break;
            case 'water':
                this._playNoise(0.15, vol * 0.9, { lowpass: 700, decay: 4 });
                break;
        }
    }

    // ==================== БЛОКИ ====================
    blockBreak(material = 'stone') {
        if (!this.ctx) return;
        switch (material) {
            case 'grass':
                this._playNoise(0.25, 0.32, { lowpass: 1500, decay: 5 });
                this._playNoise(0.14, 0.18, { highpass: 1500, decay: 8 });
                break;
            case 'stone':
                this._playNoise(0.28, 0.38, { lowpass: 4000, decay: 6 });
                this._playTone(120, 0.1, 0.14, 'square', 60);
                break;
            case 'sand':
                this._playNoise(0.38, 0.3, { highpass: 2000, decay: 3 });
                break;
            case 'wood':
                this._playNoise(0.22, 0.32, { lowpass: 1000, decay: 5 });
                this._playTone(200, 0.08, 0.11, 'triangle', 100);
                break;
            case 'water':
                this._playNoise(0.3, 0.25, { lowpass: 700, decay: 4 });
                break;
        }
    }

    blockPlace(material = 'stone') {
        if (!this.ctx) return;
        switch (material) {
            case 'grass':
                this._playNoise(0.1, 0.18, { lowpass: 900, decay: 8 });
                break;
            case 'stone':
                this._playNoise(0.1, 0.22, { lowpass: 2500, decay: 10 });
                this._playTone(220, 0.04, 0.08, 'square', 160);
                break;
            case 'sand':
                this._playNoise(0.14, 0.16, { highpass: 1500, decay: 6 });
                break;
            case 'wood':
                this._playNoise(0.1, 0.2, { lowpass: 800, decay: 9 });
                this._playTone(320, 0.03, 0.09, 'triangle', 250);
                break;
            case 'water':
                this._playNoise(0.2, 0.18, { lowpass: 800, decay: 5 });
                break;
        }
    }

    // ==================== РАЗНОЕ ====================
    jump() { this._playTone(240, 0.09, 0.07, 'sine', 400); }

    land(force = 1) {
        const v = Math.min(0.4, 0.12 * force);
        this._playNoise(0.14, v, { lowpass: 400, decay: 8 });
    }

    splash() {
        this._playNoise(0.3, 0.32, { lowpass: 800, decay: 4 });
        this._playNoise(0.4, 0.14, { highpass: 1500, decay: 3 });
    }

    pickup() {
        this._playTone(880, 0.06, 0.09, 'sine');
        setTimeout(() => this._playTone(1320, 0.06, 0.07, 'sine'), 55);
    }

    hurt() {
        this._playTone(200, 0.15, 0.25, 'sawtooth', 80);
        this._playNoise(0.1, 0.12, { lowpass: 2000 });
    }

    uiClick()  { this._playTone(800, 0.03, 0.05, 'square'); }
    uiOpen()   { this._playTone(440, 0.05, 0.06, 'sine', 660); }
    uiClose()  { this._playTone(660, 0.05, 0.06, 'sine', 440); }

    craft() {
        this._playTone(523, 0.06, 0.09, 'sine');
        setTimeout(() => this._playTone(659, 0.06, 0.09, 'sine'), 60);
        setTimeout(() => this._playTone(784, 0.08, 0.09, 'sine'), 120);
    }

    // ==================== AMBIENT ====================
    startAmbient() {
        if (!this.ctx || this._ambientStarted) return;
        this._ambientStarted = true;

        const ctx = this.ctx;
        const bufSize = Math.floor(ctx.sampleRate * 8);
        const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // Псевдо-розовый шум через усреднение + бесшовные края
        let prev = 0;
        for (let i = 0; i < bufSize; i++) {
            prev = prev * 0.98 + (Math.random() * 2 - 1) * 0.02;
            data[i] = prev * 3;
        }
        const fadeLen = Math.floor(ctx.sampleRate * 0.6);
        for (let i = 0; i < fadeLen; i++) {
            const t = i / fadeLen;
            data[i] *= t;
            data[bufSize - 1 - i] *= t;
        }

        const windSrc = ctx.createBufferSource();
        windSrc.buffer = buffer;
        windSrc.loop = true;

        const windFilter = ctx.createBiquadFilter();
        windFilter.type = 'lowpass';
        windFilter.frequency.value = 400;
        windFilter.Q.value = 0.4;

        this._windGain = ctx.createGain();
        this._windGain.gain.value = 0.0;

        windSrc.connect(windFilter);
        windFilter.connect(this._windGain);
        this._windGain.connect(this.ambient);
        windSrc.start(0);

        // Медленная модуляция громкости "порывами"
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.06;
        lfo.connect(lfoGain);
        lfoGain.connect(this._windGain.gain);
        lfo.start();
    }

    /** Вызывать каждый кадр. progress = (gameTime % DAY_LENGTH) / DAY_LENGTH */
    updateAmbient(dt, progress) {
        if (!this._ambientStarted) return;
        const dayFactor = Math.max(0, Math.sin((progress - 0.25) * Math.PI * 2));
        const now = this.ctx.currentTime;

        // Ветер громче днём
        this._windGain.gain.setTargetAtTime(
            0.05 + dayFactor * 0.07,
            now,
            1.2
        );

        // Птицы днём (редко)
        if (dayFactor > 0.35 && Math.random() < dt * 0.25) this._chirpBird();

        // Сверчки ночью (чаще)
        if (dayFactor < 0.25 && Math.random() < dt * 0.4) this._chirpCricket();
    }

    _chirpBird() {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const baseFreq = 1500 + Math.random() * 1500;
        const notes = 2 + Math.floor(Math.random() * 3);

        for (let i = 0; i < notes; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            const tStart = now + i * 0.07 + Math.random() * 0.04;
            osc.frequency.setValueAtTime(baseFreq + Math.random() * 300, tStart);
            osc.frequency.exponentialRampToValueAtTime(
                baseFreq + 500 + Math.random() * 400,
                tStart + 0.045
            );

            const g = ctx.createGain();
            g.gain.setValueAtTime(0, tStart);
            g.gain.linearRampToValueAtTime(0.010, tStart + 0.005);
            g.gain.exponentialRampToValueAtTime(0.001, tStart + 0.055);

            osc.connect(g);
            g.connect(this.ambient);
            osc.start(tStart);
            osc.stop(tStart + 0.07);
        }
    }

    _chirpCricket() {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const freq = 3000 + Math.random() * 1000;

        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const tStart = now + i * 0.08;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0, tStart);
            g.gain.linearRampToValueAtTime(0.005, tStart + 0.004);
            g.gain.exponentialRampToValueAtTime(0.001, tStart + 0.04);
            osc.connect(g);
            g.connect(this.ambient);
            osc.start(tStart);
            osc.stop(tStart + 0.05);
        }
    }
}

export const soundEngine = new SoundEngine();