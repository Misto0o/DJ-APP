// ==================== MP3 DOWNLOADER ====================
const API_URL = 'http://localhost:5000/api';

let currentDownloadId = null;
let progressTimer = null;

// ==================== START DOWNLOAD ====================
window.startYTDownload = async function () {
    const url = document.getElementById('yt-url').value.trim();
    if (!url) return alert('Paste a YouTube URL');

    resetDownloadUI();

    const btn = document.getElementById('download-btn');
    btn.disabled = true;
    btn.textContent = 'Downloading…';

    document.getElementById('download-progress').style.display = 'block';
    updateProgress(0, 'Starting…');

    const res = await fetch(`${API_URL}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });

    const data = await res.json();
    currentDownloadId = data.download_id;

    progressTimer = setInterval(checkProgress, 500);
};

// ==================== CHECK PROGRESS ====================
async function checkProgress() {
    const res = await fetch(`${API_URL}/progress/${currentDownloadId}`);
    const data = await res.json();

    if (data.status === 'downloading' || data.status === 'starting') {
        updateProgress(data.percentage || 0, data.title || 'Downloading…');
    }

    if (data.status === 'complete') {
        clearInterval(progressTimer);
        updateProgress(100, data.title);
        document.getElementById('download-complete').style.display = 'block';
        document.getElementById('download-btn').disabled = false;
        document.getElementById('download-btn').textContent = 'Download';
    }

    if (data.status === 'error') {
        clearInterval(progressTimer);
        alert(data.error);
        resetDownloadUI();
    }
}

// ==================== ADD TO DJ CRATE ====================
window.addDownloadedTrack = async function () {
    if (!currentDownloadId) return;

    const res = await fetch(`${API_URL}/file/${currentDownloadId}`);
    const blob = await res.blob();

    let filename = 'track.mp3';
    const cd = res.headers.get('Content-Disposition');
    if (cd) {
        const match = cd.match(/filename="?(.+)"?/);
        if (match) filename = decodeURIComponent(match[1]);
    }

    const song = {
        id: Date.now(),
        name: filename.replace('.mp3', ''),
        type: 'audio/mpeg',
        data: blob
    };

    window.djState.songs.push(song);

    if (window.saveSongToDB) {
        const reader = new FileReader();
        reader.onload = e => {
            song.data = e.target.result;
            saveSongToDB(song);
        };
        reader.readAsDataURL(blob);
    }

    if (window.renderLibrary) renderLibrary();

    resetDownloadUI();
};

// ==================== UI HELPERS ====================
function updateProgress(percent, text) {
    document.getElementById('download-fill').style.width = percent + '%';
    document.getElementById('download-percent').textContent = percent + '%';
    document.getElementById('download-status').textContent = text;
}

function resetDownloadUI() {
    clearInterval(progressTimer);
    document.getElementById('download-progress').style.display = 'none';
    document.getElementById('download-complete').style.display = 'none';
    document.getElementById('download-btn').disabled = false;
    document.getElementById('download-btn').textContent = 'Download';
    currentDownloadId = null;
}
