import api from './api'
import type { AudioTranscribeResponse, TTSResponse, SupportedLanguage } from '@/types'

export const audioService = {
    // Transcribe audio
    async transcribe(file: File, language: string = 'en'): Promise<AudioTranscribeResponse> {
        const formData = new FormData()
        formData.append('file', file)

        const response = await api.post<AudioTranscribeResponse>('/audio/transcribe', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            params: { language },
        })
        return response.data
    },

    // Text to speech (returns blob)
    async textToSpeech(text: string, language: string = 'en'): Promise<Blob> {
        const response = await api.post('/audio/tts', {
            text,
            language,
        }, {
            responseType: 'blob',
        })
        return response.data
    },

    // Text to speech as base64
    async textToSpeechBase64(text: string, language: string = 'en'): Promise<TTSResponse> {
        const response = await api.post<TTSResponse>('/audio/tts-base64', {
            text,
            language,
        })
        return response.data
    },

    // Get supported languages
    async getSupportedLanguages(): Promise<{ languages: SupportedLanguage[] }> {
        const response = await api.get<{ languages: SupportedLanguage[] }>('/audio/languages')
        return response.data
    },

    // Play audio from base64
    playAudioFromBase64(base64: string): void {
        const audio = new Audio(`data:audio/mpeg;base64,${base64}`)
        audio.play()
    },
}

export default audioService
