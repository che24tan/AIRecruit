export type CandidateStatus = "New" | "Submitted" | "Interviewed" | "Placed" | "Rejected" | "Burned";

export interface Candidate {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  skills: string[];
  years_experience: string;
  location: string;
  visa_status_stated: string;
  employment_type_stated: string;
  summary: string;
  resume_text: string;
  source: string;
  status: CandidateStatus;
  notes: string;
  added: string;
}

export interface JobDescription {
  id: string;
  reqId: string;
  title: string;
  location: string;
  jdText: string;
  addedDate: string;
}

export interface MatchResult {
  id: string;
  candidateId: string;
  candidateName: string;
  score: number;
  rationale: string;
  flags: string[];
  keyMatches?: string[];
}

export interface LinkedInScoreResult {
  score: number;
  rationale: string;
  highlights: string[];
  gaps: string[];
}
