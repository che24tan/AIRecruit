import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  UserPlus,
  Download,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  Mail,
  Phone,
  Tag,
  X,
  Edit2,
  Users,
  RefreshCw,
} from "lucide-react";
import { Candidate, CandidateStatus } from "../types";
import { extractTextFromFile } from "../utils/fileExtractor";

interface TabCandidateBankProps {
  candidates: Candidate[];
  onAddCandidate: (cand: Candidate) => void;
  onUpdateCandidate: (id: string, updates: Partial<Candidate>) => void;
  onRemoveCandidate: (id: string) => void;
  onClearAll: () => void;
}

export const TabCandidateBank: React.FC<TabCandidateBankProps> = ({
  candidates,
  onAddCandidate,
  onUpdateCandidate,
  onRemoveCandidate,
  onClearAll,
}) => {
  const [pasteText, setPasteText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isReParsing, setIsReParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Helper to process task queue with concurrency limit (e.g. 3 at a time)
  const runConcurrentQueue = async (
    tasks: { name: string; taskFn: () => Promise<boolean> }[],
    concurrency: number,
    onProgress: (completed: number, total: number, successes: number, failures: number, currentName: string) => void
  ) => {
    let completed = 0;
    let successes = 0;
    let failures = 0;
    const total = tasks.length;

    const queue = [...tasks];
    const workers = Array.from({ length: Math.min(concurrency, total) }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        try {
          const ok = await item.taskFn();
          if (ok) successes++;
          else failures++;
        } catch (err) {
          failures++;
          console.error(`Error processing ${item.name}:`, err);
        } finally {
          completed++;
          onProgress(completed, total, successes, failures, item.name);
        }
      }
    });

    await Promise.all(workers);
    return { successes, failures };
  };

  // Handle file drop / upload with parallel batch processing
  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsParsing(true);
    setParseStatus({ text: `Extracting and parsing ${fileArray.length} resume file(s)...` });

    const tasks = fileArray.map((file) => ({
      name: file.name,
      taskFn: async () => {
        const text = await extractTextFromFile(file);
        return await parseAndAddCandidate(text, file.name);
      },
    }));

    const { successes, failures } = await runConcurrentQueue(
      tasks,
      3, // 3 parallel workers for fast processing without hitting rate limits
      (completed, total, successes, failures, currentName) => {
        setParseStatus({
          text: `Parsing ${completed}/${total} (${successes} added${failures > 0 ? `, ${failures} failed` : ""}). Processing ${currentName}...`,
        });
      }
    );

    setIsParsing(false);
    if (failures > 0) {
      setParseStatus({
        text: `Batch complete: ${successes} resume(s) successfully added, ${failures} file(s) failed or malformed.`,
        error: failures === fileArray.length,
      });
    } else {
      setParseStatus({ text: `Successfully added all ${successes} resume(s) to candidate bank!` });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handle paste text input
  const handlePasteAdd = async () => {
    if (!pasteText.trim()) {
      setParseStatus({ text: "Please paste resume text first.", error: true });
      return;
    }

    const chunks = pasteText
      .split(/^====$/m)
      .map((c) => c.trim())
      .filter(Boolean);

    setIsParsing(true);
    setParseStatus({ text: `Parsing ${chunks.length} candidate resume(s)...` });

    const tasks = chunks.map((chunk, idx) => ({
      name: `Candidate #${idx + 1}`,
      taskFn: async () => {
        return await parseAndAddCandidate(chunk, `Pasted Resume #${idx + 1}`);
      },
    }));

    const { successes, failures } = await runConcurrentQueue(
      tasks,
      3,
      (completed, total, successes, failures, currentName) => {
        setParseStatus({
          text: `Parsing ${completed}/${total} candidate(s)... (${successes} added${failures > 0 ? `, ${failures} failed` : ""})`,
        });
      }
    );

    setIsParsing(false);
    setPasteText("");
    if (failures > 0) {
      setParseStatus({
        text: `Parsed ${successes} candidate(s) successfully. ${failures} candidate chunk(s) failed.`,
        error: failures === chunks.length,
      });
    } else {
      setParseStatus({ text: `Successfully added ${successes} candidate(s) to candidate bank!` });
    }
  };

  const parseAndAddCandidate = async (text: string, sourceName: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: text.slice(0, 12000), // Cap input text to prevent oversized payloads
          filename: sourceName,
        }),
      });

      const parsed = await res.json();
      if (!res.ok) throw new Error(parsed.error || "Parsing failed.");

      const newCand: Candidate = {
        id: "c_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        name: parsed.name || "Unknown Candidate",
        title: parsed.title || "",
        email: parsed.email || "",
        phone: parsed.phone || "",
        skills: parsed.skills || [],
        years_experience: parsed.years_experience || "",
        location: parsed.location || "",
        visa_status_stated: parsed.visa_status_stated || "",
        employment_type_stated: parsed.employment_type_stated || "",
        summary: parsed.summary || "",
        resume_text: text.slice(0, 12000),
        source: sourceName,
        status: "New",
        notes: "",
        added: new Date().toISOString().slice(0, 10),
      };

      onAddCandidate(newCand);
      return true;
    } catch (err) {
      console.error("Parse error for candidate:", err);
      return false;
    }
  };

  const handleReParseCandidate = async (c: Candidate) => {
    try {
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: c.resume_text || c.name || "Resume",
          filename: c.source || "Resume",
        }),
      });
      if (!res.ok) return;
      const parsed = await res.json();
      onUpdateCandidate(c.id, {
        name: parsed.name && !parsed.name.toLowerCase().includes("unknown") ? parsed.name : c.name,
        title: parsed.title || c.title || "IT Professional",
        email: parsed.email || c.email,
        phone: parsed.phone || c.phone,
        skills: Array.isArray(parsed.skills) && parsed.skills.length > 0 ? parsed.skills : c.skills,
        location: parsed.location || c.location,
        visa_status_stated: parsed.visa_status_stated || c.visa_status_stated,
        employment_type_stated: parsed.employment_type_stated || c.employment_type_stated,
        summary: parsed.summary || c.summary,
      });
    } catch (err) {
      console.error("Re-parse error:", err);
    }
  };

  const handleReParseAll = async () => {
    if (candidates.length === 0) return;
    setIsReParsing(true);
    setParseStatus({ text: `Re-parsing and extracting fields for ${candidates.length} candidate(s)...` });

    const tasks = candidates.map((c) => ({
      name: c.name,
      taskFn: async () => {
        await handleReParseCandidate(c);
        return true;
      },
    }));

    await runConcurrentQueue(
      tasks,
      3,
      (completed, total) => {
        setParseStatus({ text: `Extracting fields ${completed}/${total} candidates...` });
      }
    );

    setIsReParsing(false);
    setParseStatus({ text: `Successfully re-parsed all candidates! Fields updated.` });
  };

  // Export CSV
  const handleExportCsv = () => {
    if (candidates.length === 0) return;

    const headers = [
      "Name",
      "Title",
      "Email",
      "Phone",
      "Skills",
      "Location",
      "Visa Stated",
      "Work Type Stated",
      "Years Exp",
      "Status",
      "Source",
      "Added Date",
      "Notes",
    ];

    const rows = candidates.map((c) => [
      c.name,
      c.title,
      c.email,
      c.phone,
      (c.skills || []).join("; "),
      c.location,
      c.visa_status_stated,
      c.employment_type_stated,
      c.years_experience,
      c.status,
      c.source,
      c.added,
      c.notes,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows]
        .map((e) => e.map((val) => `"${(val || "").replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Candidate_Bank_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtering candidates
  const filteredCandidates = candidates.filter((c) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      c.name.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q) ||
      c.visa_status_stated.toLowerCase().includes(q) ||
      (c.skills || []).some((s) => s.toLowerCase().includes(q));

    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: CandidateStatus) => {
    switch (status) {
      case "New":
        return "bg-blue-500/15 text-blue-400 border-blue-500/30 font-semibold";
      case "Submitted":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30 font-semibold";
      case "Interviewed":
        return "bg-teal-500/15 text-teal-300 border-teal-500/30 font-semibold";
      case "Placed":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold";
      case "Rejected":
        return "bg-slate-500/15 text-slate-400 border-slate-500/30 font-semibold";
      case "Burned":
        return "bg-red-500/15 text-red-400 border-red-500/30 font-semibold";
      default:
        return "bg-slate-500/15 text-slate-400 border-slate-500/30 font-semibold";
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload & Paste Panel */}
      <div className="glass-card rounded-2xl p-6 shadow-xl">
        <h2 className="font-['Space_Grotesk'] text-lg font-bold text-slate-100 flex items-center gap-2.5 mb-1">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <UserPlus className="w-5 h-5" />
          </div>
          <span>Add Candidates to Bank</span>
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm mb-5 leading-relaxed">
          Upload resumes (.txt, .docx, .pdf) or paste raw profile text. Gemini automatically extracts skills, contact info, visa claims, and work arrangements.
        </p>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? "border-amber-400 bg-amber-400/10 text-amber-300 shadow-lg glow-amber"
              : "border-[#233148] hover:border-amber-500/40 bg-[#121824]/60 text-slate-400"
          }`}
        >
          <UploadCloud className="w-10 h-10 mx-auto mb-3 text-amber-400 animate-bounce" style={{ animationDuration: '3s' }} />
          <p className="font-['Space_Grotesk'] font-bold text-sm sm:text-base text-slate-100">
            Drop resume files here, or click to browse (.txt / .docx / .pdf)
          </p>
          <p className="text-slate-500 text-xs mt-1 font-mono">
            Supports batch upload of multiple candidate profiles simultaneously
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            multiple
            accept=".txt,.docx,.pdf"
            className="hidden"
          />
        </div>

        {/* Paste Resume Text Box */}
        <div className="mt-5">
          <label className="block text-slate-400 text-xs mb-1.5 font-mono">
            Or paste resume text directly (use <span className="text-amber-400 font-bold">====</span> on its own line between multiple resumes)
          </label>
          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste resume text or profile content here..."
            className="w-full bg-[#121824] border border-[#233148] rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-500 font-sans focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition resize-y leading-relaxed"
          />
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={handlePasteAdd}
              disabled={isParsing}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0d1117] font-['Space_Grotesk'] font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-40 shadow-md glow-amber"
            >
              {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              <span>Parse & Save Candidate(s)</span>
            </button>

            {parseStatus && (
              <span
                className={`text-xs font-mono flex items-center gap-1.5 p-2 rounded-lg border ${
                  parseStatus.error
                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-300"
                }`}
              >
                {parseStatus.error ? <AlertCircle className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {parseStatus.text}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Candidate Bank Table Panel */}
      <div className="glass-card rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-['Space_Grotesk'] text-lg font-bold text-slate-100 flex items-center gap-2.5">
              <Users className="w-5 h-5 text-amber-400" />
              Candidate Bank ({candidates.length})
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Click any inline cell to edit candidate records. Automatically saved locally.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleReParseAll}
              disabled={candidates.length === 0 || isReParsing}
              className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs text-amber-300 px-3.5 py-2 rounded-xl transition cursor-pointer disabled:opacity-40 font-mono shadow-sm"
              title="Re-parse all resumes and extract Title, Email, Phone, Skills, Location, Visa"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isReParsing ? "animate-spin" : ""}`} />
              <span>{isReParsing ? "Extracting..." : "Re-Parse Fields"}</span>
            </button>

            <button
              onClick={handleExportCsv}
              disabled={candidates.length === 0}
              className="flex items-center gap-1.5 bg-[#121824] hover:bg-[#1c2638] border border-[#233148] text-xs text-slate-200 px-3.5 py-2 rounded-xl transition cursor-pointer disabled:opacity-40 font-mono shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => {
                if (candidates.length === 0) return;
                if (confirm(`Delete all ${candidates.length} candidates from the bank? This action cannot be undone.`)) {
                  onClearAll();
                }
              }}
              disabled={candidates.length === 0}
              className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs text-red-400 px-3.5 py-2 rounded-xl transition cursor-pointer disabled:opacity-40 font-mono"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Bank</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-5">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by candidate name, skill, title, location, visa..."
              className="w-full bg-[#121824] border border-[#233148] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#121824] border border-[#233148] text-xs text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-amber-400 font-mono w-full sm:w-auto cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="New">New</option>
            <option value="Submitted">Submitted</option>
            <option value="Interviewed">Interviewed</option>
            <option value="Placed">Placed</option>
            <option value="Rejected">Rejected</option>
            <option value="Burned">Burned</option>
          </select>
        </div>

        {/* Table View */}
        {filteredCandidates.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-[#233148] rounded-xl bg-[#121824]/40">
            <UserPlus className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-['Space_Grotesk'] text-sm font-semibold">
              {candidates.length === 0
                ? "No candidates in bank yet"
                : "No candidates match the selected search filter"}
            </p>
            <p className="text-slate-500 text-xs font-mono mt-1">
              Upload resumes above or source directly from LinkedIn on Tab 1.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#233148]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#121824] border-b border-[#233148] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3.5">Name</th>
                  <th className="py-3 px-3.5">Title</th>
                  <th className="py-3 px-3.5">Contact</th>
                  <th className="py-3 px-3.5">Top Skills</th>
                  <th className="py-3 px-3.5">Location</th>
                  <th className="py-3 px-3.5">Visa Claimed</th>
                  <th className="py-3 px-3.5">Work Type</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233148]/80 text-slate-200 bg-[#0d1117]/60">
                {filteredCandidates.map((c) => (
                  <tr key={c.id} className="hover:bg-[#161F30] transition-colors group">
                    {/* Name */}
                    <td className="py-3 px-3.5 font-medium">
                      <input
                        type="text"
                        value={c.name}
                        onChange={(e) => onUpdateCandidate(c.id, { name: e.target.value })}
                        className="bg-transparent hover:bg-[#121824] focus:bg-[#121824] border border-transparent hover:border-[#233148] focus:border-amber-400 rounded-lg px-2 py-1 text-xs text-slate-100 font-bold focus:outline-none w-full transition"
                      />
                    </td>

                    {/* Title */}
                    <td className="py-3 px-3.5">
                      <input
                        type="text"
                        value={c.title}
                        onChange={(e) => onUpdateCandidate(c.id, { title: e.target.value })}
                        placeholder="Not specified"
                        className="bg-transparent hover:bg-[#121824] focus:bg-[#121824] border border-transparent hover:border-[#233148] focus:border-amber-400 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none w-full placeholder-slate-600 transition"
                      />
                    </td>

                    {/* Contact */}
                    <td className="py-3 px-3.5 font-mono text-[11px]">
                      <input
                        type="text"
                        value={c.email}
                        onChange={(e) => onUpdateCandidate(c.id, { email: e.target.value })}
                        placeholder="email"
                        className="bg-transparent hover:bg-[#121824] focus:bg-[#121824] border border-transparent hover:border-[#233148] focus:border-amber-400 rounded-lg px-2 py-0.5 text-[11px] text-teal-300 focus:outline-none block w-full placeholder-slate-600 transition"
                      />
                      <input
                        type="text"
                        value={c.phone}
                        onChange={(e) => onUpdateCandidate(c.id, { phone: e.target.value })}
                        placeholder="phone"
                        className="bg-transparent hover:bg-[#121824] focus:bg-[#121824] border border-transparent hover:border-[#233148] focus:border-amber-400 rounded-lg px-2 py-0.5 text-[11px] text-slate-400 focus:outline-none block w-full mt-0.5 placeholder-slate-600 transition"
                      />
                    </td>

                    {/* Skills */}
                    <td className="py-3 px-3.5 max-w-[180px]">
                      <div className="flex flex-wrap gap-1">
                        {(c.skills || []).slice(0, 4).map((s, idx) => (
                          <span
                            key={idx}
                            className="bg-amber-500/10 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded-md border border-amber-500/20 whitespace-nowrap"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-3 px-3.5">
                      <input
                        type="text"
                        value={c.location}
                        onChange={(e) => onUpdateCandidate(c.id, { location: e.target.value })}
                        placeholder="Not specified"
                        className="bg-transparent hover:bg-[#121824] focus:bg-[#121824] border border-transparent hover:border-[#233148] focus:border-amber-400 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none w-full placeholder-slate-600 transition"
                      />
                    </td>

                    {/* Visa Stated */}
                    <td className="py-3 px-3.5">
                      <input
                        type="text"
                        value={c.visa_status_stated}
                        onChange={(e) => onUpdateCandidate(c.id, { visa_status_stated: e.target.value })}
                        placeholder="Not stated"
                        className="bg-transparent hover:bg-[#121824] focus:bg-[#121824] border border-transparent hover:border-[#233148] focus:border-amber-400 rounded-lg px-2 py-1 text-xs text-amber-400 focus:outline-none w-full font-mono placeholder-slate-600 transition"
                      />
                    </td>

                    {/* Work Type */}
                    <td className="py-3 px-3.5">
                      <select
                        value={c.employment_type_stated}
                        onChange={(e) => onUpdateCandidate(c.id, { employment_type_stated: e.target.value })}
                        className="bg-[#121824] border border-[#233148] text-[11px] text-slate-200 px-2 py-1 rounded-lg focus:outline-none focus:border-amber-400 font-mono cursor-pointer"
                      >
                        <option value="">Not stated</option>
                        <option value="C2C">C2C</option>
                        <option value="W2">W2</option>
                        <option value="FTE">FTE</option>
                        <option value="W2/C2C">W2/C2C</option>
                        <option value="C2C/FTE">C2C/FTE</option>
                        <option value="Any">Any</option>
                      </select>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3.5">
                      <select
                        value={c.status}
                        onChange={(e) => onUpdateCandidate(c.id, { status: e.target.value as CandidateStatus })}
                        className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border ${getStatusBadge(
                          c.status
                        )} focus:outline-none cursor-pointer`}
                      >
                        <option value="New" className="bg-[#121824] text-slate-200">New</option>
                        <option value="Submitted" className="bg-[#121824] text-amber-400">Submitted</option>
                        <option value="Interviewed" className="bg-[#121824] text-teal-300">Interviewed</option>
                        <option value="Placed" className="bg-[#121824] text-emerald-400">Placed</option>
                        <option value="Rejected" className="bg-[#121824] text-slate-400">Rejected</option>
                        <option value="Burned" className="bg-[#121824] text-red-400">Burned</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleReParseCandidate(c)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition cursor-pointer"
                          title="Re-extract fields (Title, Contact, Skills, Visa)"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSelectedCandidate(c)}
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition cursor-pointer"
                          title="View Details & Notes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onRemoveCandidate(c.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition cursor-pointer"
                          title="Remove candidate"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-card border border-[#233148] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#233148] bg-[#121824]">
              <div>
                <h3 className="font-['Space_Grotesk'] text-lg font-bold text-slate-100 flex items-center gap-2">
                  <span>{selectedCandidate.name}</span>
                  <span className="text-xs font-mono text-slate-400 font-normal">
                    ({selectedCandidate.title || "No Title"})
                  </span>
                </h3>
                <p className="text-slate-400 text-xs font-mono mt-0.5">
                  Added: {selectedCandidate.added} · Source: {selectedCandidate.source}
                </p>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="p-2 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#121824] p-4 rounded-xl border border-[#233148] font-mono">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Email</span>
                  <span className="text-teal-300 font-medium">{selectedCandidate.email || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Phone</span>
                  <span className="text-slate-200">{selectedCandidate.phone || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Location</span>
                  <span className="text-slate-200">{selectedCandidate.location || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Visa Claimed</span>
                  <span className="text-amber-400">{selectedCandidate.visa_status_stated || "Unstated"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Work Arrangement</span>
                  <span className="text-slate-200">{selectedCandidate.employment_type_stated || "Unstated"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Years Experience</span>
                  <span className="text-slate-200">{selectedCandidate.years_experience || "—"}</span>
                </div>
              </div>

              <div>
                <h4 className="font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-2">
                  Extracted Summary
                </h4>
                <p className="bg-[#121824] p-4 rounded-xl border border-[#233148] text-slate-200 leading-relaxed font-sans">
                  {selectedCandidate.summary || "No summary extracted."}
                </p>
              </div>

              <div>
                <h4 className="font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-2">
                  Recruiter Notes
                </h4>
                <textarea
                  rows={3}
                  value={selectedCandidate.notes}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedCandidate({ ...selectedCandidate, notes: val });
                    onUpdateCandidate(selectedCandidate.id, { notes: val });
                  }}
                  placeholder="Add internal candidate notes (e.g., rate expectations, availability, interview feedback)..."
                  className="w-full bg-[#121824] border border-[#233148] rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-500 font-sans focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <h4 className="font-mono text-[11px] uppercase tracking-wider text-slate-400 mb-2">
                  Raw Resume Text
                </h4>
                <div className="bg-[#121824] border border-[#233148] rounded-xl p-4 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap select-all">
                  {selectedCandidate.resume_text}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#233148] bg-[#121824] flex justify-end">
              <button
                onClick={() => setSelectedCandidate(null)}
                className="bg-amber-500 hover:bg-amber-400 text-[#0d1117] font-['Space_Grotesk'] font-bold text-xs px-5 py-2 rounded-xl transition cursor-pointer shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

