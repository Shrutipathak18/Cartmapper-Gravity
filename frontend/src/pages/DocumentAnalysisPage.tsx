import { useState, useRef, useEffect } from 'react'
import {
    Upload,
    FileText,
    Camera,
    Send,
    Sparkles,
    Loader2,
    AlertCircle,
    CheckCircle,
    Trash2,
    MessageSquare,
    Mic,
    MicOff,
    Volume2,
    Languages,
} from 'lucide-react'
import ragService from '@/services/ragService'
import qrService from '@/services/qrService'
import audioService from '@/services/audioService'
import { convertBlobToWav } from '@/services/audioUtils'
import { getErrorMessage } from '@/services/api'
import type { DocumentStatus } from '@/types'
import LoadingSpinner from '../components/common/LoadingSpinner'

interface Message {
    role: 'user' | 'assistant'
    content: string
}

export default function DocumentAnalysisPage() {
    const [status, setStatus] = useState<DocumentStatus | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [isQuerying, setIsQuerying] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [inputLanguage, setInputLanguage] = useState('en')
    const [outputLanguage, setOutputLanguage] = useState('en')
    const [isRecording, setIsRecording] = useState(false)
    const [isPlayingTTS, setIsPlayingTTS] = useState<number | null>(null)
    const [voiceAssistEnabled, setVoiceAssistEnabled] = useState(true)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const qrInputRef = useRef<HTMLInputElement>(null)
    const chatEndRef = useRef<HTMLDivElement>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const messagesRef = useRef<Message[]>([])
    const activeAudioRef = useRef<HTMLAudioElement | null>(null)
    const activeAudioUrlRef = useRef<string | null>(null)

    const stopActiveAudio = () => {
        if (activeAudioRef.current) {
            activeAudioRef.current.pause()
            activeAudioRef.current = null
        }
        if (activeAudioUrlRef.current) {
            URL.revokeObjectURL(activeAudioUrlRef.current)
            activeAudioUrlRef.current = null
        }
        setIsPlayingTTS(null)
    }

    useEffect(() => {
        messagesRef.current = messages
    }, [messages])

    useEffect(() => {
        return () => {
            if (activeAudioRef.current) {
                activeAudioRef.current.pause()
                activeAudioRef.current = null
            }
            if (activeAudioUrlRef.current) {
                URL.revokeObjectURL(activeAudioUrlRef.current)
                activeAudioUrlRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const currentStatus = await ragService.getStatus()
                setStatus(currentStatus)
            } catch (err) {
                console.error('Failed to fetch RAG status:', err)
            }
        }
        fetchStatus()
    }, [])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        setError(null)
        setSuccess(null)

        try {
            const lowerName = file.name.toLowerCase()
            let response
            if (lowerName.endsWith('.pdf')) {
                response = await ragService.uploadPDF(file)
            } else if (lowerName.endsWith('.csv')) {
                response = await ragService.uploadCSV(file)
            } else {
                throw new Error('Unsupported file type. Please upload PDF or CSV.')
            }

            setSuccess(response.message)
            const newStatus = await ragService.getStatus()
            setStatus(newStatus)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        setError(null)
        setSuccess(null)

        try {
            const qrResult = await qrService.decodeQR(file)

            if (!qrResult.success || !qrResult.data) {
                throw new Error('Could not decode QR code')
            }
            if (!qrResult.is_url) {
                throw new Error('QR code does not contain a URL')
            }

            const response = await ragService.uploadFromQRUrl(qrResult.data)
            setSuccess(response.message)

            const newStatus = await ragService.getStatus()
            setStatus(newStatus)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setIsUploading(false)
            if (qrInputRef.current) {
                qrInputRef.current.value = ''
            }
        }
    }

    const handleQuery = async (queryText?: string) => {
        const question = queryText || input.trim()
        if (!question.trim()) return

        if (!queryText) setInput('')
        setMessages((prev) => [...prev, { role: 'user', content: question }])
        setIsQuerying(true)
        setError(null)

        try {
            const response = await ragService.query({
                question,
                language: outputLanguage,
                include_sources: true,
            })

            const assistantMessage: Message = {
                role: 'assistant',
                content: response.answer,
            }

            const assistantIndex = messagesRef.current.length + 1
            setMessages((prev) => [...prev, assistantMessage])

            if (voiceAssistEnabled) {
                void handlePlayTTS(response.answer, assistantIndex)
            }

            setTimeout(() => {
                chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
            }, 120)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setIsQuerying(false)
        }
    }

    const handleClearDocuments = async () => {
        try {
            await ragService.clearDocuments()
            setStatus(null)
            setMessages([])
            setSuccess('Documents cleared')
        } catch (err) {
            setError(getErrorMessage(err))
        }
    }

    const handleVoiceInput = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop()
            setIsRecording(false)
            return
        }

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Media devices not supported')
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const options = { mimeType: 'audio/webm' }

            let mediaRecorder: MediaRecorder
            try {
                mediaRecorder = new MediaRecorder(stream, options)
            } catch {
                mediaRecorder = new MediaRecorder(stream)
            }

            mediaRecorderRef.current = mediaRecorder
            audioChunksRef.current = []

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                }
            }

            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach((track) => track.stop())
                const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType })
                const audioFile = await convertBlobToWav(audioBlob, 'recording.wav')

                try {
                    const result = await audioService.transcribe(audioFile, inputLanguage)
                    if (result.text) {
                        setInput(result.text)
                        setTimeout(() => handleQuery(result.text), 100)
                    }
                } catch (err) {
                    setError(getErrorMessage(err))
                }
            }

            mediaRecorder.start()
            setIsRecording(true)
        } catch {
            setError('Microphone access denied or not supported.')
        }
    }

    const handlePlayTTS = async (text: string, index: number) => {
        try {
            stopActiveAudio()
            setIsPlayingTTS(index)
            const audioBlob = await audioService.textToSpeech(text, outputLanguage)
            const audioUrl = URL.createObjectURL(audioBlob)
            const audio = new Audio(audioUrl)
            activeAudioRef.current = audio
            activeAudioUrlRef.current = audioUrl
            audio.onended = () => {
                if (activeAudioRef.current === audio) activeAudioRef.current = null
                if (activeAudioUrlRef.current === audioUrl) {
                    URL.revokeObjectURL(audioUrl)
                    activeAudioUrlRef.current = null
                }
                setIsPlayingTTS(null)
            }
            await audio.play()
        } catch (err) {
            setError(getErrorMessage(err))
            stopActiveAudio()
        }
    }

    const languages = [
        { code: 'en', name: 'English' },
        { code: 'hi', name: 'Hindi' },
        { code: 'or', name: 'Odia' },
        { code: 'bn', name: 'Bengali' },
        { code: 'ta', name: 'Tamil' },
    ]

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold text-gray-800">
                        Document Intelligence
                    </h1>
                    <p className="text-gray-500 mt-1">
                        Upload PDF or QR-linked files and chat with your content.
                    </p>
                </div>

                <div className="flex gap-2 items-end flex-wrap">
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 px-1">Input</label>
                        <select
                            value={inputLanguage}
                            onChange={(e) => setInputLanguage(e.target.value)}
                            className="input-field h-10 w-36 py-1"
                        >
                            {languages.map((lang) => (
                                <option key={lang.code} value={lang.code}>{lang.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 px-1">Output</label>
                        <select
                            value={outputLanguage}
                            onChange={(e) => setOutputLanguage(e.target.value)}
                            className="input-field h-10 w-36 py-1"
                        >
                            {languages.map((lang) => (
                                <option key={lang.code} value={lang.code}>{lang.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs text-gray-600">
                        <Languages className="w-4 h-4 text-primary" />
                        Multilingual
                    </div>
                </div>
            </div>

            {error && (
                <div className="alert-error flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}
            {success && (
                <div className="alert-success flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    {success}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-primary" />
                        Upload PDF / CSV
                    </h3>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                    />

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-8 hover:border-primary hover:bg-rose-50/40 transition-all text-center"
                    >
                        {isUploading ? (
                            <LoadingSpinner size="medium" className="mx-auto" />
                        ) : (
                            <>
                                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-700 font-medium">Click to upload file</p>
                                <p className="text-sm text-gray-400 mt-1">Accepted: PDF and CSV</p>
                            </>
                        )}
                    </button>
                </div>

                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Camera className="w-5 h-5 text-primary" />
                        Upload QR Image
                    </h3>

                    <input
                        ref={qrInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleQRUpload}
                        className="hidden"
                    />

                    <button
                        onClick={() => qrInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full border-2 border-dashed border-gray-200 rounded-2xl p-8 hover:border-primary hover:bg-rose-50/40 transition-all text-center"
                    >
                        {isUploading ? (
                            <LoadingSpinner size="medium" className="mx-auto" />
                        ) : (
                            <>
                                <Camera className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-700 font-medium">Scan via uploaded QR image</p>
                                <p className="text-sm text-gray-400 mt-1">QR must contain a URL</p>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {status?.documents_loaded && (
                <div className="card-pastel">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800">Document index ready</p>
                                <p className="text-sm text-gray-500">
                                    {status.num_documents} documents | {status.num_chunks} chunks
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleClearDocuments}
                            className="p-2 hover:bg-red-100 rounded-xl text-red-500 transition-colors"
                            title="Clear documents"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {status?.documents_loaded && (
                <div className="card">
                    <div className="mb-4 flex items-center justify-between gap-2">
                        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-primary" />
                            Ask Questions
                        </h3>
                        <button
                            type="button"
                            className="btn-secondary px-3 py-1 text-xs"
                            onClick={() => {
                                setVoiceAssistEnabled((prev) => {
                                    const next = !prev
                                    if (!next) stopActiveAudio()
                                    return next
                                })
                            }}
                        >
                            Voice Assist: {voiceAssistEnabled ? 'On' : 'Off'}
                        </button>
                    </div>

                    <div className="max-h-[420px] overflow-auto mb-4 space-y-4 pr-1">
                        {messages.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                <p>Ask anything about the uploaded content. Use Voice Assist toggle for auto-read.</p>
                            </div>
                        ) : (
                            messages.map((message, i) => (
                                <div
                                    key={i}
                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className="flex items-end gap-2 max-w-[86%]">
                                        <div
                                            className={`p-4 rounded-2xl text-sm leading-relaxed ${message.role === 'user'
                                                ? 'bg-primary text-white rounded-br-md'
                                                : 'bg-gray-100 text-gray-800 rounded-bl-md'
                                                }`}
                                        >
                                            {message.content}
                                        </div>
                                        {message.role === 'assistant' && (
                                            <button
                                                onClick={() => handlePlayTTS(message.content, i)}
                                                className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-primary transition-colors flex-shrink-0"
                                                title="Listen to response"
                                                disabled={isPlayingTTS === i}
                                            >
                                                {isPlayingTTS === i ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Volume2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                            placeholder="Type question or use mic..."
                            className="input-field flex-1"
                            disabled={isQuerying}
                        />
                        <button
                            onClick={handleVoiceInput}
                            className={`p-3 rounded-xl transition-all ${isRecording
                                ? 'bg-red-500 text-white animate-pulse'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            title={isRecording ? 'Stop recording' : 'Voice input'}
                        >
                            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={() => handleQuery()}
                            disabled={isQuerying || !input.trim()}
                            className="btn-primary px-4"
                        >
                            {isQuerying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
