import api from './api'
import type { QRDecodeResponse, QRAnchorValidation } from '../types'

export const qrService = {
    // Decode QR from image
    async decodeQR(file: File): Promise<QRDecodeResponse> {
        const formData = new FormData()
        formData.append('file', file)

        const response = await api.post<QRDecodeResponse>('/qr/decode', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
        return response.data
    },

    // Validate anchor QR
    async validateAnchor(file: File, shopId?: string): Promise<QRAnchorValidation> {
        const formData = new FormData()
        formData.append('file', file)

        const response = await api.post<QRAnchorValidation>('/qr/validate-anchor', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            params: shopId ? { shop_id: shopId } : undefined,
        })
        return response.data
    },

    // Validate anchor from data
    async validateAnchorData(qrData: string, shopId?: string): Promise<QRAnchorValidation> {
        const response = await api.post<QRAnchorValidation>('/qr/validate-anchor-data', null, {
            params: {
                qr_data: qrData,
                shop_id: shopId,
            },
        })
        return response.data
    },

    // Generate anchor QR
    async generateAnchorQR(storeId: string, anchorId: string): Promise<Blob> {
        const response = await api.get(`/qr/generate-anchor/${storeId}/${anchorId}`, {
            responseType: 'blob',
        })
        return response.data
    },

    // Generate anchor QR as base64
    async generateAnchorQRBase64(storeId: string, anchorId: string): Promise<{
        store_id: string
        anchor_id: string
        qr_base64: string
        format: string
    }> {
        const response = await api.get(`/qr/generate-anchor-base64/${storeId}/${anchorId}`)
        return response.data
    },

    // Generate QR from data
    async generateQR(data: string): Promise<Blob> {
        const response = await api.post(`/qr/generate`, null, {
            params: { data },
            responseType: 'blob',
        })
        return response.data
    },
}

export default qrService
