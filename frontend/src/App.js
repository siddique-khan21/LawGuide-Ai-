import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);
  const [reviewFile, setReviewFile] = useState(null);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('text');
  const [chatMessages, setChatMessages] = useState([
    { 
      role: 'bot', 
      content: "Hello! I'm LawGuide AI, your legal assistant and tutor. I can help you analyze legal documents, answer legal questions, and draft basic legal forms. How can I assist you today?",
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [userQuestion, setUserQuestion] = useState('');
  const [activeSection, setActiveSection] = useState('document');
  const [documentType, setDocumentType] = useState('rental agreement');
  const [party1, setParty1] = useState('');
  const [party2, setParty2] = useState('');
  const [contractDate, setContractDate] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [draftedDocument, setDraftedDocument] = useState('');
  const [contractReview, setContractReview] = useState(null);
  const [language, setLanguage] = useState('en');
  const [hasUploadedDocument, setHasUploadedDocument] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSummarizeText = async () => {
    if (!text.trim()) return;
    
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/summarize', {
        text: text
      });
      setSummary(response.data.summary);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to get summary. Please check if the backend is running.');
    }
    setLoading(false);
  };

  const handleFileUpload = async () => {
    if (!file) return;
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('http://localhost:8000/upload-document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setSummary(response.data.summary);
      setHasUploadedDocument(true);
      
      // Add success message to chat
      const botMessage = { 
        role: 'bot', 
        content: `Document "${file.name}" uploaded successfully! You can now ask questions about this specific document.`,
        timestamp: new Date().toLocaleTimeString()
      };
      setChatMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to upload file. Please check if the file is a PDF and try again.');
    }
    setLoading(false);
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleReviewFileChange = (e) => {
    setReviewFile(e.target.files[0]);
  };

  const handleAskQuestion = async () => {
    if (!userQuestion.trim()) return;
    
    // Add user message to chat
    const newMessage = { 
      role: 'user', 
      content: userQuestion,
      timestamp: new Date().toLocaleTimeString()
    };
    setChatMessages([...chatMessages, newMessage]);
    setUserQuestion('');
    
    try {
      const response = await axios.post(`http://localhost:8000/ask-legal-question?language=${language}`, {
        text: userQuestion
      });
      
      // Add bot response to chat
      const botMessage = { 
        role: 'bot', 
        content: response.data.answer,
        timestamp: new Date().toLocaleTimeString()
      };
      setChatMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = { 
        role: 'bot', 
        content: "Sorry, I'm having trouble connecting to the server. Please try again later.",
        timestamp: new Date().toLocaleTimeString()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleAskAboutDocument = async () => {
    if (!userQuestion.trim()) return;
    
    const newMessage = { 
      role: 'user', 
      content: `[About uploaded document] ${userQuestion}`,
      timestamp: new Date().toLocaleTimeString()
    };
    setChatMessages([...chatMessages, newMessage]);
    setUserQuestion('');
    
    try {
      const response = await axios.post('http://localhost:8000/ask-about-document', {
        text: userQuestion
      });
      
      const botMessage = { 
        role: 'bot', 
        content: response.data.answer,
        timestamp: new Date().toLocaleTimeString()
      };
      setChatMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = { 
        role: 'bot', 
        content: "Please upload a document first or try a general legal question.",
        timestamp: new Date().toLocaleTimeString()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleDraftDocument = async () => {
    if (!party1.trim() || !party2.trim() || !contractDate.trim()) {
      alert('Please fill in all required fields: Party 1, Party 2, and Date');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:8000/draft-document-pdf', {
        doc_type: documentType,
        party1: party1,
        party2: party2,
        date: contractDate,
        details: additionalDetails,
        language: language
      }, {
        responseType: 'blob'
      });
      
      // Create download link for PDF
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${documentType.replace(' ', '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setDraftedDocument("Document drafted and downloaded successfully!");
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to draft document. Please try again.');
    }
    setLoading(false);
  };

  const handleContractReview = async () => {
    if (!reviewFile) return;
    
    setReviewLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', reviewFile);
      
      const response = await axios.post('http://localhost:8000/review-contract', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setContractReview(response.data);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to review contract. Please check if the file is a PDF and try again.');
    }
    setReviewLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (activeSection === 'chat') {
        handleAskQuestion();
      }
    }
  };

  const suggestedQuestions = [
    "What should be included in a rental agreement?",
    "How does copyright protection work?",
    "What are the basic elements of a contract?",
    "What is intellectual property?",
    "How do I create a will?"
  ];

  return (
    <div className="App">
      <header className="App-header">
        <h1>⚖️ LawGuide AI</h1>
        <p>Turning Legal Complexity into Clarity - Powered by AI</p>
      </header>
      
      <div className="main-container">
        {/* Navigation */}
        <nav className="main-nav">
          <button 
            className={activeSection === 'document' ? 'nav-active' : ''}
            onClick={() => setActiveSection('document')}
          >
            📄 Document Analysis
          </button>
          <button 
            className={activeSection === 'chat' ? 'nav-active' : ''}
            onClick={() => setActiveSection('chat')}
          >
            💬 Legal Tutor
          </button>
          <button 
            className={activeSection === 'draft' ? 'nav-active' : ''}
            onClick={() => setActiveSection('draft')}
          >
            📝 Draft Documents
          </button>
          <button 
            className={activeSection === 'review' ? 'nav-active' : ''}
            onClick={() => setActiveSection('review')}
          >
            🔍 Contract Review
          </button>
        </nav>

        {/* Main Content Area */}
        <div className="content-area">
          {activeSection === 'document' ? (
            <div className="document-section">
              <div className="tab-buttons">
                <button 
                  className={activeTab === 'text' ? 'active' : ''}
                  onClick={() => setActiveTab('text')}
                >
                  📝 Paste Text
                </button>
                <button 
                  className={activeTab === 'file' ? 'active' : ''}
                  onClick={() => setActiveTab('file')}
                >
                  📂 Upload PDF
                </button>
              </div>
              
              {activeTab === 'text' ? (
                <div className="input-section">
                  <h2>Paste Legal Text</h2>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste your legal document here..."
                    rows="8"
                  />
                  <button onClick={handleSummarizeText} disabled={loading}>
                    {loading ? '⏳ Processing...' : '✨ Simplify Document'}
                  </button>
                </div>
              ) : (
                <div className="input-section">
                  <h2>Upload Legal Document (PDF)</h2>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      id="file-input"
                    />
                    <label htmlFor="file-input" className="file-label">
                      {file ? `Selected: ${file.name}` : '📁 Choose PDF file (max 10MB)'}
                    </label>
                  </div>
                  <button onClick={handleFileUpload} disabled={loading || !file}>
                    {loading ? '⏳ Processing...' : '🚀 Upload & Analyze'}
                  </button>
                </div>
              )}
              
              {summary && (
                <div className="result-section">
                  <h2>📋 Simplified Summary</h2>
                  <div className="summary-box">
                    <p>{summary}</p>
                  </div>
                </div>
              )}
            </div>
          ) : activeSection === 'chat' ? (
            <div className="chat-section">
              <div className="language-selector">
                <label>Language: </label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="fr">French</option>
                  <option value="es">Spanish</option>
                </select>
              </div>

              <div className="chat-container">
                <div className="chat-messages">
                  {chatMessages.map((message, index) => (
                    <div key={index} className={`message ${message.role}`}>
                      <div className="message-content">
                        <p>{message.content}</p>
                      </div>
                      <span className="message-time">{message.timestamp}</span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                
                <div className="chat-input">
                  <input
                    type="text"
                    value={userQuestion}
                    onChange={(e) => setUserQuestion(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask any legal question..."
                    disabled={loading}
                  />
                  <button onClick={handleAskQuestion} disabled={loading}>
                    {loading ? '⏳' : '➤'}
                  </button>
                  {hasUploadedDocument && (
                    <button onClick={handleAskAboutDocument} disabled={loading} className="document-question-btn">
                      📄 About Doc
                    </button>
                  )}
                </div>
              </div>
              
              <div className="chat-suggestions">
                <h3>💡 Try asking:</h3>
                <div className="suggestion-chips">
                  {suggestedQuestions.map((question, index) => (
                    <button key={index} onClick={() => setUserQuestion(question)}>
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : activeSection === 'draft' ? (
            <div className="draft-section">
              <div className="input-section">
                <h2>📝 Draft Legal Document</h2>
                
                <div className="form-group">
                  <label>Document Type:</label>
                  <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
                    <option value="rental agreement">Rental Agreement</option>
                    <option value="non-disclosure agreement">Non-Disclosure Agreement (NDA)</option>
                    <option value="service contract">Service Contract</option>
                    <option value="affidavit">Affidavit</option>
                    <option value="will">Will</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Party 1 (Your Name):</label>
                    <input
                      type="text"
                      value={party1}
                      onChange={(e) => setParty1(e.target.value)}
                      placeholder="e.g., John Doe"
                    />
                  </div>
                  <div className="form-group">
                    <label>Party 2 (Other Party):</label>
                    <input
                      type="text"
                      value={party2}
                      onChange={(e) => setParty2(e.target.value)}
                      placeholder="e.g., Jane Smith"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Effective Date:</label>
                  <input
                    type="date"
                    value={contractDate}
                    onChange={(e) => setContractDate(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Additional Details (optional):</label>
                  <textarea
                    value={additionalDetails}
                    onChange={(e) => setAdditionalDetails(e.target.value)}
                    placeholder="e.g., 12 month lease, $1500 monthly rent, specific terms..."
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label>Language: </label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="fr">French</option>
                    <option value="es">Spanish</option>
                  </select>
                </div>

                <button onClick={handleDraftDocument} disabled={loading}>
                  {loading ? '⏳ Drafting...' : '📥 Download Document'}
                </button>
              </div>
              
              {draftedDocument && (
                <div className="result-section">
                  <h2>✅ Success!</h2>
                  <div className="summary-box">
                    <p>{draftedDocument}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="review-section">
              <div className="input-section">
                <h2>🔍 Upload Contract for Review</h2>
                <p>Max file size: 10MB • PDF only</p>
                
                <div className="file-upload-area">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleReviewFileChange}
                    id="review-file-input"
                  />
                  <label htmlFor="review-file-input" className="file-label">
                    {reviewFile ? `Selected: ${reviewFile.name}` : '📁 Choose Contract PDF'}
                  </label>
                </div>
                
                <button onClick={handleContractReview} disabled={reviewLoading || !reviewFile}>
                  {reviewLoading ? '⏳ Analyzing...' : '🔍 Review Contract'}
                </button>
              </div>
              
              {contractReview && (
                <div className="review-results">
                  <h2>Contract Review Results</h2>
                  
                  <div className={`risk-level risk-${contractReview.risk_level}`}>
                    <h3>Overall Risk: {contractReview.risk_level.toUpperCase()}</h3>
                  </div>
                  
                  <div className="review-summary">
                    <h4>Summary</h4>
                    <p>{contractReview.summary}</p>
                  </div>
                  
                  <div className="annotations-section">
                    <h4>📝 Annotations & Suggestions</h4>
                    {contractReview.annotations && contractReview.annotations.map((annotation, index) => (
                      <div key={index} className={`annotation severity-${annotation.severity}`}>
                        <div className="annotation-header">
                          <span className="severity-badge">{annotation.severity}</span>
                          <h5>Issue: {annotation.issue}</h5>
                        </div>
                        <div className="annotation-content">
                          <p><strong>Original Text:</strong> {annotation.text}</p>
                          <p><strong>Suggestion:</strong> {annotation.suggestion}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;