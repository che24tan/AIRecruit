import React, { useState } from "react";
import {
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  Mail,
  Loader2,
  Search,
  UserCheck,
  TrendingUp,
  AlertCircle,
  FileText,
  Target,
} from "lucide-react";
import { Candidate, JobDescription, MatchResult, LinkedInScoreResult } from "../types";

interface TabMatchesProps {
  candidates: Candidate[];
  jobs: JobDescription[];
  currentJdText: string;
  currentReqId: string;
  currentJobTitle: string;
  matches: MatchResult[];
  setMatches: React.Dispatch<React.SetStateAction<MatchResult[]>>;
}

export const TabMatches: React.FC<TabMatchesProps> = ({
  candidates,
  jobs,
  currentJdText,
  currentReqId,
  currentJobTitle,
  matches,
  setMatches,
}) => {
  const [selectedJobId, setSelectedJobId] = useState<string>("__current__");
  const [isMatching, setIsMatching] = useState(false);
  const [matchStatus, setMatchStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [scoreFilter, setScoreFilter] = useState<number>(0);

  // LinkedIn Quick Score states
  const [linkedinText, setLinkedinText] = useState("");
  const [linkedinResult, setLinkedinResult] = useState<LinkedInScoreResult | null>(null);
  const [isScoringLinkedin, setIsScoringLinkedin] = useState(false);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);

  // Get effective JD text
  const getActiveJd = () => {
    if (selectedJobId === "__current__") {
      return {
        title: currentJobTitle || "Tab 1 Requirement (Unsaved)",
        jdText: currentJdText,
      };
    }
    const found = jobs.find((j) => j.id === selectedJobId);
    return {
      title: found ? `${found.reqId} · ${found.title}` : "Unknown Job",
      jdText: found ? found.jdText : "",
    };
  };

  // Score all candidates against active JD
  const handleMatchAll = async () => {
    const activeJd = getActiveJd();
    if (!activeJd.jdText.trim()) {
      setMatchStatus({
        text: "The selected Job Description is empty. Provide a JD first.",
        error: true,
      });
      return;
    }

    if (candidates.length === 0) {
      setMatchStatus({
        text: "Candidate bank is empty. Upload resumes on Tab 3 first.",
        error: true,
      });
      return;
    }

    setIsMatching(true);
    setMatchStatus({ text: `Initializing AI evaluation for ${candidates.length} candidate(s)...` });

    const newMatches: MatchResult[] = [];
    const queue = [...candidates];
    let completed = 0;
    const total = candidates.length;

    const matchSingleCandidate = async (c: Candidate, attemptsLeft = 2): Promise<MatchResult> => {
      try {
        const res = await fetch("/api/match-candidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jd: activeJd.jdText,
            candidate: {
              ...c,
              resume_text: (c.resume_text || "").slice(0, 6000), // Trim text to keep payload light
            },
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Matching failed.");

        return {
          id: "m_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
          candidateId: c.id,
          candidateName: c.name,
          score: Math.round(data.score || 0),
          rationale: data.rationale || "Evaluated fit.",
          flags: data.flags || [],
          keyMatches: data.keyMatches || [],
        };
      } catch (err: any) {
        if (attemptsLeft > 0) {
          console.warn(`Retrying match for ${c.name} (${attemptsLeft} attempt(s) left)...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return matchSingleCandidate(c, attemptsLeft - 1);
        }
        console.error(`Error matching ${c.name}:`, err);
        return {
          id: "m_err_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
          candidateId: c.id,
          candidateName: c.name,
          score: 0,
          rationale: "AI evaluation timed out or returned invalid response.",
          flags: ["Evaluation Error"],
        };
      }
    };

    // Run 3 concurrent evaluation workers
    const concurrency = Math.min(3, queue.length);
    const workers = Array.from({ length: concurrency }, async () => {
      while (queue.length > 0) {
        const candidate = queue.shift();
        if (!candidate) break;

        const result = await matchSingleCandidate(candidate);
        newMatches.push(result);
        completed++;

        setMatchStatus({
          text: `Scored ${completed}/${total} candidate(s)... (${result.candidateName}: ${result.score} pts)`,
        });
      }
    });

    await Promise.all(workers);

    newMatches.sort((a, b) => b.score - a.score);
    setMatches(newMatches);
    setIsMatching(false);

    const errorCount = newMatches.filter((m) => m.flags?.includes("Evaluation Error")).length;
    if (errorCount > 0) {
      setMatchStatus({
        text: `Completed with ${newMatches.length - errorCount} scored, ${errorCount} candidates hit temporary API timeouts.`,
        error: true,
      });
    } else {
      setMatchStatus({ text: `Scored all ${candidates.length} candidate(s) successfully!` });
    }
  };

  // Quick Score LinkedIn Profile
  const handleScoreLinkedin = async () => {
    const activeJd = getActiveJd();
    if (!activeJd.jdText.trim()) {
      setLinkedinError("Please provide a Job Description on Tab 1 or select a saved job first.");
      return;
    }
    if (!linkedinText.trim()) {
      setLinkedinError("Please paste LinkedIn profile text.");
      return;
    }

    setIsScoringLinkedin(true);
    setLinkedinError(null);
    setLinkedinResult(null);

    try {
      const res = await fetch("/api/score-linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd: activeJd.jdText,
          profileText: linkedinText,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scoring failed.");

      setLinkedinResult(data);
    } catch (err: any) {
      setLinkedinError(err.message || "Failed to score profile.");
    } finally {
      setIsScoringLinkedin(false);
    }
  };

  const filteredMatches = matches.filter((m) => m.score >= scoreFilter);

  const getScoreBadgeColor = (score: number) => {
    if (score >= 75) return { fill: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    if (score >= 50) return { fill: "bg-amber-500", text: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" };
    return { fill: "bg-red-500", text: "text-red-400", bg: "bg-red-500/10 border-red-500/20" };
  };

  return (
    <div className="space-y-6">
      {/* Selection & Action Panel */}
      <div className="glass-card rounded-2xl p-6 shadow-xl">
        <h2 className="font-['Space_Grotesk'] text-lg font-bold text-slate-100 flex items-center gap-2.5 mb-1">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <span>Match Evaluation Engine</span>
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm mb-5 leading-relaxed">
          Evaluate candidates against job descriptions using Gemini AI. Produces 0–100 fit scores, detailed technical reasoning, and visa or skill risk flags.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-5">
          <div className="flex-1">
            <label className="block text-slate-400 text-xs mb-1.5 font-mono font-medium uppercase">
              Target Job Requirement
            </label>
            <select
              value={selectedJobId}
              onChange={(e) => setSelectedJobId(e.target.value)}
              className="w-full bg-[#121824] border border-[#233148] text-xs text-slate-100 p-3 rounded-xl focus:outline-none focus:border-amber-400 font-sans cursor-pointer"
            >
              <option value="__current__">
                Current Tab 1 JD {currentJobTitle ? `(${currentReqId || "REQ"} - ${currentJobTitle})` : "(Unsaved Draft)"}
              </option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.reqId} · {j.title} ({j.location})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 text-xs mb-1.5 font-mono font-medium uppercase">
              Filter Fit Score
            </label>
            <select
              value={scoreFilter}
              onChange={(e) => setScoreFilter(Number(e.target.value))}
              className="w-full sm:w-40 bg-[#121824] border border-[#233148] text-xs text-slate-100 p-3 rounded-xl focus:outline-none focus:border-amber-400 font-mono cursor-pointer"
            >
              <option value={0}>All Scores (0+)</option>
              <option value={50}>50+ Score</option>
              <option value={70}>70+ Score</option>
              <option value={85}>85+ Top Matches</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleMatchAll}
            disabled={isMatching || candidates.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-[#0d1117] font-['Space_Grotesk'] font-bold text-xs sm:text-sm px-5 py-3 rounded-xl transition cursor-pointer disabled:opacity-40 shadow-lg glow-amber transform hover:-translate-y-0.5"
          >
            {isMatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Score All Candidates ({candidates.length})</span>
          </button>

          {matchStatus && (
            <span
              className={`text-xs font-mono p-3 rounded-xl border flex items-center gap-2 ${
                matchStatus.error
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-300"
              }`}
            >
              {matchStatus.error ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              {matchStatus.text}
            </span>
          )}
        </div>
      </div>

      {/* Results Table Panel */}
      <div className="glass-card rounded-2xl p-6 shadow-xl">
        <h3 className="font-['Space_Grotesk'] text-base font-bold text-slate-100 mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Match Evaluation Results ({filteredMatches.length})
          </span>
        </h3>

        {filteredMatches.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-[#233148] rounded-xl bg-[#121824]/40">
            <UserCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-['Space_Grotesk'] text-sm font-semibold">
              {matches.length === 0
                ? "No candidate scores calculated yet"
                : "No candidates meet the selected score threshold"}
            </p>
            <p className="text-slate-500 text-xs font-mono mt-1">
              Click 'Score All Candidates' above to execute Gemini evaluation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#233148]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#121824] border-b border-[#233148] text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3.5">Candidate</th>
                  <th className="py-3 px-3.5">Fit Index</th>
                  <th className="py-3 px-3.5">Evaluation Rationale & Flags</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#233148]/80 text-slate-200 bg-[#0d1117]/60">
                {filteredMatches.map((m) => {
                  const candidateObj = candidates.find((c) => c.id === m.candidateId);
                  const colors = getScoreBadgeColor(m.score);

                  return (
                    <tr key={m.id} className="hover:bg-[#161F30] transition-colors group">
                      <td className="py-3.5 px-3.5">
                        <div className="font-bold text-slate-100 text-xs sm:text-sm">{m.candidateName}</div>
                        <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                          {candidateObj?.title || "No Title"}
                          {candidateObj?.location ? ` · ${candidateObj.location}` : ""}
                        </div>
                      </td>

                      <td className="py-3.5 px-3.5 min-w-[150px]">
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 h-2.5 bg-[#121824] rounded-full overflow-hidden border border-[#233148]">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${colors.fill}`}
                              style={{ width: `${m.score}%` }}
                            />
                          </div>
                          <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded-md border ${colors.bg} ${colors.text} min-w-[36px] text-center`}>
                            {m.score}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3.5 max-w-md">
                        <p className="text-slate-300 leading-relaxed text-xs">{m.rationale}</p>
                        {m.flags && m.flags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {m.flags.map((flag, idx) => (
                              <span
                                key={idx}
                                className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-mono px-2 py-0.5 rounded-md"
                              >
                                {flag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-3.5 text-right font-mono">
                        {candidateObj?.email ? (
                          <a
                            href={`mailto:${candidateObj.email}`}
                            className="inline-flex items-center gap-1.5 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs px-3 py-1.5 rounded-xl transition"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>Contact</span>
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick-Score LinkedIn Profile Card */}
      <div className="glass-card rounded-2xl p-6 shadow-xl">
        <h3 className="font-['Space_Grotesk'] text-base font-bold text-slate-100 mb-1 flex items-center gap-2">
          <Search className="w-4 h-4 text-teal-400" />
          Quick-Score a LinkedIn Profile Text
        </h3>
        <p className="text-slate-400 text-xs sm:text-sm mb-4 leading-relaxed">
          Copy a candidate's LinkedIn About section or job history text here to instantly evaluate match fit before reaching out.
        </p>

        <textarea
          rows={4}
          value={linkedinText}
          onChange={(e) => setLinkedinText(e.target.value)}
          placeholder="Paste LinkedIn profile text (About section, headline, recent positions)..."
          className="w-full bg-[#121824] border border-[#233148] rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-500 font-sans focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition resize-y mb-4 leading-relaxed"
        />

        <div className="flex items-center justify-between">
          <button
            onClick={handleScoreLinkedin}
            disabled={isScoringLinkedin}
            className="flex items-center gap-2 bg-[#161F30] hover:bg-[#202B3E] text-slate-100 font-['Space_Grotesk'] font-semibold text-xs px-4 py-2.5 rounded-xl border border-[#233148] transition disabled:opacity-40 cursor-pointer shadow-sm"
          >
            {isScoringLinkedin ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Sparkles className="w-4 h-4 text-amber-400" />}
            <span>Score Profile Text</span>
          </button>

          {linkedinError && (
            <span className="text-xs text-red-400 font-mono flex items-center gap-1.5 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              {linkedinError}
            </span>
          )}
        </div>

        {linkedinResult && (
          <div className="mt-5 bg-[#121824] border border-[#233148] rounded-xl p-5 font-sans text-xs text-slate-200 space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-[#233148] pb-3">
              <span className="font-mono text-xs font-semibold text-slate-400">Match Fit Score</span>
              <span className={`font-mono font-bold text-sm px-2.5 py-1 rounded-lg border ${getScoreBadgeColor(linkedinResult.score).bg} ${getScoreBadgeColor(linkedinResult.score).text}`}>
                {linkedinResult.score} / 100
              </span>
            </div>

            <p className="leading-relaxed text-slate-200">{linkedinResult.rationale}</p>

            {linkedinResult.highlights && linkedinResult.highlights.length > 0 && (
              <div>
                <span className="font-mono text-[10px] text-emerald-400 block uppercase font-bold tracking-wider mb-1">Key Highlights</span>
                <ul className="list-disc list-inside text-slate-300 font-mono text-[11px] space-y-1">
                  {linkedinResult.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            )}

            {linkedinResult.gaps && linkedinResult.gaps.length > 0 && (
              <div>
                <span className="font-mono text-[10px] text-amber-400 block uppercase font-bold tracking-wider mb-1">Missing Gaps</span>
                <ul className="list-disc list-inside text-slate-300 font-mono text-[11px] space-y-1">
                  {linkedinResult.gaps.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

