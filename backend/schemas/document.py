"""
Document and RAG-related Pydantic schemas.
"""

from typing import Optional, List
from pydantic import BaseModel


class DocumentUploadResponse(BaseModel):
    """Response after document upload."""
    success: bool
    message: str
    document_id: Optional[str] = None
    num_chunks: int = 0
    document_type: str = ""


class QRUploadRequest(BaseModel):
    """Request for processing QR code URL."""
    qr_url: str


class RAGQueryRequest(BaseModel):
    """Request for RAG-based question answering."""
    question: str
    language: str = "en"
    include_sources: bool = False


class RAGQueryResponse(BaseModel):
    """Response from RAG query."""
    answer: str
    original_question: str
    translated_question: Optional[str] = None
    translated_answer: Optional[str] = None
    language: str = "en"
    sources: List[str] = []


class DocumentStatus(BaseModel):
    """Status of document processing."""
    documents_loaded: bool
    num_documents: int = 0
    num_chunks: int = 0
    collection_name: str = ""
