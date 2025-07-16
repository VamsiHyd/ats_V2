from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import google.generativeai as genai
import os
import io
import re
import pytesseract
import pdf2image

# Load environment variables
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError("❌ GEMINI_API_KEY not found in .env")

genai.configure(api_key=GEMINI_API_KEY)

app = Flask(__name__)
CORS(app)

# Extract score from model output
def extract_score(text):
    match = re.search(r"\b(\d{1,3})\s*/\s*100\b", text)
    if match:
        return int(match.group(1))
    match = re.search(r"Score:\s*(\d{1,3})", text)
    if match:
        return int(match.group(1))
    return 0

# OCR: Extract text from PDF
def convert_pdf_to_text(pdf_file):
    try:
        images = pdf2image.convert_from_bytes(pdf_file.read())
        text = ""
        for page in images[:2]:  # first 2 pages only
            text += pytesseract.image_to_string(page)
        return text.strip()
    except Exception as e:
        print("❌ OCR error:", e)
        return None

# Gemini text generation
def generate_text_response(prompt):
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print("❌ Gemini error:", e)
        return "❌ LLM evaluation failed. Please try again later."

# Resume evaluator
def evaluate_resume(resume_text, mode="match", job_keywords=None, jd=""):
    if mode == "match":
        if not job_keywords:
            return "⚠️ No job description provided for ATS Match Check."
        prompt = f"""
You are a strict ATS evaluator.

Evaluate the resume below against these job-related keywords:
{', '.join(job_keywords)}

Respond in this exact format:
Score: XX/100
Matched Keywords: [...]
Missing Keywords: [...]
Final Thoughts: (1 sentence only)

Resume content:
{resume_text}
"""
    elif mode == "tech_audit":
        prompt = f"""
You are a technical recruiter reviewing a resume.

1. Identify outdated or legacy tools/technologies.
2. Identify missing but in-demand modern technologies.
3. Give a Modern Tech Score (0–100) based on tool relevance.
4. Suggest one or two suitable career paths based on the resume content.

Respond in the following format:

Feedback:
- ...
- ...

Career Path: <text>

Modern Tech Score: XX/100

Resume content:
{resume_text}
"""
    elif mode == "improve":
        prompt = f"""
You are a resume writing expert.

Read the following resume and provide advice to improve it, including:
- Content quality and clarity
- Use of quantifiable achievements
- Formatting or structure

Return your suggestions in 2–3 concise paragraphs.

Resume content:
{resume_text}
"""
    else:
        return "❌ Unknown evaluation mode."

    return generate_text_response(prompt)

# Keyword extractor for JD
def extract_keywords_from_description_llm(job_description):
    prompt = f"""
Extract the 10–15 most important job keywords, qualifications, and experience from the job description below.
Respond with a comma-separated list only.

Job Description:
{job_description}
"""
    response = generate_text_response(prompt)
    return [kw.strip() for kw in response.split(",")]

# Resume evaluation endpoint
@app.route("/evaluate-resumes", methods=["POST"])
def evaluate_resumes():
    role = request.form.get("role", "candidate")
    mode = request.form.get("mode", "match")

    if "resumes" not in request.files:
        return jsonify({"error": "Please upload at least one resume file."}), 400

    uploaded_files = request.files.getlist("resumes")
    if not uploaded_files or all(f.filename == "" for f in uploaded_files):
        return jsonify({"error": "Resume files are empty."}), 400

    if role == "candidate" and len(uploaded_files) != 1:
        return jsonify({"error": "Candidate mode only supports one resume."}), 400

    if role == "recruiter":
        if mode != "match":
            return jsonify({"error": "Recruiter mode only supports ATS Match Check."}), 400
        if "job_description" not in request.form:
            return jsonify({"error": "Job description is required for recruiter mode."}), 400

    jd = request.form.get("job_description", "").strip()
    if mode == "match" and not jd:
        return jsonify({"error": "Job description is required for ATS Match Check."}), 400

    keywords = extract_keywords_from_description_llm(jd) if mode == "match" else []
    results = []

    for file in uploaded_files:
        filename = file.filename
        file.stream.seek(0)  # reset pointer
        resume_text = convert_pdf_to_text(file)

        if not resume_text:
            results.append({"filename": filename, "feedback": "❌ Failed to extract text from resume."})
            continue

        response = evaluate_resume(resume_text, mode=mode, job_keywords=keywords, jd=jd)

        if mode == "match":
            score = extract_score(response)
            matched_match = re.search(r"Matched Keywords:\s*\[(.*?)\]", response, re.DOTALL)
            missing_match = re.search(r"Missing Keywords:\s*\[(.*?)\]", response, re.DOTALL)
            feedback_match = re.search(r"Final Thoughts:\s*(.*)", response)

            matched = matched_match.group(1).strip() if matched_match else "Not Found"
            missing = missing_match.group(1).strip() if missing_match else "Not Found"
            feedback = feedback_match.group(1).strip() if feedback_match else "Could not extract final thoughts."
            
            results.append({
                "filename": filename,
                "score": score,
                "matched": matched,
                "missing": missing,
                "feedback": feedback
            })

        elif mode == "tech_audit":
            feedback = re.findall(r"Feedback:\s*(.*?)(?:Career Path:|$)", response, re.DOTALL)
            career_path = re.findall(r"Career Path:\s*(.*)", response)
            modern_score = extract_score(response)

            results.append({
                "filename": filename,
                "feedback": feedback[0].strip() if feedback else response,
                "career_path": career_path[0].strip() if career_path else "",
                "modern_score": modern_score
            })

        elif mode == "improve":
            results.append({
                "filename": filename,
                "feedback": response
            })

    if mode == "match":
        results.sort(key=lambda x: x.get("score", 0), reverse=True)

    return jsonify(results)

if __name__ == "__main__":
    app.run(debug=True, port=8001)
