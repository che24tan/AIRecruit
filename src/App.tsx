import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { TabRequirement } from "./components/TabRequirement";
import { TabJobDescriptions } from "./components/TabJobDescriptions";
import { TabCandidateBank } from "./components/TabCandidateBank";
import { TabMatches } from "./components/TabMatches";
import { LinkedInSourcingModal } from "./components/LinkedInSourcingModal";
import { Candidate, JobDescription, MatchResult } from "./types";

const LOCAL_STORAGE_CANDIDATES = "signal_candidates_v1";
const LOCAL_STORAGE_JOBS = "signal_jobs_v1";

const SAMPLE_JOB: JobDescription = {
  id: "job_sample_101",
  reqId: "REQ-1042",
  title: "Senior Java Developer",
  location: "Remote / Dallas, TX",
  jdText: `We are seeking a Senior Java Developer with 7+ years of experience building scalable backend microservices using Java 17+, Spring Boot, PostgreSQL, Kafka, and AWS.
Key Requirements:
- Deep hands-on experience with Java 17/21, Spring Boot, Spring Data JPA.
- Microservices architecture, Docker, Kubernetes, AWS (ECS, S3, RDS).
- REST API design, Kafka messaging, and PostgreSQL database performance tuning.
- Must be authorized to work in the U.S. without employer sponsorship, now or in the future.
- Full-time contract role.`,
  addedDate: new Date().toISOString().slice(0, 10),
};

const SAMPLE_CANDIDATE: Candidate = {
  id: "cand_sample_201",
  name: "Alexander Wright",
  title: "Senior Java / Backend Engineer",
  email: "alexander.wright@techmail.io",
  phone: "214-555-0182",
  skills: ["Java 17", "Spring Boot", "AWS", "Kafka", "PostgreSQL", "Docker"],
  years_experience: "8 years",
  location: "Dallas, TX",
  visa_status_stated: "US Citizen",
  employment_type_stated: "C2C/W2",
  summary: "Experienced backend developer specializing in high-throughput Spring Boot microservices, Kafka event streaming, and AWS cloud deployments.",
  resume_text: `ALEXANDER WRIGHT
Senior Java / Backend Engineer | Dallas, TX | alexander.wright@techmail.io | 214-555-0182

SUMMARY:
8+ years of core software engineering experience designing distributed backend systems, microservices, and event-driven architectures with Java 17, Spring Boot, Apache Kafka, PostgreSQL, and AWS.

SKILLS:
- Languages & Frameworks: Java 17/21, Spring Boot, Spring Cloud, Hibernate, REST APIs.
- Cloud & Infrastructure: AWS (ECS, RDS, S3, IAM), Docker, Kubernetes, CI/CD pipelines.
- Data & Messaging: PostgreSQL, Redis, Apache Kafka.

WORK EXPERIENCE:
Senior Software Engineer | CloudScale Systems | Dallas, TX (2021 – Present)
- Architected and deployed microservices processing 5M+ daily transactions using Spring Boot 3 and AWS ECS.
- Migrated legacy monolith to event-driven Kafka architecture, reducing latency by 35%.

Software Engineer | FinTech Solutions | Austin, TX (2017 – 2021)
- Built secure RESTful APIs and PostgreSQL data layers for real-time payment processing.`,
  source: "Sample Resume",
  status: "New",
  notes: "Strong technical background in Java 17 and Kafka.",
  added: new Date().toISOString().slice(0, 10),
};

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("requirement");

  // State
  const [reqId, setReqId] = useState("REQ-1042");
  const [title, setTitle] = useState("Senior Java Developer");
  const [location, setLocation] = useState("Remote / Dallas, TX");
  const [jdText, setJdText] = useState(SAMPLE_JOB.jdText);

  const [jobs, setJobs] = useState<JobDescription[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_JOBS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [SAMPLE_JOB];
  });

  const [candidates, setCandidates] = useState<Candidate[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CANDIDATES);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [SAMPLE_CANDIDATE];
  });

  const [matches, setMatches] = useState<MatchResult[]>([]);

  // Sourcing Modal State
  const [isSourcingModalOpen, setIsSourcingModalOpen] = useState(false);
  const [sourcingJobContext, setSourcingJobContext] = useState<{
    jdText: string;
    jobId?: string;
    jobTitle?: string;
    jobLocation?: string;
  } | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_JOBS, JSON.stringify(jobs));
    } catch (e) {
      console.error(e);
    }
  }, [jobs]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CANDIDATES, JSON.stringify(candidates));
    } catch (e) {
      console.error(e);
    }
  }, [candidates]);

  // Actions
  const handleSaveJob = (newJob: JobDescription) => {
    setJobs((prev) => [newJob, ...prev]);
  };

  const handleLoadJob = (job: JobDescription) => {
    setReqId(job.reqId);
    setTitle(job.title);
    setLocation(job.location);
    setJdText(job.jdText);
    setActiveTab("requirement");
  };

  const handleDeleteJob = (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const handleAddCandidate = (cand: Candidate) => {
    setCandidates((prev) => [cand, ...prev]);
  };

  const handleUpdateCandidate = (id: string, updates: Partial<Candidate>) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleRemoveCandidate = (id: string) => {
    setCandidates((prev) => prev.filter((c) => c.id !== id));
    setMatches((prev) => prev.filter((m) => m.candidateId !== id));
  };

  const handleClearAllCandidates = () => {
    setCandidates([]);
    setMatches([]);
  };

  const handleOpenSourcingForCurrent = () => {
    setSourcingJobContext({
      jdText,
      jobId: reqId,
      jobTitle: title,
      jobLocation: location,
    });
    setIsSourcingModalOpen(true);
  };

  const handleOpenSourcingForSavedJob = (job: JobDescription) => {
    setSourcingJobContext({
      jdText: job.jdText,
      jobId: job.reqId,
      jobTitle: job.title,
      jobLocation: job.location,
    });
    setIsSourcingModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#12161C] text-slate-100 font-sans selection:bg-amber-400 selection:text-[#12161C]">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <Header
          jobsCount={jobs.length}
          candidatesCount={candidates.length}
          matchesCount={matches.length}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <main>
          {activeTab === "requirement" && (
            <TabRequirement
              reqId={reqId}
              setReqId={setReqId}
              title={title}
              setTitle={setTitle}
              location={location}
              setLocation={setLocation}
              jdText={jdText}
              setJdText={setJdText}
              onSaveJob={handleSaveJob}
              onOpenSourcingModal={handleOpenSourcingForCurrent}
            />
          )}

          {activeTab === "jobs" && (
            <TabJobDescriptions
              jobs={jobs}
              onLoadJob={handleLoadJob}
              onDeleteJob={handleDeleteJob}
              onOpenSourcingForJob={handleOpenSourcingForSavedJob}
            />
          )}

          {activeTab === "bank" && (
            <TabCandidateBank
              candidates={candidates}
              onAddCandidate={handleAddCandidate}
              onUpdateCandidate={handleUpdateCandidate}
              onRemoveCandidate={handleRemoveCandidate}
              onClearAll={handleClearAllCandidates}
            />
          )}

          {activeTab === "matches" && (
            <TabMatches
              candidates={candidates}
              jobs={jobs}
              currentJdText={jdText}
              currentReqId={reqId}
              currentJobTitle={title}
              matches={matches}
              setMatches={setMatches}
            />
          )}
        </main>

        {/* LinkedIn Sourcing Modal */}
        {sourcingJobContext && (
          <LinkedInSourcingModal
            isOpen={isSourcingModalOpen}
            onClose={() => setIsSourcingModalOpen(false)}
            jdText={sourcingJobContext.jdText}
            jobId={sourcingJobContext.jobId}
            jobTitle={sourcingJobContext.jobTitle}
            jobLocation={sourcingJobContext.jobLocation}
            onAddCandidate={handleAddCandidate}
          />
        )}
      </div>
    </div>
  );
}
