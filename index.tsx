import React, { useState, useEffect } from "react";

export default function Home() {
  const [role, setRole] = useState("candidate");
  const [jd, setJd] = useState("");
  const [mode, setMode] = useState("match");
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : "light"));
  };

  const handleSubmit = async () => {
    if (!files || (role === "candidate" && files.length !== 1)) {
      setError("Please upload the correct number of resumes.");
      return;
    }
    if (mode === "match" && jd.trim() === "") {
      setError("Job description is required for ATS Match Check.");
      return;
    }

    setLoading(true);
    setResults([]);
    setError("");

    const formData = new FormData();
    formData.append("role", role);
    formData.append("mode", mode);
    if (mode === "match") formData.append("job_description", jd);
    files.forEach(file => formData.append("resumes", file));

    try {
      const res = await fetch("http://localhost:8001/evaluate-resumes", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Server error.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setResults(data);
    } catch (error) {
      alert("Error during evaluation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getAvailableModes = () => {
    return role === "candidate"
      ? [
          { label: "ATS Match Check", value: "match" },
          { label: "Tech Audit", value: "tech_audit" },
          { label: "Improve Resume", value: "improve" },
        ]
      : [{ label: "ATS Match Check", value: "match" }];
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-2xl p-8 rounded-xl shadow-xl space-y-6">
        <div className="flex justify-end items-center space-x-3">
  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">🌙 Dark Mode</span>
  <button
    onClick={toggleTheme}
    className={`w-12 h-6 flex items-center rounded-full transition-colors duration-300 shadow-inner ${
      theme === 'dark' ? 'bg-indigo-600' : 'bg-gray-300'
    }`}
  >
    <div
      className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${
        theme === 'dark' ? 'translate-x-7' : 'translate-x-1'
      }`}
    ></div>
  </button>
</div>


        <h1 className="text-3xl font-bold text-center text-gray-800 dark:text-gray-100">
          🧠 LLM-Powered ATS Evaluator
        </h1>
        <p className="text-center text-gray-500 dark:text-gray-300">
          Upload your resume(s) and evaluate them against job descriptions using AI.
        </p>

        {/* Role Selector */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Role</label>
          <select
            value={role}
            onChange={(e) => {
              const selectedRole = e.target.value;
              setRole(selectedRole);
              setMode("match");
              setFiles([]);
            }}
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-indigo-500"
          >
            <option value="candidate">🙋 Candidate</option>
            <option value="recruiter">💼 Recruiter</option>
          </select>
        </div>

        {/* Evaluation Mode */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Evaluation Mode</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            disabled={role === "recruiter"}
            className={`w-full p-2 border border-gray-300 rounded-md transition focus:outline-none focus:ring-2 ${
              role === "recruiter"
                ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 cursor-not-allowed"
                : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-indigo-500"
            }`}
          >
            {getAvailableModes().map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Job Description */}
        {mode === "match" && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Job Description</label>
            <textarea
              rows={4}
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
              placeholder="Paste the job description here..."
            />
          </div>
        )}

        {/* Resume Upload */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {role === "candidate" ? "Upload Your Resume" : "Upload Resumes (PDF)"}
          </label>
          <input
            type="file"
            accept="application/pdf"
            multiple={role === "recruiter"}
            onChange={(e) => {
              if (e.target.files) {
                const selectedFiles = Array.from(e.target.files);
                setFiles(prev => [...prev, ...selectedFiles]);
              }
            }}
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100"
          />
        </div>

        {/* Selected File List for Recruiter */}
        {role === "recruiter" && files.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Selected Resumes</label>
            <ul className="space-y-1">
              {files.map((file, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 px-3 py-2 border rounded-md"
                >
                  <span className="truncate text-gray-800 dark:text-gray-100">{file.name}</span>
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-red-500 hover:text-red-700 font-semibold text-sm"
                  >
                    ❌ Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-md font-medium shadow-md transition transform hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          🚀 Submit
        </button>

        {/* Spinner */}
        {loading && (
          <div className="flex justify-center mt-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-blue-600 border-opacity-50"></div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-800 rounded border border-red-300">
            ⚠️ {error}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4 pt-4">
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">
              📊 Results
            </h2>
            {results.map((res: any, idx) => (
              <div
                key={idx}
                className="p-4 border rounded-md bg-white dark:bg-gray-700 shadow-sm space-y-2"
              >
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{res.filename}</h3>
                {"score" in res && <p>🎯 Score: {res.score}/100</p>}
                {"modern_score" in res && <p>🧪 Modern Tech Score: {res.modern_score}/100</p>}
                {"matched" in res && <p>✅ Matched: {res.matched}</p>}
                {"missing" in res && <p>❌ Missing: {res.missing}</p>}
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{res.feedback}</p>
                {"career_path" in res && (
                  <p className="mt-2 text-sm italic text-blue-700 dark:text-blue-300">
                    💼 {res.career_path}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

