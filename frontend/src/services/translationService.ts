import api from './api'
import type { TranslationResponse, SupportedLanguage } from '../types'

export const translationService = {
    // Translate text
    async translate(
        text: string,
        sourceLang: string = 'auto',
        targetLang: string = 'en'
    ): Promise<TranslationResponse> {
        const response = await api.post<TranslationResponse>('/translate', {
            text,
            source_lang: sourceLang,
            target_lang: targetLang,
        })
        return response.data
    },

    // Get supported languages
    async getSupportedLanguages(): Promise<{ languages: SupportedLanguage[] }> {
        const response = await api.get<{ languages: SupportedLanguage[] }>('/translate/languages')
        return response.data
    },

    // Clear cache
    async clearCache(): Promise<void> {
        await api.post('/translate/clear-cache')
    },
}

export default translationService
