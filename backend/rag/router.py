"""
RAG router for document upload and question answering.
"""

import base64
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from fastapi.concurrency import run_in_threadpool

from rag.service import rag_service
from translation.service import translation_service
from navigation.service import navigation_service
from stores.registry import get_store_by_id, get_store_by_name
from schemas.document import (
    DocumentUploadResponse,
    QRUploadRequest,
    RAGQueryRequest,
    RAGQueryResponse,
    DocumentStatus
)
from auth.dependencies import get_optional_user
from schemas.auth import UserInfo
from config import get_settings

router = APIRouter()
settings = get_settings()


def _resolve_store_profile(store_id: str) -> dict:
    """Resolve store profile for map building, fallback to a generic profile."""
    store = get_store_by_id(store_id) or get_store_by_name(store_id)
    if store:
        return {
            "store_width_cm": store.profile.store_width_cm,
            "store_height_cm": store.profile.store_height_cm,
            "anchors": [
                {"anchor_id": a.anchor_id, "name": a.name, "x": a.x, "y": a.y}
                for a in store.profile.anchors
            ]
        }

    return {
        "store_width_cm": 3000,
        "store_height_cm": 2000,
        "anchors": []
    }


@router.post("/upload/pdf", response_model=DocumentUploadResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    user: UserInfo = Depends(get_optional_user)
):
    """
    Upload and process a PDF document for RAG.
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a PDF"
        )
    
    try:
        content = await file.read()
        
        # Validate it's a PDF
        if not content[:4] == b"%PDF":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid PDF file"
            )
        
        # Process PDF
        documents = await run_in_threadpool(rag_service.process_pdf, content)
        
        if not documents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No text could be extracted from the PDF"
            )
        
        rag_note = ""
        if settings.GROQ_API_KEY:
            success = await run_in_threadpool(rag_service.setup_rag_chain, documents)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to initialize document analysis"
                )
        else:
            rag_note = " RAG indexing skipped because GROQ_API_KEY is not configured."
        
        return DocumentUploadResponse(
            success=True,
            message=f"Successfully processed {len(documents)} pages.{rag_note}",
            document_id=file.filename,
            num_chunks=len(rag_service.chunks),
            document_type="pdf"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process PDF: {str(e)}"
        )


@router.post("/upload/csv", response_model=DocumentUploadResponse)
async def upload_csv(
    file: UploadFile = File(...),
    user: UserInfo = Depends(get_optional_user)
):
    """
    Upload and process a CSV document for RAG.
    """
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )
    
    try:
        content = await file.read()

        documents = []
        rag_note = ""
        if settings.GROQ_API_KEY:
            # Full RAG flow (heavier): parse CSV + build vector store.
            documents = await run_in_threadpool(rag_service.process_csv, content)
            if not documents:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No data could be extracted from the CSV"
                )
            success = await run_in_threadpool(rag_service.setup_rag_chain, documents)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to initialize document analysis"
                )
        else:
            # Lightweight flow for free instances / no Groq.
            rag_service.clear()
            rag_note = " RAG indexing skipped because GROQ_API_KEY is not configured."

        # Also refresh indoor navigation map using this CSV.
        target_store_id = navigation_service.current_store_id or "sample"
        store_profile = _resolve_store_profile(target_store_id)
        processed_rows = len(documents)
        try:
            indoor_map = await run_in_threadpool(
                navigation_service.create_map_from_csv,
                target_store_id,
                content,
                store_profile
            )
            if not settings.GROQ_API_KEY:
                processed_rows = sum(len(items) for items in indoor_map.products.values())
            map_note = " Indoor map updated with aisle/section routes."
        except Exception as map_error:
            map_note = f" Indoor map update failed: {map_error}"
        
        return DocumentUploadResponse(
            success=True,
            message=f"Successfully processed {processed_rows} rows.{rag_note}{map_note}",
            document_id=file.filename,
            num_chunks=len(rag_service.chunks),
            document_type="csv"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process CSV: {str(e)}"
        )


@router.post("/upload/qr-url", response_model=DocumentUploadResponse)
async def upload_from_qr_url(
    request: QRUploadRequest,
    user: UserInfo = Depends(get_optional_user)
):
    """
    Download and process a PDF from a QR code URL.
    """
    url = request.qr_url
    
    if not url.startswith(('http://', 'https://')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid URL format"
        )
    
    try:
        # Download PDF
        content = await rag_service.download_pdf_from_url(url)
        
        if content is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to download PDF from URL"
            )
        
        # Process PDF
        documents = await run_in_threadpool(rag_service.process_pdf, content)
        
        if not documents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No text could be extracted from the PDF"
            )
        
        rag_note = ""
        if settings.GROQ_API_KEY:
            success = await run_in_threadpool(rag_service.setup_rag_chain, documents)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to initialize document analysis"
                )
        else:
            rag_note = " RAG indexing skipped because GROQ_API_KEY is not configured."
        
        return DocumentUploadResponse(
            success=True,
            message=f"Successfully processed {len(documents)} pages from URL.{rag_note}",
            document_id=url,
            num_chunks=len(rag_service.chunks),
            document_type="pdf"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process PDF from URL: {str(e)}"
        )


@router.post("/query", response_model=RAGQueryResponse)
async def query_documents(
    request: RAGQueryRequest,
    user: UserInfo = Depends(get_optional_user)
):
    """
    Ask a question about the uploaded documents.
    """
    if not rag_service._initialized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No documents loaded. Please upload a document first."
        )
    
    try:
        question = request.question
        translated_question = None
        translated_answer = None
        
        # Translate question to English if needed
        if request.language != "en":
            translation_result = translation_service.translate(
                text=question,
                source_lang=request.language,
                target_lang="en"
            )
            if translation_result["success"]:
                translated_question = translation_result["translated_text"]
                question = translated_question
        
        # Query RAG
        answer = rag_service.query(question)
        
        # Translate answer back if needed
        if request.language != "en":
            translation_result = translation_service.translate(
                text=answer,
                source_lang="en",
                target_lang=request.language
            )
            if translation_result["success"]:
                translated_answer = translation_result["translated_text"]
        
        # Get sources if requested
        sources = []
        if request.include_sources and rag_service.chunks:
            sources = [chunk.page_content[:200] + "..." for chunk in rag_service.chunks[:3]]
        
        return RAGQueryResponse(
            answer=translated_answer if translated_answer else answer,
            original_question=request.question,
            translated_question=translated_question,
            translated_answer=translated_answer,
            language=request.language,
            sources=sources
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Query failed: {str(e)}"
        )


@router.get("/status", response_model=DocumentStatus)
async def get_status():
    """
    Get the current status of document processing.
    """
    status = rag_service.get_status()
    return DocumentStatus(**status)


@router.delete("/clear")
async def clear_documents(user: UserInfo = Depends(get_optional_user)):
    """
    Clear all loaded documents.
    """
    rag_service.clear()
    return {"message": "Documents cleared successfully"}
