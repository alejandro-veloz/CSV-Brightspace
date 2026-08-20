'use client';

import { useState, useRef } from 'react';
import styles from './page.module.css';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Download, FileType } from 'lucide-react';
import * as mammoth from 'mammoth';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvResult, setCsvResult] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.docx')) {
        setFile(droppedFile);
      } else {
        setError('Please upload a valid .docx Word document.');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const extractTextFromDocx = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          resolve(result.value);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleSubmit = async () => {
    setError(null);
    setCsvResult(null);
    setIsLoading(true);

    try {
      let contentToProcess = text;

      if (activeTab === 'file') {
        if (!file) throw new Error('Please select a file to process.');
        contentToProcess = await extractTextFromDocx(file);
      }

      if (!contentToProcess.trim()) {
        throw new Error('Please provide some text or a non-empty document.');
      }

      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: contentToProcess }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch(e) {}
        
        const detailedError = errorData?.error || errorData?.errorMessage || errorText || 'Failed to convert document.';
        throw new Error(`Server returned ${response.status}: ${detailedError}`);
      }

      const data = await response.json();
      setCsvResult(data.csv);

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCsv = () => {
    if (!csvResult) return;
    
    // Brightspace requires UTF-8 with BOM to correctly display special characters
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvResult], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'Brightspace_Import.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className={styles.container}>
      <header className={`${styles.header} animate-fade-in`}>
        <h1 className={styles.title}>Brightspace Evaluator</h1>
        <p className={styles.subtitle}>
          Instantly convert your quizzes, exams, and assessments into a Brightspace-ready CSV format using AI. 
          Supports written response, multiple choice, matching, and more.
        </p>
      </header>

      {!csvResult ? (
        <div className="glass-panel animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className={styles.tabs}>
            <button 
              className={`${styles.tab} ${activeTab === 'text' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('text')}
            >
              Paste Text
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'file' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('file')}
            >
              Upload Word (.docx)
            </button>
          </div>

          {activeTab === 'text' && (
            <textarea
              className={`glass-input ${styles.textarea}`}
              placeholder="Paste your questions here... e.g. 
1. What is the capital of France?
A) London
B) Paris
C) Berlin
D) Madrid
Answer: B"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          )}

          {activeTab === 'file' && (
            <div 
              className={`${styles.uploadArea} ${isDragging ? styles.uploadAreaActive : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                accept=".docx" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileSelect}
              />
              <UploadCloud size={48} className={styles.icon} />
              <div>
                {file ? (
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</p>
                ) : (
                  <>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                      Click to upload or drag and drop
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Word documents (.docx) only
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className={`${styles.error} animate-fade-in`}>
              <AlertCircle size={20} />
              <p>{error}</p>
            </div>
          )}

          <div className={styles.actions}>
            <button 
              className="btn-primary" 
              onClick={handleSubmit}
              disabled={isLoading || (activeTab === 'text' && !text.trim()) || (activeTab === 'file' && !file)}
            >
              {isLoading ? (
                <>
                  <span className="loader"></span> Processing AI...
                </>
              ) : (
                <>
                  <FileType size={20} /> Convert to CSV
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-panel animate-fade-in">
          <div className={styles.success}>
            <div className={styles.successIcon}>
              <CheckCircle2 size={64} />
            </div>
            <h2>Conversion Successful!</h2>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '500px' }}>
              Your assessment has been intelligently formatted into a Brightspace compatible CSV.
            </p>
            
            <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
              <button 
                className="btn-primary" 
                onClick={downloadCsv}
              >
                <Download size={20} /> Download CSV
              </button>
              
              <button 
                className={styles.tab} 
                onClick={() => {
                  setCsvResult(null);
                  setText('');
                  setFile(null);
                }}
              >
                Convert Another
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
