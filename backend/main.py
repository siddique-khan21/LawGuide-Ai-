from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from enum import Enum
from typing import Optional, List, Dict
import google.generativeai as genai
import os
from dotenv import load_dotenv
import PyPDF2
import io
import json
import re
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import tempfile
from datetime import datetime

# Load environment variables
load_dotenv()

# Create the app
app = FastAPI(title="LawGuide AI API")

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set up Gemini
gemini_api_key = os.getenv("GEMINI_API_KEY")
if not gemini_api_key:
    raise ValueError("GEMINI_API_KEY not found in environment variables")

genai.configure(api_key=gemini_api_key)

# Define what data we expect
class SummaryRequest(BaseModel):
    text: str

class Language(str, Enum):
    ENGLISH = "en"
    SPANISH = "es"
    FRENCH = "fr"
    GERMAN = "de"
    HINDI = "hi"

class DocumentRequest(BaseModel):
    doc_type: str
    party1: str
    party2: str
    date: str
    details: Optional[str] = None
    language: Language = Language.ENGLISH

# Global variables for session management
last_document_text = ""
current_document_context = ""

# Create a simple test endpoint
@app.get("/")
def read_root():
    return {"message": "LawGuide AI API is working with Gemini!"}

# Create an endpoint to summarize text
@app.post("/summarize")
def summarize_text(request: SummaryRequest):
    try:
        # Use Gemini to summarize
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        
        prompt = f"""
        You are a legal expert who explains complex legal concepts in simple terms.
        Please summarize this legal document in plain language: {request.text}
        You can use analogy wherever necessary for better humanization
        Provide a clear, concise summary that a non-lawyer can understand.
        """
        
        response = model.generate_content(prompt)
        
        return {"summary": response.text}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add this endpoint to handle file uploads
@app.post("/upload-document")
async def upload_document(file: UploadFile = File(...)):
    try:
        global last_document_text, current_document_context
        
        # Check file size (max 10MB)
        MAX_FILE_SIZE = 10 * 1024 * 1024
        contents = await file.read()
        
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB")
        
        # Check if file is PDF
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Extract text from PDF
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        # Store the document text for Q&A and review
        last_document_text = text
        current_document_context = text[:2000]  # Store context for Q&A
        
        # Use Gemini to summarize
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        
        prompt = f"""
        You are a legal expert who explains complex legal concepts in simple terms.
        Please summarize this legal document in plain language: {text}
        You can use analogy wherever necessary for better humanization
        Provide a clear, concise summary that a non-lawyer can understand.
        """
        
        response = model.generate_content(prompt)
        
        return {
            "filename": file.filename,
            "summary": response.text,
            "extracted_text": text[:500] + "..." if len(text) > 500 else text,
            "message": "Document uploaded successfully. You can now ask questions about it."
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add document-based Q&A endpoint
@app.post("/ask-about-document")
def ask_about_document(request: SummaryRequest):
    try:
        global current_document_context
        
        if not current_document_context:
            raise HTTPException(status_code=400, detail="No document uploaded yet. Please upload a document first.")
        
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        
        prompt = f"""
	Based on this legal document content: {current_document_context}

	Answer this question: {request.text}

	Rules:
	1. FIRST check if this is a factual question about the document content (names, dates, events, amounts, etc.)
	2. If it's a factual document question, answer directly and accurately
	3. If it's a legal question about the document, provide detailed legal analysis
	4. If it's completely unrelated to the document, politely explain you can only answer questions about this document
	5. Be specific and cite relevant sections if possible
	6. Provide accurate information
	"""
        
        response = model.generate_content(prompt)
        return {"answer": response.text}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add contract review with annotations endpoint
@app.post("/review-contract")
async def review_contract(file: UploadFile = File(...)):
    try:
        # Check file size (max 10MB)
        MAX_FILE_SIZE = 10 * 1024 * 1024
        contents = await file.read()
        
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB")
        
        # Check if file is PDF
        if file.content_type != "application/pdf":
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Extract text from PDF
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF")
        
        # Use Gemini to analyze contract
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        
        prompt = f"""
        Analyze this legal contract and provide specific annotations and suggestions:
        
        {text[:5000]}  # First 5000 chars for context
        
        Provide response in this EXACT JSON format:
        {{
          "summary": "brief overall summary",
          "annotations": [
            {{
              "text": "exact clause text",
              "issue": "problem identified", 
              "suggestion": "improved wording",
              "severity": "high/medium/low"
            }}
          ],
          "risk_level": "high/medium/low"
        }}
        
        Focus on: unfair terms, excessive penalties, ambiguous language, missing protections, one-sided clauses.
        Be specific and provide exact text excerpts.
        """
        
        response = model.generate_content(prompt)
        
        # Parse the JSON response
        try:
            # Clean the response to extract JSON
            json_str = response.text.strip()
            json_str = json_str[json_str.find('{'):json_str.rfind('}')+1]
            review_result = json.loads(json_str)
            return review_result
        except json.JSONDecodeError:
            # Fallback if AI doesn't return proper JSON
            return {
                "summary": "Contract review completed but formatting issues occurred",
                "annotations": [
                    {
                        "text": "Full document",
                        "issue": "Analysis completed", 
                        "suggestion": "Please review the detailed analysis above",
                        "severity": "medium"
                    }
                ],
                "risk_level": "requires_manual_review"
            }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add document drafting endpoint with PDF generation
@app.post("/draft-document-pdf")
def draft_document_pdf(request: DocumentRequest):
    try:
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        
        prompt = f"""
        Create a {request.doc_type} legal document in {request.language} language.
        
        Parties involved:
        - Party 1: {request.party1}
        - Party 2: {request.party2}
        
        Effective date: {request.date}
        Additional details: {request.details or 'None provided'}
        
        Make it professional, legally appropriate, and comprehensive.
        Format it with proper sections, headings, and legal structure.
        """
        
        response = model.generate_content(prompt)
        document_text = response.text
        
        # Create PDF
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        pdf_path = temp_file.name
        
        c = canvas.Canvas(pdf_path, pagesize=letter)
        c.setFont("Helvetica", 12)
        
        # Add title
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, 750, f"{request.doc_type.upper()}")
        c.setFont("Helvetica", 12)
        
        # Add parties
        c.drawString(50, 720, f"Between: {request.party1} (Party 1) and {request.party2} (Party 2)")
        c.drawString(50, 700, f"Effective Date: {request.date}")
        
        # Add document content
        y_position = 650
        lines = document_text.split('\n')
        
        for line in lines:
            if y_position < 50:
                c.showPage()
                c.setFont("Helvetica", 12)
                y_position = 750
            c.drawString(50, y_position, line[:80])  # Limit line length
            y_position -= 20
        
        c.save()
        
        return FileResponse(
            pdf_path,
            media_type='application/pdf',
            filename=f"{request.doc_type.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Add this endpoint for legal questions only
@app.post("/ask-legal-question")
def ask_legal_question(request: SummaryRequest, language: Language = Language.ENGLISH):
    try:
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        
        prompt = f"""
        You are a professional legal assistant. You MUST follow these rules:
        1. ONLY answer legal-related questions (law, contracts, rights, regulations, etc.)
        2. If asked about non-legal topics, politely decline and explain you're a legal assistant
        3. Provide accurate, helpful information in simple language
        4. Always mention you're an AI assistant and not a substitute for real legal advice
        5. Answer in {language} language
        
        User question: {request.text}
        
        Please provide a helpful response following the rules above.
        """
        
        response = model.generate_content(prompt)
        
        return {"answer": response.text}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "LawGuide AI API"}

# Add this endpoint to see available models
@app.get("/list-models")
def list_models():
    try:
        models = genai.list_models()
        model_names = []
        for model in models:
            supported_methods = []
            if model.supported_generation_methods:
                supported_methods = [method for method in model.supported_generation_methods if 'generateContent' in method]
            
            if supported_methods:
                model_names.append({
                    "name": model.name, 
                    "supported_methods": supported_methods
                })
        
        return {"available_models": model_names}
    
    except Exception as e:
        return {"error": str(e)}