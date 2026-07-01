export type JobStatus = "Accepted" | "Rejected" | "Failed";

export type TechStack = "Full Stack" | "AI" | "QA" | "DevOps" | "Extra";

export const TECH_STACKS: TechStack[] = [
  "Full Stack",
  "AI",
  "QA",
  "DevOps",
  "Extra",
];

export const SHEET_TABS = {
  ALL_JOBS: "All Jobs",
  FULL_STACK: "Full Stack",
  AI: "AI",
  QA: "QA",
  DEVOPS: "DevOps",
  EXTRA: "Extra",
  FAILED: "Failed",
} as const;

export type SheetTab = (typeof SHEET_TABS)[keyof typeof SHEET_TABS];

export const ALL_SHEET_TABS: SheetTab[] = Object.values(SHEET_TABS);

export const ACCEPTED_HEADERS = [
  "Date",
  "Company",
  "Role",
  "Tech Stack",
  "URL",
  "Responsibilities",
  "Qualifications (Required)",
  "Qualifications (Preferred)",
  "Token Usage",
  "Submitted By",
] as const;

export const FAILED_HEADERS = [
  "Date",
  "URL",
  "Error",
  "Submitted By",
] as const;

export interface AnalysisResult {
  is_job_page: boolean;
  status: "ACCEPTED" | "REJECTED";
  company_name: string;
  role_title: string;
  tech_stack: TechStack;
  responsibilities: string;
  qualifications_required: string;
  qualifications_preferred: string;
  rejection_reasons: string[];
}

export interface ProcessedJob {
  url: string;
  status: JobStatus;
  company_name: string;
  role_title: string;
  tech_stack: TechStack;
  responsibilities: string;
  qualifications_required: string;
  qualifications_preferred: string;
  rejection_reason: string;
  token_usage: number;
  submitted_by: string;
  scrape_note?: string;
}

export interface SheetIndex {
  urls: Set<string>;
  companies: Set<string>;
}
