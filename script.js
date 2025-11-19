// Audio Engine
class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.activeNotes = new Map(); // Track active oscillators
        this.waveform = 'sine';
        this.volume = 0.5;
        this.octave = 2; // Base octave (will show 5 octaves: 2, 3, 4, 5, 6)
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
        this.activeMouseKeys = new Map(); // Track mouse/touch pressed keys
        
        this.initKeyboard();
        this.initEventListeners();
    }

    // Create QWERTY to note mapping for middle 3 octaves of 5 displayed
    createKeyMapping() {
        // Maps to middle 3 octaves (offsets -1, 0, 1 from center)
        // Lower octave: Q-P and [ ] for white, 1-0 and - = for black
        // Middle octave: A-; and ' for white
        // Upper octave: Z-/ for white
        return {
            // Octave 1 (lowest) - White keys: Q W E R T Y U I O P [ ]
            'q': { note: 'C', isBlack: false, octaveOffset: -1 },
            'w': { note: 'D', isBlack: false, octaveOffset: -1 },
            'e': { note: 'E', isBlack: false, octaveOffset: -1 },
            'r': { note: 'F', isBlack: false, octaveOffset: -1 },
            't': { note: 'G', isBlack: false, octaveOffset: -1 },
            'y': { note: 'A', isBlack: false, octaveOffset: -1 },
            'u': { note: 'B', isBlack: false, octaveOffset: -1 },
            'i': { note: 'C', isBlack: false, octaveOffset: 0 },
            'o': { note: 'D', isBlack: false, octaveOffset: 0 },
            'p': { note: 'E', isBlack: false, octaveOffset: 0 },
            '[': { note: 'F', isBlack: false, octaveOffset: 0 },
            ']': { note: 'G', isBlack: false, octaveOffset: 0 },
            // Octave 1 - Black keys: 1 2 4 5 6 8 9 0 - =
            '1': { note: 'C#', isBlack: true, octaveOffset: -1 },
            '2': { note: 'D#', isBlack: true, octaveOffset: -1 },
            '4': { note: 'F#', isBlack: true, octaveOffset: -1 },
            '5': { note: 'G#', isBlack: true, octaveOffset: -1 },
            '6': { note: 'A#', isBlack: true, octaveOffset: -1 },
            '8': { note: 'C#', isBlack: true, octaveOffset: 0 },
            '9': { note: 'D#', isBlack: true, octaveOffset: 0 },
            '0': { note: 'F#', isBlack: true, octaveOffset: 0 },
            '-': { note: 'G#', isBlack: true, octaveOffset: 0 },
            '=': { note: 'A#', isBlack: true, octaveOffset: 0 },
            // Octave 2 (middle) - White keys: A S D F G H J K L ; '
            'a': { note: 'C', isBlack: false, octaveOffset: 0 },
            's': { note: 'D', isBlack: false, octaveOffset: 0 },
            'd': { note: 'E', isBlack: false, octaveOffset: 0 },
            'f': { note: 'F', isBlack: false, octaveOffset: 0 },
            'g': { note: 'G', isBlack: false, octaveOffset: 0 },
            'h': { note: 'A', isBlack: false, octaveOffset: 0 },
            'j': { note: 'B', isBlack: false, octaveOffset: 0 },
            'k': { note: 'C', isBlack: false, octaveOffset: 1 },
            'l': { note: 'D', isBlack: false, octaveOffset: 1 },
            ';': { note: 'E', isBlack: false, octaveOffset: 1 },
            "'": { note: 'F', isBlack: false, octaveOffset: 1 },
            // Octave 2 - Black keys: Use backslash and other available keys
            '\\': { note: 'C#', isBlack: true, octaveOffset: 0 },
            // Note: W, E, T, Y, U are already used for octave 1, so we'll handle octave 2 black keys via mouse/touch
            // For keyboard, users can use number row with shift or we'll map some keys
            // Octave 3 (highest) - White keys: Z X C V B N M , . /
            'z': { note: 'C', isBlack: false, octaveOffset: 1 },
            'x': { note: 'D', isBlack: false, octaveOffset: 1 },
            'c': { note: 'E', isBlack: false, octaveOffset: 1 },
            'v': { note: 'F', isBlack: false, octaveOffset: 1 },
            'b': { note: 'G', isBlack: false, octaveOffset: 1 },
            'n': { note: 'A', isBlack: false, octaveOffset: 1 },
            'm': { note: 'B', isBlack: false, octaveOffset: 1 },
            ',': { note: 'C', isBlack: false, octaveOffset: 2 },
            '.': { note: 'D', isBlack: false, octaveOffset: 2 },
            '/': { note: 'E', isBlack: false, octaveOffset: 2 }
            // Note: Black keys for octave 2 and 3 can be played via mouse/touch on the visual keyboard
        };
    }

    // Initialize keyboard UI - 3 octaves
    initKeyboard() {
        const keyboard = document.getElementById('keyboard');
        keyboard.innerHTML = '';

        // Define one octave layout
        const oneOctaveLayout = [
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
        const numOctaves = 5; // Show 5 octaves = 60 keys (36 white + 24 black)
        let globalWhiteKeyIndex = 0;

        // Get base octave from audio engine
        const baseOctave = this.audioEngine.octave;

        // Create 3 octaves (baseOctave, baseOctave+1, baseOctave+2)
        for (let octaveIndex = 0; octaveIndex < numOctaves; octaveIndex++) {
            const actualOctave = baseOctave + octaveIndex;
            oneOctaveLayout.forEach((keyInfo) => {
                const key = document.createElement('div');
                key.className = `key ${keyInfo.isBlack ? 'black' : 'white'}`;
                key.dataset.note = keyInfo.note;
                key.dataset.isBlack = keyInfo.isBlack.toString();
                key.dataset.octave = actualOctave.toString(); // Store actual octave number (0-6)
                
                // Add label with keyboard shortcut
                const label = document.createElement('div');
                label.className = 'key-label';
                
                // Find key mapping for this note and octave position
                // octaveIndex 0-4 (5 octaves displayed)
                // Middle 3 octaves have keyboard mappings: -1, 0, 1 offsets
                // Outer octaves can be played via mouse/touch
                const noteOctave = octaveIndex - 2; // Center on middle octave
                const keyChar = Object.keys(this.keyMapping).find(
                    k => {
                        const mapping = this.keyMapping[k];
                        return mapping.note === keyInfo.note && 
                               mapping.isBlack === keyInfo.isBlack &&
                               mapping.octaveOffset === noteOctave;
                    }
                );
                
                // Show key label if found
                if (keyChar) {
                    label.textContent = keyChar.toUpperCase();
                } else {
                    label.textContent = '';
                }
                key.appendChild(label);

                // Position black keys absolutely
                if (keyInfo.isBlack) {
                    // Position black key between the previous and next white key
                    const leftPosition = (globalWhiteKeyIndex * whiteKeyWidth) + (whiteKeyWidth / 2) - (blackKeyWidth / 2);
                    key.style.left = `${leftPosition}px`;
                } else {
                    globalWhiteKeyIndex++;
                }

                keyboard.appendChild(key);
            });
        }
    }

    // Initialize event listeners
    initEventListeners() {
        // Mouse events
        document.getElementById('keyboard').addEventListener('mousedown', (e) => {
            const key = e.target.closest('.key');
            if (key) {
                const octave = parseInt(key.dataset.octave); // Already the actual octave number
                const noteId = `${key.dataset.note}-${octave}`;
                this.activeMouseKeys.set(key, noteId);
                this.handleKeyPress(key.dataset.note, key.dataset.isBlack === 'true', null, octave, key);
            }
        });

        document.addEventListener('mouseup', () => {
            this.handleMouseKeyRelease();
        });

        // Touch events
        document.getElementById('keyboard').addEventListener('touchstart', (e) => {
            e.preventDefault();
            const key = e.target.closest('.key');
            if (key) {
                const octave = parseInt(key.dataset.octave); // Already the actual octave number
                const noteId = `${key.dataset.note}-${octave}`;
                this.activeMouseKeys.set(key, noteId);
                this.handleKeyPress(key.dataset.note, key.dataset.isBlack === 'true', null, octave, key);
            }
        });

        document.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleMouseKeyRelease();
        });

        // Computer keyboard events
        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (this.keyMapping[key] && !this.activeKeys.has(key)) {
                e.preventDefault();
                const mapping = this.keyMapping[key];
                const octave = this.audioEngine.octave + (mapping.octaveOffset || 0);
                this.handleKeyPress(mapping.note, mapping.isBlack, key, octave);
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
    handleKeyPress(note, isBlack, keyChar = null, octave = null, keyElement = null) {
        if (octave === null) {
            octave = this.audioEngine.octave;
        }
        const noteId = keyChar ? keyChar : `${note}-${octave}`;
        
        if (this.activeKeys.has(noteId)) return;

        this.activeKeys.add(noteId);
        this.audioEngine.playNote(note, octave);
        
        // Visual feedback - target specific key if provided, otherwise all matching keys
        if (keyElement) {
            keyElement.classList.add('active');
        } else {
            // Find keys matching note and octave
            const keys = document.querySelectorAll(`.key[data-note="${note}"][data-octave="${octave}"]`);
            keys.forEach(key => {
                if ((isBlack && key.classList.contains('black')) ||
                    (!isBlack && key.classList.contains('white'))) {
                    key.classList.add('active');
                }
            });
        }
    }

    // Handle key release
    handleKeyRelease(keyChar = null) {
        if (keyChar) {
            // Release specific key
            const mapping = this.keyMapping[keyChar];
            if (mapping) {
                const octave = this.audioEngine.octave + (mapping.octaveOffset || 0);
                const noteId = keyChar;
                if (this.activeKeys.has(noteId)) {
                    this.activeKeys.delete(noteId);
                    this.audioEngine.stopNote(mapping.note, octave);
                    
                    // Remove visual feedback
                    const keys = document.querySelectorAll(`.key[data-note="${mapping.note}"][data-octave="${octave}"]`);
                    keys.forEach(key => {
                        if ((mapping.isBlack && key.classList.contains('black')) ||
                            (!mapping.isBlack && key.classList.contains('white'))) {
                            key.classList.remove('active');
                        }
                    });
                }
            }
        }
    }

    // Handle mouse/touch key release
    handleMouseKeyRelease() {
        this.activeMouseKeys.forEach((noteId, keyElement) => {
            if (this.activeKeys.has(noteId)) {
                const [note, octave] = noteId.split('-');
                this.activeKeys.delete(noteId);
                this.audioEngine.stopNote(note, parseInt(octave));
                keyElement.classList.remove('active');
            }
        });
        this.activeMouseKeys.clear();
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
            const baseOctave = parseInt(e.target.value);
            this.audioEngine.setOctave(baseOctave);
            octaveValue.textContent = `${baseOctave}-${baseOctave + 4}`;
            // Regenerate keyboard to show new octave range
            if (window.keyboardManager) {
                window.keyboardManager.initKeyboard();
            }
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
    window.keyboardManager = keyboardManager; // Make accessible for octave changes
    const controlPanel = new ControlPanel(audioEngine);

    // Handle page visibility change (pause audio when tab is hidden)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            audioEngine.stopAllNotes();
        }
    });
});

