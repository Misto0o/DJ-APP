export async function detectBPM(file) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Analyze first 30 seconds for better accuracy
    const timeWindow = 30;
    const samplesPerWindow = Math.min(sampleRate * timeWindow, audioBuffer.length);
    
    // --- STEP 1: Calculate energy in small windows ---
    const windowSize = 1024; // ~23ms at 44.1kHz
    const hopSize = 512;
    const energyArray = [];
    
    for (let i = 0; i < samplesPerWindow; i += hopSize) {
        let sum = 0;
        for (let j = 0; j < windowSize && i + j < samplesPerWindow; j++) {
            sum += channelData[i + j] ** 2;
        }
        energyArray.push(sum / windowSize);
    }
    
    // --- STEP 2: Find peaks in energy with minimum spacing ---
    const minBeatInterval = Math.floor((60 / 200) * sampleRate / hopSize); // Max 200 BPM
    const peaks = [];
    const threshold = Math.max(...energyArray) * 0.3; // 30% of max energy
    
    for (let i = 1; i < energyArray.length - 1; i++) {
        if (energyArray[i] > threshold &&
            energyArray[i] > energyArray[i - 1] &&
            energyArray[i] > energyArray[i + 1]) {
            
            // Check if enough time has passed since last peak
            if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minBeatInterval) {
                peaks.push(i);
            }
        }
    }
    
    // --- STEP 3: Calculate intervals between peaks ---
    if (peaks.length < 2) {
        audioCtx.close();
        return null;
    }
    
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
        intervals.push(peaks[i] - peaks[i - 1]);
    }
    
    // Get median interval (more robust than average)
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];
    
    // Convert to BPM
    const secondsPerBeat = (medianInterval * hopSize) / sampleRate;
    const bpm = Math.round(60 / secondsPerBeat);
    
    audioCtx.close();
    
    // Sanity check: typical music is 60-180 BPM
    if (bpm < 60 || bpm > 300) {
        return null;
    }
    
    return bpm;
}