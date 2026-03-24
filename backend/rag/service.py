"""
RAG service for document processing, embeddings, and question answering.
"""

import io
import os
from typing import Optional, List, Tuple
import httpx
import PyPDF2
import pandas as pd
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_classic.retrievers.multi_query import MultiQueryRetriever
from langchain_groq import ChatGroq

from config import get_settings

settings = get_settings()


class RAGService:
    """
    Service for Retrieval-Augmented Generation (RAG).
    Handles document processing, embedding, and question answering.
    """
    
    def __init__(self):
        self.documents: List[Document] = []
        self.chunks: List[Document] = []
        self.vector_db: Optional[Chroma] = None
        self.chain = None
        self.embeddings = None
        self.llm = None
        self._initialized = False
        
    def _init_embeddings(self):
        """Initialize HuggingFace embeddings."""
        if self.embeddings is None:
            print("Slowly initializing embeddings (this may take a while on first run)...")
            try:
                self.embeddings = HuggingFaceEmbeddings(
                    model_name=settings.EMBEDDING_MODEL,
                    model_kwargs={'device': 'cpu'},
                    encode_kwargs={'normalize_embeddings': True}
                )
                print("Embeddings initialized successfully.")
            except Exception as e:
                print(f"Failed to initialize embeddings: {e}")
                # Don't raise here, allow fallback or retry later
    
    def _init_llm(self):
        """Initialize Groq LLM."""
        if self.llm is None:
            if not settings.GROQ_API_KEY:
                print("GROQ_API_KEY not configured, LLM will not be available.")
                return
            
            try:
                self.llm = ChatGroq(
                    temperature=0,
                    model_name=settings.GROQ_MODEL,
                    groq_api_key=settings.GROQ_API_KEY
                )
                print("LLM (Groq) initialized successfully.")
            except Exception as e:
                print(f"Failed to initialize LLM: {e}")
    
    async def download_pdf_from_url(self, url: str) -> Optional[bytes]:
        """Download PDF from URL."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=30.0)
                
                if response.status_code == 200:
                    content = response.content
                    if content[:4] == b"%PDF":
                        return content
                    else:
                        print("Downloaded content is not a valid PDF")
                        return None
                else:
                    print(f"Failed to download PDF. Status: {response.status_code}")
                    return None
                    
        except Exception as e:
            print(f"Error downloading PDF: {e}")
            return None
    
    def process_pdf(self, pdf_content: bytes) -> List[Document]:
        """Extract text from PDF and create documents."""
        try:
            pdf_file = io.BytesIO(pdf_content)
            reader = PyPDF2.PdfReader(pdf_file)
            
            documents = []
            for page_num in range(len(reader.pages)):
                page = reader.pages[page_num]
                page_text = page.extract_text()
                
                if page_text:
                    documents.append(Document(
                        page_content=page_text,
                        metadata={"page": page_num + 1, "source": "pdf"}
                    ))
            
            return documents
            
        except Exception as e:
            print(f"Failed to process PDF: {e}")
            raise
    
    def process_csv(self, csv_content: bytes) -> List[Document]:
        """Process CSV and create documents from rows."""
        try:
            df = pd.read_csv(io.BytesIO(csv_content))
            
            documents = []
            for index, row in df.iterrows():
                content = "\n".join([f"{col}: {row[col]}" for col in df.columns])
                documents.append(Document(
                    page_content=content,
                    metadata={"row": index + 1, "source": "csv"}
                ))
            
            return documents
            
        except Exception as e:
            print(f"Failed to process CSV: {e}")
            raise
    
    def chunk_documents(self, documents: List[Document]) -> List[Document]:
        """Split documents into chunks for embedding."""
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=3000,
            chunk_overlap=200
        )
        chunks = text_splitter.split_documents(documents)
        return chunks
    
    def create_vector_store(self, chunks: List[Document]) -> Chroma:
        """Create ChromaDB vector store from document chunks."""
        self._init_embeddings()
        
        # Clear existing collection if any
        if self.vector_db is not None:
            try:
                self.vector_db.delete_collection()
            except:
                pass
        
        vector_db = Chroma.from_documents(
            documents=chunks,
            embedding=self.embeddings,
            collection_name=settings.CHROMA_COLLECTION_NAME,
            persist_directory=settings.CHROMA_PERSIST_DIR
        )
        
        return vector_db
    
    def setup_rag_chain(self, documents: List[Document]) -> bool:
        """Set up the complete RAG pipeline."""
        try:
            # Initialize components
            self._init_embeddings()
            self._init_llm()
            
            # Store and chunk documents
            self.documents = documents
            self.chunks = self.chunk_documents(documents)
            
            # Create vector store
            self.vector_db = self.create_vector_store(self.chunks)
            
            # Create multi-query retriever
            QUERY_PROMPT = PromptTemplate(
                input_variables=["question"],
                template="""You are an AI assistant generating alternative query perspectives.
                Generate 5 different versions of the given question to improve document retrieval:
                Original question: {question}"""
            )
            
            retriever = MultiQueryRetriever.from_llm(
                self.vector_db.as_retriever(),
                self.llm,
                prompt=QUERY_PROMPT
            )
            
            # Create RAG chain
            template = """Answer the question based ONLY on the following context:
            {context}
            
            Question: {question}
            
            If the context doesn't contain relevant information, say "I don't have enough information to answer this question based on the provided documents."
            
            Answer:"""
            
            prompt = ChatPromptTemplate.from_template(template)
            
            self.chain = (
                {"context": lambda x: retriever.invoke(x["question"]), "question": lambda x: x["question"]}
                | prompt
                | self.llm
                | StrOutputParser()
            )
            
            self._initialized = True
            return True
            
        except Exception as e:
            print(f"Failed to setup RAG chain: {e}")
            # Try fallback to simple retriever
            return self._setup_fallback_chain(documents)
    
    def _setup_fallback_chain(self, documents: List[Document]) -> bool:
        """Setup a simple keyword-based retriever as fallback."""
        try:
            self._init_llm()
            
            self.documents = documents
            self.chunks = self.chunk_documents(documents)
            
            def simple_retriever(query: str) -> List[Document]:
                query_words = query.lower().split()
                scored_docs = []
                
                for doc in self.chunks:
                    content = doc.page_content.lower()
                    score = sum(1 for word in query_words if word in content)
                    if score > 0:
                        scored_docs.append((doc, score))
                
                scored_docs.sort(key=lambda x: x[1], reverse=True)
                return [doc for doc, score in scored_docs[:3]]
            
            template = """Answer the question based on the following context:
            {context}

            Question: {question}

            If the context doesn't contain relevant information, say "I don't have enough information to answer this question based on the provided documents."

            Answer:"""
            
            prompt = ChatPromptTemplate.from_template(template)
            
            self.chain = (
                {
                    "context": lambda x: "\n\n".join([doc.page_content for doc in simple_retriever(x["question"])]),
                    "question": lambda x: x["question"]
                }
                | prompt
                | self.llm
                | StrOutputParser()
            )
            
            self._initialized = True
            return True
            
        except Exception as e:
            print(f"Failed to setup fallback chain: {e}")
            return False
    
    async def query_products(self, query: str) -> List[dict]:
        """
        Query the RAG system specifically for product matches.
        Returns a list of product-like dictionaries.
        """
        if not self._initialized or self.llm is None:
            return []
            
        try:
            # We use a specific prompt to extract structured product info
            template = """You are a shopping assistant. Based on the documents, find products related to '{query}'.
            Extract and return ONLY a JSON list of products with 'name', 'category', 'price', and 'type' fields.
            If price is not found, use 0. If category is not found, use 'General'.
            
            Documents:
            {context}
            
            JSON Response:"""
            
            # Use the existing retriever (or fallback)
            context_docs = self.documents[:5] # Fallback to first few docs for now or use retriever if possible
            if self.vector_db:
                context_docs = self.vector_db.as_retriever().invoke(query)
            
            context = "\n\n".join([doc.page_content for doc in context_docs])
            
            prompt = ChatPromptTemplate.from_template(template)
            chain = prompt | self.llm | StrOutputParser()
            
            result_text = await chain.ainvoke({"query": query, "context": context})
            
            # Simple attempt to parse JSON from LLM output
            import json
            import re
            
            # Find JSON block
            match = re.search(r'\[.*\]', result_text, re.DOTALL)
            if match:
                products = json.loads(match.group(0))
                return products
            return []
            
        except Exception as e:
            print(f"RAG product query failed: {e}")
            return []

    def query(self, question: str) -> str:
        """Query the RAG chain with a question."""
        if not self._initialized or self.chain is None:
            return "Document analysis is not initialized. Please upload a document first."
        
        try:
            result = self.chain.invoke({"question": question})
            return result
            
        except Exception as e:
            print(f"Query failed: {e}")
            return f"An error occurred while processing your question: {str(e)}"
    
    def get_status(self) -> dict:
        """Get the current status of the RAG service."""
        return {
            "documents_loaded": self._initialized,
            "num_documents": len(self.documents),
            "num_chunks": len(self.chunks),
            "collection_name": settings.CHROMA_COLLECTION_NAME if self._initialized else ""
        }
    
    def clear(self):
        """Clear all loaded documents and reset the service."""
        self.documents = []
        self.chunks = []
        self.chain = None
        self._initialized = False
        
        if self.vector_db is not None:
            try:
                self.vector_db.delete_collection()
            except:
                pass
            self.vector_db = None


# Singleton instance
rag_service = RAGService()
