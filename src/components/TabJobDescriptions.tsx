import React, { useState } from "react";
import { FileText, ArrowUpRight, Trash2, Search, Calendar, MapPin, Globe } from "lucide-react";
import { JobDescription } from "../types";

interface TabJobDescriptionsProps {
  jobs: JobDescription[];
  onLoadJob: (job: JobDescription) => void;
  onDeleteJob: (id: string) => void;
  onOpenSourcingForJob: (job: JobDescription) => void;
}

export const TabJobDescriptions: React.FC<TabJobDescriptionsProps> = ({
  jobs,
  onLoadJob,
  onDeleteJob,
  onOpenSourcingForJob,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredJobs = jobs.filter((j) => {
    const q = searchTerm.toLowerCase();
    return (
      j.title.toLowerCase().includes(q) ||
      j.reqId.toLowerCase().includes(q) ||
      j.location.toLowerCase().includes(q) ||
      j.jdText.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#233148]">
          <div>
            <h2 className="font-['Space_Grotesk'] text-lg font-bold text-slate-100 flex items-center gap-2.5">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                <FileText className="w-5 h-5" />
              </div>
              <span>Saved Job Descriptions ({jobs.length})</span>
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              Stored locally for instant sourcing, post generation, and candidate fit matching.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search saved jobs by title or skill..."
              className="w-full bg-[#121824] border border-[#233148] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition"
            />
          </div>
        </div>

        {filteredJobs.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-[#233148] rounded-xl bg-[#121824]/40">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-['Space_Grotesk'] text-sm font-semibold">
              {jobs.length === 0 ? "No saved jobs in library yet" : "No matching job descriptions found"}
            </p>
            <p className="text-slate-500 text-xs font-mono mt-1">
              {jobs.length === 0 ? "Save your first job requirement from Tab 1 to build your library." : "Try adjusting your search terms."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredJobs.map((job) => (
              <div
                key={job.id}
                className="bg-[#121824]/80 border border-[#233148] hover:border-amber-500/30 rounded-xl p-5 transition-all duration-200 hover:shadow-xl group"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                        {job.reqId}
                      </span>
                      <h3 className="font-['Space_Grotesk'] font-bold text-base text-slate-100 group-hover:text-amber-300 transition">
                        {job.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 font-mono">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        {job.addedDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
                    <button
                      onClick={() => onOpenSourcingForJob(job)}
                      className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 font-mono text-xs px-3 py-2 rounded-xl transition cursor-pointer shadow-sm"
                    >
                      <Globe className="w-3.5 h-3.5 text-blue-400" />
                      <span>Source on LinkedIn</span>
                    </button>

                    <button
                      onClick={() => onLoadJob(job)}
                      className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-xs px-3 py-2 rounded-xl transition cursor-pointer shadow-sm"
                    >
                      <span>Load into Tab 1</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onDeleteJob(job.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 rounded-xl transition cursor-pointer"
                      title="Delete saved job"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <p className="text-slate-300 text-xs line-clamp-3 leading-relaxed font-sans bg-[#0d1117]/60 p-3 rounded-xl border border-[#233148]/60 text-slate-300">
                  {job.jdText}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

