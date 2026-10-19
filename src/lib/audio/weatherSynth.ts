export interface SoundMix {
  rain: number;
  wind: number;
  thunder: number;
  pad: number;
  drone: number;
  master: number;
}
export class WeatherSynth {
  private context?: AudioContext;
  private analyser?: AnalyserNode;
  getAnalyser() {
    return this.analyser;
  }
  private gains: Partial<Record<keyof SoundMix, GainNode>> = {};
  private voices: OscillatorNode[] = [];
  private noise?: AudioBuffer;
  private thunderTimer?: ReturnType<typeof setTimeout>;
  private harmonyTimer?: ReturnType<typeof setInterval>;
  private env = { rain: 0, wind: 0, code: 0, temperature: 15, elevation: 30 };
  private mix: SoundMix = {
    rain: 0.25,
    wind: 0.2,
    thunder: 0,
    pad: 0.35,
    drone: 0.08,
    master: 0.5,
  };
  async start(rain = 0, wind = 10, code = 0) {
    this.stop();
    this.env = { ...this.env, rain, wind, code };
    const c = new AudioContext();
    this.context = c;
    const noise = c.createBuffer(2, c.sampleRate * 5, c.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = noise.getChannelData(channel);
      let b0 = 0,
        b1 = 0,
        brown = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        brown = (brown + 0.02 * white) / 1.02;
        data[i] = (b0 + b1 + white * 0.18) * 0.11 + brown * 0.9;
      }
    }
    this.noise = noise;
    const compressor = c.createDynamicsCompressor();
    compressor.threshold.value = -20;
    compressor.ratio.value = 5;
    compressor.connect(c.destination);
    const master = c.createGain();
    master.gain.value = 0.25 * this.mix.master;
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.82;
    master.connect(this.analyser).connect(compressor);
    this.gains.master = master;
    for (const [name, frequency] of [
      ["rain", 1800],
      ["wind", 240],
    ] as const) {
      const source = c.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      const filter = c.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = frequency;
      filter.Q.value = name === "rain" ? 0.45 : 0.7;
      const gain = c.createGain();
      gain.gain.value = this.mix[name];
      source.connect(filter).connect(gain).connect(master);
      source.start();
      this.gains[name] = gain;
      if (name === "wind") {
        const lfo = c.createOscillator(),
          mod = c.createGain();
        lfo.frequency.value = 0.11;
        mod.gain.value = 0.07;
        lfo.connect(mod).connect(gain.gain);
        lfo.start();
      }
    }
    const pad = c.createGain();
    pad.gain.value = this.mix.pad * 0.14;
    pad.connect(master);
    this.gains.pad = pad;
    for (let j = 0; j < 6; j++) {
      const voice = c.createOscillator(),
        filter = c.createBiquadFilter(),
        pan = c.createStereoPanner(),
        gain = c.createGain();
      voice.type = "sine";
      voice.detune.value = j % 2 === 0 ? -2 : 2;
      filter.type = "lowpass";
      filter.frequency.value = 900;
      gain.gain.value = 0.45;
      pan.pan.value = j % 2 === 0 ? -0.55 : 0.55;
      voice.connect(filter).connect(gain).connect(pan).connect(pad);
      voice.start();
      this.voices.push(voice);
    }
    const drone = c.createGain();
    drone.gain.value = this.mix.drone * 0.12;
    drone.connect(master);
    this.gains.drone = drone;
    for (const panValue of [-0.3, 0.3]) {
      const oscillator = c.createOscillator(),
        pan = c.createStereoPanner();
      oscillator.type = "sine";
      oscillator.frequency.value = 432;
      pan.pan.value = panValue;
      oscillator.connect(pan).connect(drone);
      oscillator.start();
    }
    this.retune();
    this.harmonyTimer = setInterval(() => this.retune(), 18000);
    this.scheduleThunder();
    await c.resume();
  }
  private retune() {
    const c = this.context;
    if (!c) return;
    const major = this.env.elevation > 0 && this.env.code < 3,
      intervals = major ? [0, 4, 7] : [0, 3, 7],
      root =
        130.81 *
        2 **
          (Math.max(
            -3,
            Math.min(4, Math.round((this.env.temperature - 15) / 6)),
          ) /
            12);
    this.voices.forEach((voice, j) =>
      voice.frequency.setTargetAtTime(
        root * 2 ** (intervals[Math.floor(j / 2)] / 12) * (j % 2 ? 1.004 : 1),
        c.currentTime,
        2.5,
      ),
    );
  }
  private scheduleThunder() {
    clearTimeout(this.thunderTimer);
    this.thunderTimer = setTimeout(
      () => {
        const c = this.context;
        if (!c || !this.noise) return;
        if (this.mix.thunder > 0.01) {
          const source = c.createBufferSource(),
            low = c.createBiquadFilter(),
            gain = c.createGain();
          source.buffer = this.noise;
          low.type = "lowpass";
          low.frequency.value = 90;
          const now = c.currentTime;
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(
            this.mix.thunder * 2 + 0.001,
            now + 0.8,
          );
          gain.gain.exponentialRampToValueAtTime(0.001, now + 7);
          source.connect(low).connect(gain).connect(this.gains.master!);
          source.start();
          source.stop(now + 7);
        }
        this.scheduleThunder();
      },
      4000 + Math.random() * 16000,
    );
  }
  setEnvironment(env: typeof this.env) {
    this.env = env;
    this.retune();
  }
  setMix(mix: SoundMix) {
    this.mix = mix;
    const c = this.context;
    if (!c) return;
    for (const key of ["rain", "wind", "pad", "drone", "master"] as const)
      this.gains[key]?.gain.setTargetAtTime(
        mix[key] *
          (key === "pad"
            ? 0.14
            : key === "drone"
              ? 0.12
              : key === "master"
                ? 0.25
                : 1),
        c.currentTime,
        0.35,
      );
  }
  stop() {
    clearTimeout(this.thunderTimer);
    clearInterval(this.harmonyTimer);
    if (this.context && this.context.state !== "closed")
      void this.context.close();
    this.context = undefined;
    this.analyser = undefined;
    this.voices = [];
    this.gains = {};
  }
}
export const weatherStudio = new WeatherSynth();
