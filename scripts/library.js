import { detectBPM } from './bpm.js';
// ==================== GLOBAL STATE ====================
window.djState = {
    songs: [],
    leftAudio: null,
    rightAudio: null,
    leftPitchRate: 1.0,
    rightPitchRate: 1.0,
    hotCues: { left: [null, null, null, null], right: [null, null, null, null] }
};

const dbName = "DJAppDB";
const storeName = "songs";

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: "id" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// ==================== CLEAR DB ON LOAD ====================
async function clearDatabase() {
    try {
        const db = await openDB();
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        await store.clear();
        console.log('Database cleared on load');
    } catch (error) {
        console.error('Error clearing database:', error);
    }
}

// ==================== FILE HANDLING ====================
window.handleFiles = function (files, isFirstRun = false) {
    const preview = document.getElementById('song-preview');
    const doneBtn = document.getElementById('done-btn');

    Array.from(files).forEach(file => {
        if (file.type.startsWith('audio/')) {
            const reader = new FileReader();

            reader.onload = async function (e) {
                const song = {
                    id: Date.now() + Math.random(),
                    name: file.name.replace(/\.[^/.]+$/, ''),
                    data: e.target.result,
                    type: file.type
                };
                await saveSongToDB(song);
                window.djState.songs.push(song);

                if (isFirstRun && preview) {
                    const item = document.createElement('div');
                    item.className = 'song-list-item';
                    item.textContent = `✓ ${song.name}`;
                    preview.appendChild(item);
                }

                if (isFirstRun && doneBtn && window.djState.songs.length > 0) {
                    doneBtn.style.display = 'block';
                }

                if (!isFirstRun) {
                    renderLibrary();
                }
            };

            reader.readAsDataURL(file);
        }
    });
};

// ==================== STORAGE ====================
async function saveSongToDB(song) {
    const db = await openDB();
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    store.put(song);
    return tx.complete;
}

async function loadSongsFromStorage() {
    // DON'T load songs from IndexedDB - start fresh every time
    window.djState.songs = [];
    renderLibrary();
}

// ==================== RENDER LIBRARY ====================
window.renderLibrary = function () {
    const list = document.getElementById('song-list');
    const empty = document.getElementById('empty-state');

    if (!list || !empty) return;

    if (window.djState.songs.length === 0) {
        list.style.display = 'none';
        empty.style.display = 'block';
        return;
    }

    list.style.display = 'block';
    empty.style.display = 'none';
    list.innerHTML = '';

    window.djState.songs.forEach(song => {
        const item = document.createElement('div');
        item.className = 'song-list-item';
        item.innerHTML = `
            <div class="song-list-name">${song.name}</div>
            <div class="song-list-actions">
                <button class="load-deck-btn load-deck-a" onclick="loadSong('${song.id}', 'left')">
                    Deck A
                </button>
                <button class="load-deck-btn load-deck-b" onclick="loadSong('${song.id}', 'right')">
                    Deck B
                </button>
            </div>
        `;
        list.appendChild(item);
    });
};

// ==================== LOAD SONG (FIXED) ====================
window.loadSong = function (songId, deck) {
    const song = window.djState.songs.find(s => s.id == songId);
    if (!song) {
        console.error('Song not found:', songId);
        return;
    }

    console.log(`Loading song: ${song.name} on ${deck} deck`);

    const oldAudio = deck === 'left' ? window.djState.leftAudio : window.djState.rightAudio;
    if (oldAudio) {
        oldAudio.pause();
        oldAudio.src = '';
        if (oldAudio._blobUrl) {
            URL.revokeObjectURL(oldAudio._blobUrl);
        }
    }

    let blob;
    if (typeof song.data === 'string') {
        const base64Data = song.data.split(',')[1];
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: song.type || 'audio/mpeg' });
        console.log(`Created blob from base64, size: ${blob.size}, type: ${blob.type}`);
    } else if (song.data instanceof Blob) {
        blob = song.data;
        console.log(`Using existing blob, size: ${blob.size}, type: ${blob.type}`);
    } else {
        console.error('Unsupported song data type:', song.data);
        return;
    }

    const blobUrl = URL.createObjectURL(blob);
    const audio = new Audio();
    audio.song = song;
    audio.muted = false;
    audio.volume = 1.0;
    audio._blobUrl = blobUrl;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';

    console.log('Created blob URL:', blobUrl);

    audio.addEventListener('error', (e) => {
        console.error('Audio error event:', {
            error: audio.error,
            code: audio.error?.code,
            message: audio.error?.message,
            src: audio.src
        });
        alert(`Failed to load audio: ${audio.error?.message || 'Unknown error'}`);
    });

    audio.addEventListener('canplay', () => {
        console.log(`Audio can play: ${song.name}`);
    });

    audio.addEventListener('loadedmetadata', () => {
        console.log(`Metadata loaded: ${song.name}, duration: ${audio.duration}s`);
    });

    audio.src = blobUrl;

    if (deck === 'left') {
        window.djState.leftAudio = audio;
        audio.playbackRate = window.djState.leftPitchRate;
        audio.volume = document.getElementById('left-volume').value / 100;
        document.getElementById('left-song').textContent = song.name;
        document.getElementById('left-deck').classList.add('active');
        document.getElementById('right-deck').classList.remove('active');
        window.djState.hotCues.left = [null, null, null, null];
        document.querySelectorAll('#left-deck .hot-cue').forEach(btn => btn.classList.remove('cue-set'));
    } else {
        window.djState.rightAudio = audio;
        audio.playbackRate = window.djState.rightPitchRate;
        audio.volume = document.getElementById('right-volume').value / 100;
        document.getElementById('right-song').textContent = song.name;
        document.getElementById('right-deck').classList.add('active');
        document.getElementById('left-deck').classList.remove('active');
        window.djState.hotCues.right = [null, null, null, null];
        document.querySelectorAll('#right-deck .hot-cue').forEach(btn => btn.classList.remove('cue-set'));
    }

    setupAudioEvents(deck);
    audio.load();

    // BPM Detection
    audio.addEventListener('canplaythrough', async () => {
        try {
            const bpm = await detectBPM(blob); // <-- pass the Blob directly

            if (bpm != null) {
                document.getElementById(`${deck}-bpm`).textContent = `BPM: ${bpm}`;
                console.log(`Detected BPM for ${song.name}: ${bpm}`);
            } else {
                document.getElementById(`${deck}-bpm`).textContent = `BPM: N/A`;
                console.warn(`BPM detection returned null for ${song.name}`);
            }
        } catch (err) {
            console.error('BPM detection error:', err);
            document.getElementById(`${deck}-bpm`).textContent = `BPM: N/A`;
        }
    });


    console.log(`Loaded: ${song.name} on ${deck} deck, readyState: ${audio.readyState}`);
    document.getElementById('crossfader').dispatchEvent(new Event('input'));
};

// ==================== AUDIO EVENTS + WAVEFORM ====================
function setupAudioEvents(deck) {
    const audio = deck === 'left' ? window.djState.leftAudio : window.djState.rightAudio;

    audio.addEventListener('loadedmetadata', () => {
        document.getElementById(`${deck}-duration`).textContent = formatTime(audio.duration);
        drawWaveform(deck, audio);
    });

    audio.addEventListener('timeupdate', () => {
        const percent = (audio.currentTime / audio.duration) * 100;
        document.getElementById(`${deck}-progress`).style.width = percent + '%';
        document.getElementById(`${deck}-current`).textContent = formatTime(audio.currentTime);
        updateWaveformPosition(deck, audio);
    });

    audio.addEventListener('ended', () => {
        const playBtn = document.getElementById(`${deck}-play`);
        playBtn.classList.remove('playing');
        playBtn.textContent = '▶';
    });
}

// ==================== WAVEFORM DRAWING (VERTICAL) ====================
async function drawWaveform(deck, audio) {
    const canvas = document.getElementById(`${deck}-waveform`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    try {
        const song = audio.song;
        if (!song || !song.data) return;

        let arrayBuffer;

        if (typeof song.data === 'string') {
            const base64Data = song.data.split(',')[1];
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            arrayBuffer = bytes.buffer;
        } else if (song.data instanceof Blob) {
            arrayBuffer = await song.data.arrayBuffer();
        } else {
            console.error('Unsupported song data type:', song.data);
            return;
        }

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const channelData = audioBuffer.getChannelData(0);
        const samples = height;
        const blockSize = Math.floor(channelData.length / samples);

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);

        // Draw waveform vertically (bottom to top)
        ctx.fillStyle = '#3FAEFD';

        for (let i = 0; i < samples; i++) {
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(channelData[i * blockSize + j]);
            }
            const average = sum / blockSize;
            const barWidth = average * width;
            const y = height - i; // Draw from bottom to top

            ctx.fillRect((width - barWidth) / 2, y, barWidth, 1);
        }

        if (!window.waveformData) window.waveformData = {};
        window.waveformData[deck] = { canvas, ctx, width, height, channelData, blockSize };

    } catch (error) {
        console.error('Waveform error:', error);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
    }
}

function updateWaveformPosition(deck, audio) {
    const data = window.waveformData?.[deck];
    if (!data) return;

    const { canvas, ctx, width, height, channelData, blockSize } = data;
    const progress = audio.currentTime / audio.duration;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    const samples = height;

    // Draw waveform
    ctx.fillStyle = '#3FAEFD';

    for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j] || 0);
        }
        const average = sum / blockSize;
        const barWidth = average * width;
        const y = height - i;

        ctx.fillRect((width - barWidth) / 2, y, barWidth, 1);
    }

    // Draw playhead (horizontal line showing position)
    const playheadY = height - (progress * height);
    ctx.fillStyle = '#FF8C00';
    ctx.fillRect(0, playheadY, width, 3);

    // Highlight played portion
    ctx.fillStyle = 'rgba(255, 140, 0, 0.2)';
    ctx.fillRect(0, playheadY, width, height - playheadY);
}

function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

// ==================== SONG SEARCH ====================
function initSongSearch() {
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('song-search');
    const resultsDiv = document.getElementById('search-results');

    if (!searchBtn || !searchInput) return;

    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    function performSearch() {
        const query = searchInput.value.trim();
        if (!query) return;

        resultsDiv.innerHTML = '<div style="color: #3FAEFD; padding: 1rem;">Searching...</div>';

        setTimeout(() => {
            resultsDiv.innerHTML = `
                <div style="color: #FF8C00; padding: 0.5rem; font-size: 0.9rem; margin-bottom: 0.5rem;">
                    💡 Search results for "${query}"<br>
                    <small style="color: #666;">Remember to download the MP3 and add it to your crate!</small>
                </div>
                <div class="search-result-item" onclick="window.open('https://www.google.com/search?q=${encodeURIComponent(query + ' mp3 download')}', '_blank')">
                    <div class="search-result-title">🔗 Search Google for MP3</div>
                    <div class="search-result-artist">Find and download "${query}"</div>
                </div>
                <div class="search-result-item" onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent(query)}', '_blank')">
                    <div class="search-result-title">🎥 Search YouTube</div>
                    <div class="search-result-artist">Listen to "${query}" on YouTube</div>
                </div>
            `;
        }, 500);
    }
}

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Clear database on every load to start fresh
    await clearDatabase();

    // Clear songs array and render empty library
    window.djState.songs = [];
    renderLibrary();

    initSongSearch();

    const libraryInput = document.getElementById('library-input');
    if (libraryInput) {
        libraryInput.addEventListener('change', (e) => {
            window.handleFiles(e.target.files);
        });
    }
});