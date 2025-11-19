// Audio Engine
class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.activeNotes = new Map(); // Track active oscillators
        this.waveform = 'sine';
        this.volume = 0.5;
        this.octave = 4;
        this.attack = 0;
        this.release = 200;
        
        this.initAudioContext();
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = this.volume;
        } catch (error) {
            console.error('Error initializing audio context:', error);
        }
    }

    // Convert note name to frequency
    noteToFrequency(note, octave) {
        const noteFrequencies = {
            'C': 16.35, 'C#': 17.32, 'D': 18.35, 'D#': 19.45,
            'E': 20.60, 'F': 21.83, 'F#': 23.12, 'G': 24.50,
            'G#': 25.96, 'A': 27.50, 'A#': 29.14, 'B': 30.87
        };

        const baseFreq = noteFrequencies[note];
        if (!baseFreq) return 0;
        
        // Calculate frequency based on octave
        return baseFreq * Math.pow(2, octave);
    }

    // Play a note
    playNote(note, octave) {
        if (!this.audioContext) {
            this.initAudioContext();
        }

        // Resume audio context if suspended (required by some browsers)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        const frequency = this.noteToFrequency(note, octave);
        if (frequency === 0) return;

        const noteId = `${note}-${octave}`;
        
        // Don't play if already playing
        if (this.activeNotes.has(noteId)) {
            return;
        }

        // Create oscillator
        const oscillator = this.audioContext.createOscillator();
        oscillator.type = this.waveform;
        oscillator.frequency.value = frequency;

        // Create gain node for envelope (attack/release)
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);

        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(this.masterGain);

        // Attack phase
        const attackTime = this.audioContext.currentTime + (this.attack / 1000);
        gainNode.gain.linearRampToValueAtTime(this.volume, attackTime);

        // Start oscillator
        oscillator.start(this.audioContext.currentTime);

        // Store reference
        this.activeNotes.set(noteId, {
            oscillator: oscillator,
            gainNode: gainNode,
            startTime: this.audioContext.currentTime
        });
    }

    // Stop a note
    stopNote(note, octave) {
        const noteId = `${note}-${octave}`;
        const noteData = this.activeNotes.get(noteId);

        if (!noteData) return;

        const { oscillator, gainNode } = noteData;
        const releaseTime = this.release / 1000;
        const currentTime = this.audioContext.currentTime;

        // Release phase
        gainNode.gain.cancelScheduledValues(currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, currentTime);
        gainNode.gain.linearRampToValueAtTime(0, currentTime + releaseTime);

        // Stop oscillator after release
        oscillator.stop(currentTime + releaseTime);

        // Clean up after release
        setTimeout(() => {
            this.activeNotes.delete(noteId);
        }, releaseTime * 1000);
    }

    // Stop all notes
    stopAllNotes() {
        this.activeNotes.forEach((noteData, noteId) => {
            const [note, octave] = noteId.split('-');
            this.stopNote(note, parseInt(octave));
        });
    }

    // Update waveform
    setWaveform(waveform) {
        this.waveform = waveform;
        // Update active oscillators
        this.activeNotes.forEach((noteData) => {
            noteData.oscillator.type = waveform;
        });
    }

    // Update volume
    setVolume(volume) {
        this.volume = volume;
        this.masterGain.gain.value = volume;
    }

    // Update octave
    setOctave(octave) {
        this.octave = octave;
    }

    // Update attack
    setAttack(attack) {
        this.attack = attack;
    }

    // Update release
    setRelease(release) {
        this.release = release;
    }
}

// Keyboard Manager
class KeyboardManager {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.keyMapping = this.createKeyMapping();
        this.activeKeys = new Set();
        
        this.initKeyboard();
        this.initEventListeners();
    }

    // Create QWERTY to note mapping
    createKeyMapping() {
        // White keys: A S D F G H J K L ; '
        // Black keys: W E T Y U O P [
        return {
            // White keys
            'a': { note: 'C', isBlack: false },
            's': { note: 'D', isBlack: false },
            'd': { note: 'E', isBlack: false },
            'f': { note: 'F', isBlack: false },
            'g': { note: 'G', isBlack: false },
            'h': { note: 'A', isBlack: false },
            'j': { note: 'B', isBlack: false },
            'k': { note: 'C', isBlack: false },
            'l': { note: 'D', isBlack: false },
            ';': { note: 'E', isBlack: false },
            "'": { note: 'F', isBlack: false },
            // Black keys
            'w': { note: 'C#', isBlack: true },
            'e': { note: 'D#', isBlack: true },
            't': { note: 'F#', isBlack: true },
            'y': { note: 'G#', isBlack: true },
            'u': { note: 'A#', isBlack: true },
            'o': { note: 'C#', isBlack: true },
            'p': { note: 'D#', isBlack: true },
            '[': { note: 'F#', isBlack: true }
        };
    }

    // Initialize keyboard UI
    initKeyboard() {
        const keyboard = document.getElementById('keyboard');
        keyboard.innerHTML = '';

        // Define the keyboard layout in order
        const keyLayout = [
            { note: 'C', isBlack: false },
            { note: 'C#', isBlack: true },
            { note: 'D', isBlack: false },
            { note: 'D#', isBlack: true },
            { note: 'E', isBlack: false },
            { note: 'F', isBlack: false },
            { note: 'F#', isBlack: true },
            { note: 'G', isBlack: false },
            { note: 'G#', isBlack: true },
            { note: 'A', isBlack: false },
            { note: 'A#', isBlack: true },
            { note: 'B', isBlack: false }
        ];

        const whiteKeyWidth = 60;
        const blackKeyWidth = 40;
        let whiteKeyIndex = 0;

        // Create all keys in order
        keyLayout.forEach((keyInfo) => {
            const key = document.createElement('div');
            key.className = `key ${keyInfo.isBlack ? 'black' : 'white'}`;
            key.dataset.note = keyInfo.note;
            key.dataset.isBlack = keyInfo.isBlack.toString();
            
            // Add label with keyboard shortcut
            const label = document.createElement('div');
            label.className = 'key-label';
            const keyChar = Object.keys(this.keyMapping).find(
                k => this.keyMapping[k].note === keyInfo.note && 
                     this.keyMapping[k].isBlack === keyInfo.isBlack
            );
            label.textContent = keyChar ? keyChar.toUpperCase() : '';
            key.appendChild(label);

            // Position black keys absolutely
            if (keyInfo.isBlack) {
                // Position black key between the previous and next white key
                const leftPosition = (whiteKeyIndex * whiteKeyWidth) + (whiteKeyWidth / 2) - (blackKeyWidth / 2);
                key.style.left = `${leftPosition}px`;
            } else {
                whiteKeyIndex++;
            }

            keyboard.appendChild(key);
        });
    }

    // Initialize event listeners
    initEventListeners() {
        // Mouse events
        document.getElementById('keyboard').addEventListener('mousedown', (e) => {
            const key = e.target.closest('.key');
            if (key) {
                this.handleKeyPress(key.dataset.note, key.dataset.isBlack === 'true');
            }
        });

        document.addEventListener('mouseup', () => {
            this.handleKeyRelease();
        });

        // Touch events
        document.getElementById('keyboard').addEventListener('touchstart', (e) => {
            e.preventDefault();
            const key = e.target.closest('.key');
            if (key) {
                this.handleKeyPress(key.dataset.note, key.dataset.isBlack === 'true');
            }
        });

        document.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleKeyRelease();
        });

        // Computer keyboard events
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (this.keyMapping[key] && !this.activeKeys.has(key)) {
                e.preventDefault();
                const mapping = this.keyMapping[key];
                this.handleKeyPress(mapping.note, mapping.isBlack, key);
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (this.keyMapping[key]) {
                e.preventDefault();
                this.handleKeyRelease(key);
            }
        });
    }

    // Handle key press
    handleKeyPress(note, isBlack, keyChar = null) {
        const octave = this.audioEngine.octave;
        const noteId = `${note}-${octave}`;
        
        if (this.activeKeys.has(noteId)) return;

        this.activeKeys.add(noteId);
        this.audioEngine.playNote(note, octave);
        
        // Visual feedback
        const keys = document.querySelectorAll(`.key[data-note="${note}"]`);
        keys.forEach(key => {
            if ((isBlack && key.classList.contains('black')) ||
                (!isBlack && key.classList.contains('white'))) {
                key.classList.add('active');
            }
        });
    }

    // Handle key release
    handleKeyRelease(keyChar = null) {
        if (keyChar) {
            // Release specific key
            const mapping = this.keyMapping[keyChar];
            if (mapping) {
                const noteId = `${mapping.note}-${this.audioEngine.octave}`;
                if (this.activeKeys.has(noteId)) {
                    this.activeKeys.delete(noteId);
                    this.audioEngine.stopNote(mapping.note, this.audioEngine.octave);
                    
                    // Remove visual feedback
                    const keys = document.querySelectorAll(`.key[data-note="${mapping.note}"]`);
                    keys.forEach(key => {
                        if ((mapping.isBlack && key.classList.contains('black')) ||
                            (!mapping.isBlack && key.classList.contains('white'))) {
                            key.classList.remove('active');
                        }
                    });
                }
            }
        } else {
            // Release all keys (mouse/touch)
            this.activeKeys.forEach(noteId => {
                const [note, octave] = noteId.split('-');
                this.audioEngine.stopNote(note, parseInt(octave));
                
                // Remove visual feedback
                const keys = document.querySelectorAll(`.key[data-note="${note}"]`);
                keys.forEach(key => {
                    key.classList.remove('active');
                });
            });
            this.activeKeys.clear();
        }
    }
}

// Control Panel Manager
class ControlPanel {
    constructor(audioEngine) {
        this.audioEngine = audioEngine;
        this.initControls();
    }

    initControls() {
        // Waveform selector
        const waveformSelect = document.getElementById('waveform');
        waveformSelect.addEventListener('change', (e) => {
            this.audioEngine.setWaveform(e.target.value);
        });

        // Volume slider
        const volumeSlider = document.getElementById('volume');
        const volumeValue = document.getElementById('volume-value');
        volumeSlider.addEventListener('input', (e) => {
            const volume = e.target.value / 100;
            this.audioEngine.setVolume(volume);
            volumeValue.textContent = `${e.target.value}%`;
        });

        // Octave slider
        const octaveSlider = document.getElementById('octave');
        const octaveValue = document.getElementById('octave-value');
        octaveSlider.addEventListener('input', (e) => {
            const octave = parseInt(e.target.value);
            this.audioEngine.setOctave(octave);
            octaveValue.textContent = octave;
        });

        // Attack slider
        const attackSlider = document.getElementById('attack');
        const attackValue = document.getElementById('attack-value');
        attackSlider.addEventListener('input', (e) => {
            const attack = parseInt(e.target.value);
            this.audioEngine.setAttack(attack);
            attackValue.textContent = `${attack}ms`;
        });

        // Release slider
        const releaseSlider = document.getElementById('release');
        const releaseValue = document.getElementById('release-value');
        releaseSlider.addEventListener('input', (e) => {
            const release = parseInt(e.target.value);
            this.audioEngine.setRelease(release);
            releaseValue.textContent = `${release}ms`;
        });
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    const audioEngine = new AudioEngine();
    const keyboardManager = new KeyboardManager(audioEngine);
    const controlPanel = new ControlPanel(audioEngine);

    // Handle page visibility change (pause audio when tab is hidden)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            audioEngine.stopAllNotes();
        }
    });
});

