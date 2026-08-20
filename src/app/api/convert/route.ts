import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key is not configured on the server. Please add GEMINI_API_KEY to your Netlify Environment Variables.' },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = \`
You are an expert instructional designer and technical assistant. 
Your task is to convert the following raw assessment text (which may be a mix of questions, answers, multiple choice options, and feedback) into a strict Brightspace-compatible CSV format.

Here is the exact template/format you MUST follow for Brightspace CSVs:
\${BRIGHTSPACE_CSV_TEMPLATE}

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
\${text}
---

Return ONLY the valid CSV output.
\`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let csvText = response.text();

    // Clean up potential markdown formatting from the response
    csvText = csvText.replace(/^\`\`\`(csv)?/g, '').replace(/\`\`\`$/g, '').trim();

    return NextResponse.json({ csv: csvText });
  } catch (error: any) {
    console.error('Error generating CSV:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred during conversion' },
      { status: 500 }
    );
  }
}
