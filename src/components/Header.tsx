import React from "react";
import { Sparkles, Users, FileText, CheckCircle2, HardDrive, Radio } from "lucide-react";

interface HeaderProps {
  jobsCount: number;
  candidatesCount: number;
  matchesCount: number;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  jobsCount,
  candidatesCount,
  matchesCount,
  activeTab,
  setActiveTab,
}) => {
  const tabs = [
    { id: "requirement", label: "1 · Requirement", icon: FileText, count: null },
    { id: "jobs", label: "2 · Saved JDs", icon: FileText, count: jobsCount },
    { id: "bank", label: "3 · Candidate Bank", icon: Users, count: candidatesCount },
    { id: "matches", label: "4 · Match Evaluation", icon: CheckCircle2, count: matchesCount },
  ];

  return (
    <header className="mb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#233148]">
        <div className="flex items-center gap-3.5">
          <div className="relative p-2.5 bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-xl glow-amber text-amber-400 shrink-0">
            <Radio className="w-6 h-6 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100">
                SIGNAL <span className="text-amber-400 font-medium text-lg sm:text-2xl">/ sourcing pipeline</span>
              </h1>
              <span className="font-mono text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                PRO SOURCER
              </span>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
              AI-Powered Technical Recruiting & Direct LinkedIn Candidate Sourcing Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-mono text-emerald-400 shadow-sm">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>Auto-Saved Local Storage</span>
          </div>

          <div className="flex items-center gap-2 bg-[#161F30] border border-[#233148] px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="text-slate-200">Gemini 3.6 Flash</span>
          </div>
        </div>
      </div>

      {/* Navigation Bar */}
      <nav className="flex gap-2 overflow-x-auto pt-4 pb-1 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 font-['Space_Grotesk'] text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-gradient-to-r from-amber-500/20 to-amber-600/10 text-amber-300 border border-amber-500/40 shadow-lg glow-amber"
                  : "text-slate-400 bg-[#161F30]/40 border border-transparent hover:bg-[#161F30] hover:text-slate-200 hover:border-[#233148]"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-amber-400" : "text-slate-400"}`} />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`ml-1 font-mono text-[10px] px-2 py-0.5 rounded-full ${
                    isActive
                      ? "bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30"
                      : "bg-[#233148] text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};

