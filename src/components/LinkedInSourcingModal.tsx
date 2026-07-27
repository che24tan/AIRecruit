import React, { useState, useEffect } from "react";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Search,
  Sparkles,
  UserPlus,
  Loader2,
  AlertCircle,
  MessageSquare,
  Globe,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { Candidate, CandidateStatus } from "../types";

interface LinkedInSourcingModalProps {
  isOpen: boolean;
  onClose: () => void;
  jdText: string;
  jobId?: string;
  jobTitle?: string;
  jobLocation?: string;
  onAddCandidate: (cand: Candidate) => void;
}

interface SourcingData {
  searchKeywords: string;
  titleVariations: string[];
  mustHaveSkills: string[];
  inMailTemplate: string;
  sourcingAdvice: string;
  linkedinDirectUrl: string;
  googleXrayUrl: string;
}

export const LinkedInSourcingModal: React.FC<LinkedInSourcingModalProps> = ({
  isOpen,
  onClose,
  jdText,
  jobId,
  jobTitle,
  jobLocation,
  onAddCandidate,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourcingData, setSourcingData] = useState<SourcingData | null>(null);

  const [copiedQuery, setCopiedQuery] = useState(false);
  const [copiedInMail, setCopiedInMail] = useState(false);

  // Import profile state
  const [pastedProfile, setPastedProfile] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && jdText) {
      fetchSourcingData();
    }
  }, [isOpen, jdText]);

  const fetchSourcingData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/source-linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd: jdText,
          jobId,
          jobTitle,
          jobLocation,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate LinkedIn sourcing queries.");

      setSourcingData(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate sourcing data.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportProfile = async () => {
    if (!pastedProfile.trim()) {
      setError("Please paste a LinkedIn profile text or experience snippet.");
      return;
    }

    setImporting(true);
    setError(null);
    setImportSuccess(null);

    try {
      const res = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: pastedProfile,
          filename: "Sourced from LinkedIn",
        }),
      });

      const parsed = await res.json();
      if (!res.ok) throw new Error(parsed.error || "Failed to parse LinkedIn profile.");

      const newCand: Candidate = {
        id: "c_li_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        name: parsed.name || "Sourced LinkedIn Candidate",
        title: parsed.title || jobTitle || "LinkedIn Candidate",
        email: parsed.email || "",
        phone: parsed.phone || "",
        skills: parsed.skills || [],
        years_experience: parsed.years_experience || "",
        location: parsed.location || jobLocation || "",
        visa_status_stated: parsed.visa_status_stated || "",
        employment_type_stated: parsed.employment_type_stated || "",
        summary: parsed.summary || "",
        resume_text: pastedProfile,
        source: "LinkedIn Sourced",
        status: "New" as CandidateStatus,
        notes: `Sourced directly via LinkedIn for ${jobId || "req"} (${jobTitle || "Role"})`,
        added: new Date().toISOString().slice(0, 10),
      };

      onAddCandidate(newCand);
      setImportSuccess(`Successfully imported "${newCand.name}" into Candidate Bank!`);
      setPastedProfile("");
    } catch (err: any) {
      setError(err.message || "Failed to import candidate profile.");
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#07090e]/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="glass-card rounded-2xl max-w-3xl w-full my-8 flex flex-col shadow-2xl overflow-hidden border border-[#233148]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#233148] bg-[#121824]/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-['Space_Grotesk'] text-base font-bold text-slate-100 flex items-center gap-2">
                <span>LinkedIn Sourcing Assistant</span>
                <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-lg font-mono">
                  Gemini AI
                </span>
              </h3>
              <p className="text-slate-400 text-xs font-mono mt-0.5">
                Targeting: {jobTitle || "Job Requirement"} {jobId ? `(${jobId})` : ""}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 rounded-xl hover:bg-[#1f2b3e] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-xs max-h-[80vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-16 space-y-4">
              <Loader2 className="w-9 h-9 text-amber-400 animate-spin mx-auto" />
              <p className="text-slate-300 font-['Space_Grotesk'] text-sm font-medium">
                Analyzing Job Description and generating direct LinkedIn search parameters...
              </p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : sourcingData ? (
            <>
              {/* Sourcing Launch Buttons */}
              <div className="bg-[#121824] border border-[#233148] rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#233148] pb-3">
                  <div>
                    <h4 className="font-['Space_Grotesk'] font-bold text-slate-100 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Instant Search Launches
                    </h4>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Launch optimized candidate searches directly in LinkedIn or Google X-Ray.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href={sourcingData.linkedinDirectUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-['Space_Grotesk'] font-bold text-xs px-4 py-3.5 rounded-xl transition shadow-lg cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <span>Search LinkedIn People</span>
                    </span>
                    <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                  </a>

                  <a
                    href={sourcingData.googleXrayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between bg-[#161f30] hover:bg-[#202b3e] text-slate-100 border border-[#233148] font-['Space_Grotesk'] font-bold text-xs px-4 py-3.5 rounded-xl transition cursor-pointer group"
                  >
                    <span className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-teal-400" />
                      <span>Google X-Ray LinkedIn Search</span>
                    </span>
                    <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                  </a>
                </div>

                {sourcingData.sourcingAdvice && (
                  <div className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl font-mono leading-relaxed">
                    <span className="font-bold uppercase text-amber-400">Recruiter Tip: </span>
                    {sourcingData.sourcingAdvice}
                  </div>
                )}
              </div>

              {/* Keyword String & Title Variations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Keywords */}
                <div className="bg-[#121824] border border-[#233148] rounded-xl p-4.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                      LinkedIn Search Keywords
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(sourcingData.searchKeywords);
                        setCopiedQuery(true);
                        setTimeout(() => setCopiedQuery(false), 2000);
                      }}
                      className="text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono text-[11px] cursor-pointer"
                    >
                      {copiedQuery ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedQuery ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <div className="bg-[#0d1117] border border-[#233148] rounded-lg p-3 font-mono text-xs text-amber-300 select-all leading-relaxed">
                    {sourcingData.searchKeywords}
                  </div>
                </div>

                {/* Title Variations */}
                <div className="bg-[#121824] border border-[#233148] rounded-xl p-4.5">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400 font-semibold block mb-2.5">
                    Target Candidate Titles on LinkedIn
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {(sourcingData.titleVariations || []).map((title, idx) => {
                      const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
                        `"${title}" ${sourcingData.mustHaveSkills.slice(0, 2).map((s) => `"${s}"`).join(" ")}`
                      )}`;

                      return (
                        <a
                          key={idx}
                          href={searchUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-[#161f30] hover:bg-[#202b3e] text-slate-200 border border-[#233148] text-xs font-mono px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer group"
                        >
                          <span>{title}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition" />
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Outreach InMail Template */}
              <div className="bg-[#121824] border border-[#233148] rounded-xl p-4.5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    Personalized Outreach InMail Template
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(sourcingData.inMailTemplate);
                      setCopiedInMail(true);
                      setTimeout(() => setCopiedInMail(false), 2000);
                    }}
                    className="text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono text-[11px] cursor-pointer"
                  >
                    {copiedInMail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedInMail ? "Copied" : "Copy InMail"}</span>
                  </button>
                </div>
                <div className="bg-[#0d1117] border border-[#233148] rounded-lg p-3.5 font-sans text-xs text-slate-200 leading-relaxed whitespace-pre-wrap select-all">
                  {sourcingData.inMailTemplate}
                </div>
              </div>

              {/* Import Sourced Profile */}
              <div className="bg-[#121824] border border-[#233148] rounded-xl p-5 space-y-4">
                <div>
                  <h4 className="font-['Space_Grotesk'] font-bold text-slate-100 text-sm flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-400" />
                    Import Sourced Profile into Candidate Bank
                  </h4>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Found a great profile on LinkedIn? Copy their About/Experience text and paste it here. Gemini will parse and save them to your bank.
                  </p>
                </div>

                <textarea
                  rows={4}
                  value={pastedProfile}
                  onChange={(e) => setPastedProfile(e.target.value)}
                  placeholder="Paste LinkedIn candidate profile text (Headline, About, Work History)..."
                  className="w-full bg-[#0d1117] border border-[#233148] rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-500 font-sans focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition leading-relaxed"
                />

                <div className="flex items-center justify-between">
                  <button
                    onClick={handleImportProfile}
                    disabled={importing || !pastedProfile.trim()}
                    className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-[#0d1117] font-['Space_Grotesk'] font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-40 shadow-md"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    <span>Import & Save Candidate</span>
                  </button>

                  {importSuccess && (
                    <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <CheckCircle2 className="w-4 h-4" />
                      {importSuccess}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#233148] bg-[#121824]/90 flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#161f30] hover:bg-[#202b3e] text-slate-200 font-['Space_Grotesk'] font-semibold text-xs px-5 py-2.5 rounded-xl border border-[#233148] transition cursor-pointer"
          >
            Close Assistant
          </button>
        </div>
      </div>
    </div>
  );
};

