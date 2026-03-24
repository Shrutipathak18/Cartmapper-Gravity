/**
 * Converts a Blob (e.g. WebM from MediaRecorder) to a PCM WAV File
 * using the Web Audio API. This ensures the backend speech_recognition
 * library can read it without needing ffmpeg.
 */
export async function convertBlobToWav(blob: Blob, filename: string = 'recording.wav'): Promise<File> {
    const arrayBuffer = await blob.arrayBuffer()
    const audioContext = new AudioContext({ sampleRate: 16000 })

    try {
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

        // Downmix to mono
        const numberOfChannels = 1
        const sampleRate = audioBuffer.sampleRate
        const channelData = audioBuffer.getChannelData(0)

        // Encode to WAV
        const wavBuffer = encodeWav(channelData, sampleRate, numberOfChannels)
        const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' })
        return new File([wavBlob], filename, { type: 'audio/wav' })
    } finally {
        await audioContext.close()
    }
}

function encodeWav(samples: Float32Array, sampleRate: number, numChannels: number): ArrayBuffer {
    // Convert float32 to int16
    const int16Samples = new Int16Array(samples.length)
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]))
        int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }

    const byteRate = sampleRate * numChannels * 2 // 16-bit = 2 bytes
    const blockAlign = numChannels * 2
    const dataSize = int16Samples.length * 2

    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    // RIFF header
    writeString(view, 0, 'RIFF')
    view.setUint32(4, 36 + dataSize, true)
    writeString(view, 8, 'WAVE')

    // fmt sub-chunk
    writeString(view, 12, 'fmt ')
    view.setUint32(16, 16, true)           // Sub-chunk size (16 for PCM)
    view.setUint16(20, 1, true)            // Audio format (1 = PCM)
    view.setUint16(22, numChannels, true)  // Number of channels
    view.setUint32(24, sampleRate, true)   // Sample rate
    view.setUint32(28, byteRate, true)     // Byte rate
    view.setUint16(32, blockAlign, true)   // Block align
    view.setUint16(34, 16, true)           // Bits per sample

    // data sub-chunk
    writeString(view, 36, 'data')
    view.setUint32(40, dataSize, true)

    // Write PCM samples
    const offset = 44
    for (let i = 0; i < int16Samples.length; i++) {
        view.setInt16(offset + i * 2, int16Samples[i], true)
    }

    return buffer
}

function writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
    }
}
