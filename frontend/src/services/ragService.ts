import api from './api'
import type {
    DocumentUploadResponse,
    RAGQueryRequest,
    RAGQueryResponse,
    DocumentStatus,
} from '@/types'

export const ragService = {
    // Upload PDF
    async uploadPDF(file: File): Promise<DocumentUploadResponse> {
        const formData = new FormData()
        formData.append('file', file)

        const response = await api.post<DocumentUploadResponse>('/rag/upload/pdf', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
        return response.data
    },

    // Upload CSV
    async uploadCSV(file: File): Promise<DocumentUploadResponse> {
        const formData = new FormData()
        formData.append('file', file)

        const response = await api.post<DocumentUploadResponse>('/rag/upload/csv', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
        return response.data
    },

    // Upload from QR URL
    async uploadFromQRUrl(qrUrl: string): Promise<DocumentUploadResponse> {
        const response = await api.post<DocumentUploadResponse>('/rag/upload/qr-url', {
            qr_url: qrUrl,
        })
        return response.data
    },

    // Query documents
    async query(request: RAGQueryRequest): Promise<RAGQueryResponse> {
        const response = await api.post<RAGQueryResponse>('/rag/query', request)
        return response.data
    },

    // Get status
    async getStatus(): Promise<DocumentStatus> {
        const response = await api.get<DocumentStatus>('/rag/status')
        return response.data
    },

    // Clear documents
    async clearDocuments(): Promise<void> {
        await api.delete('/rag/clear')
    },
}

export default ragService
