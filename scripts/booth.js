// ==================== SCRATCH STATE ====================
let scratchState = {
    isDragging: false,
    lastAngle: 0,
    deck: null
};

let jogWheelState = {
    left: { currentRotation: 0 },
    right: { currentRotation: 0 }
};

let cachedRects = { left: null, right: null };
let lastUpdateTime = 0;
const UPDATE_INTERVAL = 16; // ~60fps

// ==================== KEYBOARD CONTROLS ====================
document.addEventListener('keydown', (e) => {
    const code = e.code;
    const key = e.key.toLowerCase();

    /* ================= HOT CUES ================= */

    // Digit keys only (1–8)
    if (code.startsWith('Digit')) {
        const num = parseInt(code.replace('Digit', ''));
        if (num >= 1 && num <= 8) {
            e.preventDefault();

            // ===== SET CUES =====
            if (e.shiftKey) {
                // Deck A (1–4)
                if (num >= 1 && num <= 4) {
                    const i = num - 1;
                    const audio = window.djState.leftAudio;
                    const btn = document.querySelector(
                        `#left-deck .hot-cue[data-cue="${i}"]`
                    );

                    if (audio && btn) {
                        window.djState.hotCues.left[i] = audio.currentTime;
                        btn.classList.add('cue-set');
                        console.log(`Set hot cue ${num} on DECK A`);
                    }
                }

                // Deck B (5–8)
                if (num >= 5 && num <= 8) {
                    const i = num - 5;
                    const audio = window.djState.rightAudio;
                    const btn = document.querySelector(
                        `#right-deck .hot-cue[data-cue="${i}"]`
                    );

                    if (audio && btn) {
                        window.djState.hotCues.right[i] = audio.currentTime;
                        btn.classList.add('cue-set');
                        console.log(`Set hot cue ${num} on DECK B`);
                    }
                }

                return;
            }

            // ===== JUMP TO CUES =====
            if (num >= 1 && num <= 4) {
                const i = num - 1;
                const audio = window.djState.leftAudio;
                const t = window.djState.hotCues.left[i];
                if (audio && t != null) audio.currentTime = t;
            }

            if (num >= 5 && num <= 8) {
                const i = num - 5;
                const audio = window.djState.rightAudio;
                const t = window.djState.hotCues.right[i];
                if (audio && t != null) audio.currentTime = t;
            }

            return;
        }
    }

    /* ================= ESC - EXIT STICKY MODE ================= */
    if (key === 'escape') {
        ['left', 'right'].forEach(deck => {
            if (jogWheelState[deck].isSticky) {
                jogWheelState[deck].isSticky = false;
                scratchState.isDragging = false;

                const jogWheel = document.getElementById(`${deck}-jog`);
                if (jogWheel) {
                    jogWheel.style.borderColor = "#3FAEFD";
                    jogWheel.style.boxShadow = "0 0 20px rgba(63, 174, 253, 0.5)";

                    const audio = deck === 'left' ? window.djState.leftAudio : window.djState.rightAudio;
                    if (audio && !audio.paused) {
                        gsap.to(jogWheel, { rotation: "+=360", duration: 2, repeat: -1, ease: "none" });
                    }
                }
            }
        });
        return;
    }

    /* ================= PLAYBACK ================= */

    // Space = Play / Pause active deck
    if (key === ' ') {
        e.preventDefault();
        const leftActive = document.getElementById('left-deck').classList.contains('active');
        const rightActive = document.getElementById('right-deck').classList.contains('active');

        if (leftActive) togglePlay('left');
        else if (rightActive) togglePlay('right');
        return;
    }

    // Q / P = Cue
    if (key === 'q') {
        e.preventDefault();
        cue('left');
        return;
    }

    if (key === 'p') {
        e.preventDefault();
        cue('right');
        return;
    }

    /* ================= CROSSFADER ================= */

    if (key === 'a') {
        e.preventDefault();
        const f = document.getElementById('crossfader');
        f.value = Math.max(0, f.value - 10);
        f.dispatchEvent(new Event('input'));
        return;
    }

    if (key === 'd') {
        e.preventDefault();
        const f = document.getElementById('crossfader');
        f.value = Math.min(100, Number(f.value) + 10);
        f.dispatchEvent(new Event('input'));
        return;
    }
});

// ==================== PLAY / PAUSE ====================
function togglePlay(deck) {
    const audio = deck === 'left' ? window.djState.leftAudio : window.djState.rightAudio;
    const playBtn = document.getElementById(`${deck}-play`);
    const jogWheel = document.getElementById(`${deck}-jog`);
    const deckEl = document.getElementById(`${deck}-deck`);

    if (!audio) {
        alert('Load a track first!');
        return;
    }

    if (audio.paused) {
        if (audio.readyState < 2) {
            alert('Track is still loading, please wait...');
            return;
        }

        if (window.AudioContext || window.webkitAudioContext) {
            const ctx = window._unlockCtx ??= new (window.AudioContext || window.webkitAudioContext)();
            ctx.resume();
        }

        const playPromise = audio.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    playBtn.classList.add('playing');
                    playBtn.textContent = '⏸';

                    // Don't rotate if sticky mode is active
                    if (!jogWheelState[deck].isSticky) {
                        gsap.to(jogWheel, {
                            rotation: "+=360",
                            duration: 2,
                            repeat: -1,
                            ease: "none"
                        });
                    }

                    gsap.to(deckEl, {
                        boxShadow: "0 0 50px #FF3860",
                        duration: 0.5
                    });
                })
                .catch(err => {
                    console.error('Playback error:', err);
                    alert('Error playing audio: ' + err.message);
                });
        }
    } else {
        audio.pause();
        playBtn.classList.remove('playing');
        playBtn.textContent = '▶';

        gsap.killTweensOf(jogWheel);

        gsap.to(deckEl, {
            boxShadow: deckEl.classList.contains('active') ?
                "0 0 40px #FF8C00" : "0 0 30px #3FAEFD",
            duration: 0.5
        });
    }
}

// ==================== CUE ====================
function cue(deck) {
    const audio = deck === 'left' ? window.djState.leftAudio : window.djState.rightAudio;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;

    const playBtn = document.getElementById(`${deck}-play`);
    playBtn.classList.remove('playing');
    playBtn.textContent = '▶';

    const jogWheel = document.getElementById(`${deck}-jog`);
    gsap.killTweensOf(jogWheel);
    gsap.to(jogWheel, { rotation: 0, duration: 0.3 });
}

// ==================== JOG WHEEL ====================
function initJogWheel(deck) {
    const jogWheel = document.getElementById(`${deck}-jog`);
    if (!jogWheel) return;

    function getAngle(e, element) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        return Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    }

    jogWheel.addEventListener('mousedown', (e) => {
        const audio = deck === 'left' ? window.djState.leftAudio : window.djState.rightAudio;
        const playBtn = document.getElementById(`${deck}-play`);
        const deckEl = document.getElementById(`${deck}-deck`);

        if (!audio) return;

        e.preventDefault();

        // Save state and pause audio
        scratchState.wasPlaying = !audio.paused;
        audio.pause();

        // Update UI: Show Play icon and dim deck glow
        if (playBtn) {
            playBtn.textContent = '▶';
            playBtn.classList.remove('playing');
        }
        if (deckEl) {
            gsap.to(deckEl, { boxShadow: "0 0 20px rgba(0,0,0,0.5)", duration: 0.2 });
        }

        scratchState.isDragging = true;
        scratchState.deck = deck;
        scratchState.lastAngle = getAngle(e, jogWheel);
        cachedRects[deck] = jogWheel.getBoundingClientRect();

        gsap.killTweensOf(jogWheel);
        jogWheel.style.borderColor = "#FF3860";
        jogWheel.style.boxShadow = "0 0 30px rgba(255, 56, 96, 0.6)";
    });
}

// ==================== GLOBAL MOUSE HANDLERS ====================
document.addEventListener('mousemove', (e) => {
    if (!scratchState.isDragging || !scratchState.deck) return;

    // Frame-rate limiting
    const now = performance.now();
    if (now - lastUpdateTime < UPDATE_INTERVAL) return;
    lastUpdateTime = now;

    const deck = scratchState.deck;
    const jogWheel = document.getElementById(`${deck}-jog`);
    const audio = (deck === 'left') ? window.djState.leftAudio : window.djState.rightAudio;

    if (!audio || !jogWheel || !cachedRects[deck]) return;

    const rect = cachedRects[deck];
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

    let angleDiff = currentAngle - scratchState.lastAngle;
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;

    // Update Visual Rotation
    jogWheelState[deck].currentRotation += angleDiff;
    jogWheel.style.transform = `rotate(${jogWheelState[deck].currentRotation}deg)`;

    // Audio Scratching Logic
    if (Math.abs(angleDiff) > 0.8) { // Deadzone to prevent micro-stutter lag
        const sensitivity = 0.012;
        audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + (angleDiff * sensitivity)));

        // The "Chirp": Play and Pause immediately to render sound while stopped
        if (audio.paused) {
            audio.play().then(() => audio.pause()).catch(() => { });
        }
    }

    scratchState.lastAngle = currentAngle;
});

// ==================== STOP SCRATCHING FUNCTION ====================
function stopScratch() {
    if (!scratchState.isDragging || !scratchState.deck) return;

    const deck = scratchState.deck;
    const jogWheel = document.getElementById(`${deck}-jog`);
    const audio = (deck === 'left') ? window.djState.leftAudio : window.djState.rightAudio;
    const playBtn = document.getElementById(`${deck}-play`);
    const deckEl = document.getElementById(`${deck}-deck`);

    scratchState.isDragging = false;
    cachedRects[deck] = null;

    if (jogWheel) {
        jogWheel.style.borderColor = "#3FAEFD";
        jogWheel.style.boxShadow = "0 0 20px rgba(63, 174, 253, 0.5)";
    }

    if (scratchState.wasPlaying && audio) {
        audio.play().catch(() => { });

        // Restore UI to "Playing" state
        if (playBtn) {
            playBtn.textContent = '⏸';
            playBtn.classList.add('playing');
        }
        if (deckEl) {
            gsap.to(deckEl, { boxShadow: "0 0 50px #FF3860", duration: 0.5 });
        }

        gsap.to(jogWheel, {
            rotation: "+=360",
            duration: 2,
            repeat: -1,
            ease: "none"
        });
    }

    scratchState.deck = null;
}

// ==================== GLOBAL MOUSE UP ====================
// This stays at the very bottom, outside of any functions
document.addEventListener('mouseup', stopScratch);
// ==================== PITCH CONTROL ====================
function initPitchControl(deck) {
    const pitchSlider = document.getElementById(`${deck}-pitch`);
    const pitchValue = document.getElementById(`${deck}-pitch-value`);

    if (!pitchSlider || !pitchValue) return;

    pitchSlider.addEventListener('input', (e) => {
        const pitchPercent = parseFloat(e.target.value);
        pitchValue.textContent = (pitchPercent >= 0 ? '+' : '') + pitchPercent.toFixed(1) + '%';

        const playbackRate = 1.0 + (pitchPercent / 100);

        if (deck === 'left') {
            window.djState.leftPitchRate = playbackRate;
            if (window.djState.leftAudio) {
                window.djState.leftAudio.playbackRate = playbackRate;
            }
        } else {
            window.djState.rightPitchRate = playbackRate;
            if (window.djState.rightAudio) {
                window.djState.rightAudio.playbackRate = playbackRate;
            }
        }
    });
}

// ==================== PROGRESS BAR SEEKING ====================
function initProgressBar(deck) {
    const progressBar = document.getElementById(`${deck}-deck`)?.querySelector('.progress-bar');

    if (!progressBar) return;

    progressBar.addEventListener('click', (e) => {
        const audio = deck === 'left' ? window.djState.leftAudio : window.djState.rightAudio;
        if (!audio) return;

        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percent = clickX / rect.width;
        audio.currentTime = percent * audio.duration;
    });
}

// ==================== HOT CUES ====================
function initHotCues() {
    document.querySelectorAll('.hot-cue').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const deck = btn.closest('.deck').id.includes('left') ? 'left' : 'right';
            const audio = deck === 'left' ? window.djState.leftAudio : window.djState.rightAudio;

            if (!audio) return;

            const cueIndex = Number(btn.dataset.cue);

            // SHIFT + Click = SET cue point
            if (e.shiftKey) {
                window.djState.hotCues[deck][cueIndex] = audio.currentTime;
                btn.classList.add('cue-set');
                console.log(`Set hot cue ${cueIndex + 1} at ${audio.currentTime.toFixed(2)}s on ${deck} deck`);
                return;
            }

            // Regular Click = JUMP to cue point
            const cueTime = window.djState.hotCues[deck][cueIndex];
            if (cueTime !== null && cueTime !== undefined) {
                audio.currentTime = cueTime;
                console.log(`Jumped to hot cue ${cueIndex + 1} at ${cueTime.toFixed(2)}s on ${deck} deck`);
            }
        });
    });
}

// ==================== SMOOTH TRANSITIONS ====================

// Auto-sync BPM
window.autoSync = function () {
    const leftAudio = window.djState.leftAudio;
    const rightAudio = window.djState.rightAudio;

    if (!leftAudio || !rightAudio) {
        alert('Load tracks on both decks first!');
        return;
    }

    const targetRate = window.djState.leftPitchRate;
    window.djState.rightPitchRate = targetRate;
    rightAudio.playbackRate = targetRate;

    const rightPitch = document.getElementById('right-pitch');
    const rightPitchValue = document.getElementById('right-pitch-value');
    const pitchPercent = (targetRate - 1) * 100;
    rightPitch.value = pitchPercent;
    rightPitchValue.textContent = (pitchPercent >= 0 ? '+' : '') + pitchPercent.toFixed(1) + '%';

    console.log('Deck B synced to Deck A tempo');
};

// Smooth crossfade
window.smoothTransition = function (duration = 8) {
    const crossfader = document.getElementById('crossfader');
    const endValue = 100;

    gsap.to(crossfader, {
        value: endValue,
        duration: duration,
        ease: "power1.inOut",
        onUpdate: () => {
            crossfader.dispatchEvent(new Event('input'));
        },
    });
};

// Quick cut
window.quickCut = function (toDeck) {
    const crossfader = document.getElementById('crossfader');
    if (toDeck === 'left') {
        crossfader.value = 0;
    } else {
        crossfader.value = 100;
    }
    crossfader.dispatchEvent(new Event('input'));
};

// Fade out
window.fadeOut = function (deck, duration = 4) {
    const audio = deck === 'left' ? window.djState.leftAudio : window.djState.rightAudio;
    const volumeSlider = document.getElementById(`${deck}-volume`);

    if (!audio) return;

    // Cancel any previous fade
    if (audio._fadeTween) {
        audio._fadeTween.kill();
    }

    const startVolume = volumeSlider.value;

    audio._fadeTween = gsap.to(volumeSlider, {
        value: 0,
        duration: duration,
        ease: "power2.in",
        onUpdate: function () {
            volumeSlider.dispatchEvent(new Event('input'));
        },
        onComplete: function () {
            volumeSlider.value = startVolume;
            delete audio._fadeTween;
        }
    });
};

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('left-volume').value = 50;
    document.getElementById('right-volume').value = 50;
    document.getElementById('crossfader').value = 0;

    document.getElementById('left-play')?.addEventListener('click', () => togglePlay('left'));
    document.getElementById('right-play')?.addEventListener('click', () => togglePlay('right'));

    document.getElementById('left-cue')?.addEventListener('click', () => cue('left'));
    document.getElementById('right-cue')?.addEventListener('click', () => cue('right'));

    document.getElementById('left-volume')?.addEventListener('input', (e) => {
        if (window.djState.leftAudio) window.djState.leftAudio.volume = e.target.value / 100;
    });

    document.getElementById('right-volume')?.addEventListener('input', (e) => {
        if (window.djState.rightAudio) window.djState.rightAudio.volume = e.target.value / 100;
    });

    document.getElementById('crossfader')?.addEventListener('input', (e) => {
        const value = e.target.value;

        if (window.djState.leftAudio) {
            window.djState.leftAudio.volume = ((100 - value) / 100) *
                (document.getElementById('left-volume').value / 100);
        }

        if (window.djState.rightAudio) {
            window.djState.rightAudio.volume = (value / 100) *
                (document.getElementById('right-volume').value / 100);
        }
    });

    initJogWheel('left');
    initJogWheel('right');
    initPitchControl('left');
    initPitchControl('right');
    initProgressBar('left');
    initProgressBar('right');
    initHotCues();

    console.log(`
    🎧 KEYBOARD SHORTCUTS:
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Hot Cues:
    Shift + 1-8: Set hot cue
    1-8: Jump to hot cue
    
    Playback:
    Space: Play/Pause active deck
    Q: Cue left deck
    P: Cue right deck
    
    Jog Wheel:
    Click and drag: Scratch/Nudge
    Mixing:
    A: Crossfader left
    D: Crossfader right
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
});