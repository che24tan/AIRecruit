import React, { useState } from "react";
import { Sparkles, Copy, Check, Save, Share2, Search, AlertCircle, Loader2, Globe, FileText } from "lucide-react";
import { JobDescription } from "../types";

interface TabRequirementProps {
  reqId: string;
  setReqId: (val: string) => void;
  title: string;
  setTitle: (val: string) => void;
  location: string;
  setLocation: (val: string) => void;
  jdText: string;
  setJdText: (val: string) => void;
  onSaveJob: (job: JobDescription) => void;
  onOpenSourcingModal: () => void;
}

export const TabRequirement: React.FC<TabRequirementProps> = ({
  reqId,
  setReqId,
  title,
  setTitle,
  location,
  setLocation,
  jdText,
  setJdText,
  onSaveJob,
  onOpenSourcingModal,
}) => {
  const [postOutput, setPostOutput] = useState("");
  const [booleanOutput, setBooleanOutput] = useState("");
  const [isGenPost, setIsGenPost] = useState(false);
  const [isGenBoolean, setIsGenBoolean] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const [copiedPost, setCopiedPost] = useState(false);
  const [copiedBool, setCopiedBool] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleGenPost = async () => {
    if (!jdText.trim()) {
      setStatusMsg({ text: "Please paste a job description first.", error: true });
      return;
    }
    setIsGenPost(true);
    setStatusMsg({ text: "Gemini is crafting a recruiter-native LinkedIn post..." });

    try {
      const res = await fetch("/api/gen-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd: jdText,
          jobId: reqId,
          jobTitle: title,
          jobLocation: location,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");

      setPostOutput(data.post);
      setStatusMsg({ text: "LinkedIn post generated successfully!" });
    } catch (err: any) {
      setStatusMsg({ text: err.message || "Failed to generate post.", error: true });
    } finally {
      setIsGenPost(false);
    }
  };

  const handleGenBoolean = async () => {
    if (!jdText.trim()) {
      setStatusMsg({ text: "Please paste a job description first.", error: true });
      return;
    }
    setIsGenBoolean(true);
    setStatusMsg({ text: "Gemini is generating Boolean strings for Dice, CareerBuilder, LinkedIn..." });

    try {
      const res = await fetch("/api/gen-boolean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd: jdText,
          jobTitle: title,
          jobLocation: location,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed.");

      setBooleanOutput(data.booleanStrings);
      setStatusMsg({ text: "Boolean search strings generated!" });
    } catch (err: any) {
      setStatusMsg({ text: err.message || "Failed to generate Boolean strings.", error: true });
    } finally {
      setIsGenBoolean(false);
    }
  };

  const handleSave = () => {
    if (!jdText.trim()) {
      setStatusMsg({ text: "Cannot save an empty job description.", error: true });
      return;
    }

    const newJob: JobDescription = {
      id: "job_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      reqId: reqId.trim() || `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      title: title.trim() || "Untitled Requirement",
      location: location.trim() || "Unspecified",
      jdText: jdText.trim(),
      addedDate: new Date().toISOString().slice(0, 10),
    };

    onSaveJob(newJob);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
    setStatusMsg({ text: `Saved "${newJob.title}" to Job Descriptions tab.` });
  };

  const copyToClipboard = (text: string, type: "post" | "bool") => {
    navigator.clipboard.writeText(text);
    if (type === "post") {
      setCopiedPost(true);
      setTimeout(() => setCopiedPost(false), 2000);
    } else {
      setCopiedBool(true);
      setTimeout(() => setCopiedBool(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Input Panel */}
      <div className="glass-card rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-['Space_Grotesk'] text-lg font-bold text-slate-100 flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <span>Job Requirement Configuration</span>
          </h2>
        </div>
        <p className="text-slate-400 text-xs sm:text-sm mb-5 leading-relaxed">
          Paste the full job description below. Gemini will analyze the spec to write compliant outreach posts, formulate Boolean search strings, and source matching profiles.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-mono font-medium">Job ID / Req #</label>
            <input
              type="text"
              value={reqId}
              onChange={(e) => setReqId(e.target.value)}
              placeholder="e.g. REQ-1042"
              className="w-full bg-[#121824] border border-[#233148] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-mono font-medium">Job Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Java Developer"
              className="w-full bg-[#121824] border border-[#233148] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-mono font-medium">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Remote / Dallas, TX"
              className="w-full bg-[#121824] border border-[#233148] rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-400 text-xs mb-1.5 font-mono font-medium">Full Job Description *</label>
          <textarea
            rows={10}
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste job description here (responsibilities, required skills, experience level, tech stack)..."
            className="w-full bg-[#121824] border border-[#233148] rounded-xl p-4 text-xs text-slate-100 placeholder-slate-500 font-sans focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition resize-y leading-relaxed"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <button
            onClick={onOpenSourcingModal}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-400 text-white font-['Space_Grotesk'] font-bold text-xs sm:text-sm px-5 py-3 rounded-xl transition-all duration-200 cursor-pointer shadow-lg glow-blue transform hover:-translate-y-0.5"
          >
            <Globe className="w-4 h-4 text-blue-200 animate-spin" style={{ animationDuration: '10s' }} />
            <span>⚡ Source Directly from LinkedIn</span>
          </button>

          <button
            onClick={handleGenPost}
            disabled={isGenPost || isGenBoolean}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0d1117] font-['Space_Grotesk'] font-bold text-xs sm:text-sm px-5 py-3 rounded-xl transition-all duration-200 disabled:opacity-40 cursor-pointer shadow-lg glow-amber transform hover:-translate-y-0.5"
          >
            {isGenPost ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
            <span>Generate LinkedIn Post</span>
          </button>

          <button
            onClick={handleGenBoolean}
            disabled={isGenPost || isGenBoolean}
            className="flex items-center gap-2 bg-[#161F30] hover:bg-[#202B3E] text-slate-200 font-['Space_Grotesk'] font-semibold text-xs sm:text-sm px-4 py-3 rounded-xl border border-[#233148] hover:border-slate-500 transition cursor-pointer"
          >
            {isGenBoolean ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Search className="w-4 h-4 text-amber-400" />}
            <span>Boolean Search Strings</span>
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-transparent hover:bg-[#161F30] text-slate-300 hover:text-slate-100 font-['Space_Grotesk'] font-semibold text-xs sm:text-sm px-4 py-3 rounded-xl border border-[#233148] transition cursor-pointer"
          >
            {savedSuccess ? <Check className="w-4 h-4 text-green-400" /> : <Save className="w-4 h-4 text-slate-400" />}
            <span>{savedSuccess ? "Saved to Library!" : "Save Job"}</span>
          </button>
        </div>

        {statusMsg && (
          <div
            className={`mt-4 text-xs font-mono p-3 rounded-xl border flex items-center gap-2.5 ${
              statusMsg.error
                ? "bg-red-500/10 border-red-500/20 text-red-400"
                : "bg-amber-500/10 border-amber-500/20 text-amber-300"
            }`}
          >
            {statusMsg.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Sparkles className="w-4 h-4 shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        )}
      </div>

      {/* Generated LinkedIn Post Card */}
      {postOutput && (
        <div className="glass-card rounded-2xl p-6 shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4 border-b border-[#233148] pb-4">
            <h3 className="font-['Space_Grotesk'] text-base font-bold text-slate-100 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-amber-400" />
              Generated LinkedIn Outreach Post
            </h3>
            <button
              onClick={() => copyToClipboard(postOutput, "post")}
              className="flex items-center gap-1.5 bg-[#121824] hover:bg-[#1c2638] border border-[#233148] text-xs text-slate-200 px-3.5 py-2 rounded-xl transition cursor-pointer font-mono shadow-sm"
            >
              {copiedPost ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedPost ? "Copied!" : "Copy Outreach Post"}</span>
            </button>
          </div>

          <div className="bg-[#121824] border border-[#233148] rounded-xl p-5 font-sans text-xs sm:text-sm leading-relaxed text-slate-200 whitespace-pre-wrap select-all">
            {postOutput}
          </div>
        </div>
      )}

      {/* Generated Boolean Strings Card */}
      {booleanOutput && (
        <div className="glass-card rounded-2xl p-6 shadow-xl transition-all">
          <div className="flex items-center justify-between mb-4 border-b border-[#233148] pb-4">
            <h3 className="font-['Space_Grotesk'] text-base font-bold text-slate-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-teal-400" />
              Boolean Search Strings (Dice, LinkedIn, Google X-Ray)
            </h3>
            <button
              onClick={() => copyToClipboard(booleanOutput, "bool")}
              className="flex items-center gap-1.5 bg-[#121824] hover:bg-[#1c2638] border border-[#233148] text-xs text-slate-200 px-3.5 py-2 rounded-xl transition cursor-pointer font-mono shadow-sm"
            >
              {copiedBool ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedBool ? "Copied!" : "Copy All Strings"}</span>
            </button>
          </div>

          <div className="bg-[#121824] border border-[#233148] rounded-xl p-5 font-mono text-xs leading-relaxed text-slate-200 whitespace-pre-wrap select-all">
            {booleanOutput}
          </div>
        </div>
      )}
    </div>
  );
};

