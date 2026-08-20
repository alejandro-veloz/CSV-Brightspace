'use client';

import { useState, useRef } from 'react';
import styles from './page.module.css';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Download, FileType } from 'lucide-react';
import * as mammoth from 'mammoth';
import { GoogleGenerativeAI } from '@google/generative-ai';

const BRIGHTSPACE_CSV_TEMPLATE = `
//(Note: The 'images' folder is assumed to be in the "/content/<course path>/" directory),,,,
//Question Text is always a required field,,,,
// An ID will be generated using the (Course code)-(Question number) if an ID is not specified for a question,,,,
,,,,
"// Please ensure that the CSV file is saved as ""CSV UTF-8"" encoded to ensure that non-ASCII characters like à, ø, é and other are able to be correctly imported",,,,
,,,,
//WRITTEN RESPONSE QUESTION TYPE,,,,
//This sample question also shows how you can set a question caID for the question of format {Course Code}-{Question Number},,,,
NewQuestion,WR,,,
ID,CHEM110-234,,,
Title,This is a written response question,,,
QuestionText,This is the question text for WR1,,,
Points,1,,,
Difficulty,7,,,
Image,images/LA1.jpg,,,
InitialText,This is the initial text,,,
AnswerKey,This is the answer key text,,,
Hint,This is the hint text,,,
Feedback,This is the feedback text,,,
,,,,
//SHORT ANSWER QUESTION TYPE,,,,
NewQuestion,SA,,,
ID,CHEM110-235,,,
Title,This is a short answer question,,,
QuestionText,This is the question text for SA1,,,
Points,5,,,
Difficulty,2,,,
Image,images/SA1.jpg,,,
InputBox,3,40,,
Answer,100,This is the text for answer 1,regexp,
Answer,50,This is the text for answer 2,,
Hint,This is the hint text,,,
Feedback,This is the feedback text,,,
,,,,
//MATCHING QUESTION TYPE,,,,
NewQuestion,M,,,
ID,CHEM110-236,,,
Title,This is a matching question,,,
QuestionText,This is the question text for M1,,,
Points,2,,,
Difficulty,2,,,
Image,images/mc1.jpg,,,
Scoring,EquallyWeighted,,,
Choice,1,This is choice 1 text,,
Choice,2,This is choice 2 text,,
Choice,3,This is choice 3 text,,
Match,3,This matches with choice 3,,
Match,1,This matches with choice 1,,
Match,2,This matches with choice 2,,
Hint,This is the hint text,,,
Feedback,This is the feedback text,,,
,,,,
//MULTIPLE CHOICE QUESTION TYPE,,,,
NewQuestion,MC,,,
ID,CHEM110-237,,,
Title,This is a multiple choice question,,,
QuestionText,This is the question text for MC1,,,
Points,1,,,
Difficulty,1,,,
Image,images/MC1.jpg,,,
Option,100,This is the correct answer,,This is feedback for option 1
Option,0,This is incorrect answer 1,,This is feedback for option 2
Option,0,This is incorrect answer 2,,This is feedback for option 3
Option,25,This is partially correct,,This is feedback for option 4
Hint,This is the hint text,,,
Feedback,This is the feedback text,,,
,,,,
//TRUE / FALSE QUESTION TYPE,,,,
NewQuestion,TF,,,
ID,CHEM110-238,,,
Title,This is a True/False question,,,
QuestionText,This is the question text for TF1,,,
Points,1,,,
Difficulty,1,,,
Image,images/TF1.jpg,,,
TRUE,100,This is feedback for 'TRUE',,
FALSE,0,This is feedback for 'FALSE',,
Hint,This is the hint text,,,
Feedback,This is the feedback text,,,
,,,,
//MULTISELECT QUESTION TYPE,,,,
NewQuestion,MS,,,
ID,CHEM110-239,,,
Title,This is a Multi-Select question,,,
QuestionText,This is the question text for MS1,,,
Points,10,,,
Difficulty,5,,,
Image,images/MS1.jpg,,,
Scoring,RightAnswers,,,
Option,1,This is option 1 text,,This is feedback for option 1
Option,0,This is option 2 text,,This is feedback for option 2
Option,1,This is option 3 text,,This is feedback for option 3
Hint,This is the hint text,,,
Feedback ,This is the feedback text,,,
,,,,
//ORDERING QUESTION TYPE,,,,
NewQuestion,O,,,
ID,CHEM110-240,,,
Title,This is an ordering question,,,
QuestionText,This is the question text for O1,,,
Points,2,,,
Difficulty,2,,,
Scoring,RightMinusWrong,,,
Image,images/O1.jpg,,,
Item,This is the text for item 1,NOT HTML,This is feedback for option 1,
Item,This is the text for item 2,HTML,This is feedback for option 2,
Hint,This is the hint text,,,
Feedback,This is the feedback text,,,
`;

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
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing NEXT_PUBLIC_GEMINI_API_KEY environment variable. Please configure it in Netlify.");
      }

      let contentToProcess = text;
      if (activeTab === 'file') {
        if (!file) throw new Error('Please select a file to process.');
        contentToProcess = await extractTextFromDocx(file);
      }

      if (!contentToProcess.trim()) {
        throw new Error('Please provide some text or a non-empty document.');
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const prompt = `
You are an expert instructional designer and technical assistant. 
Your task is to convert the following raw assessment text (which may be a mix of questions, answers, multiple choice options, and feedback) into a strict Brightspace-compatible CSV format.

Here is the exact template/format you MUST follow for Brightspace CSVs:
${BRIGHTSPACE_CSV_TEMPLATE}

Rules:
1. Identify the question type for each question (MC = Multiple Choice, TF = True/False, WR = Written Response, SA = Short Answer, M = Matching, MS = MultiSelect, O = Ordering).
2. For each question, output "NewQuestion,[TYPE],,,".
3. Generate a logical "Title" and extract the "QuestionText".
4. Assign default Points (e.g., 1 or as specified in text) and Difficulty (1).
5. For Options (MC, MS), set the correct answer to 100, and incorrect to 0. Extract any feedback provided for each option and put it in the 5th column.
6. For Feedback or Hints applied to the whole question, use the Feedback or Hint rows.
7. Only output the raw CSV data. DO NOT include markdown formatting (like \`\`\`csv or \`\`\`). Do not add any conversational text.

Here is the raw text to convert:

---
${contentToProcess}
---

Return ONLY the valid CSV output.
`;

      let model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
      let result;
      
      try {
        result = await model.generateContent(prompt);
      } catch (err) {
        // Fallback
        model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        result = await model.generateContent(prompt);
      }

      const response = await result.response;
      let csvText = response.text();
      csvText = csvText.replace(/^```(csv)?/g, '').replace(/```$/g, '').trim();

      setCsvResult(csvText);

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCsv = () => {
    if (!csvResult) return;
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
