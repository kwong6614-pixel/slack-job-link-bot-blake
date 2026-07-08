import OpenAI from "openai";
import { getAnalysisPrompt } from "./prompt";
import type { AnalysisResult, TechStack } from "./types";
import { TECH_STACKS } from "./types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ANALYSIS_SCHEMA = {
  type: "object" as const,
  properties: {
    is_job_page: {
      type: "boolean",
      description:
        "True if the scraped content is a job description page. False for login pages, 404s, company homepages, blog posts, etc.",
    },
    status: { type: "string", enum: ["ACCEPTED", "REJECTED"] },
    company_name: { type: "string" },
    role_title: { type: "string" },
    tech_stack: { type: "string", enum: TECH_STACKS },
    responsibilities: { type: "string" },
    qualifications_required: { type: "string" },
    qualifications_preferred: { type: "string" },
    rejection_reasons: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "is_job_page",
    "status",
    "company_name",
    "role_title",
    "tech_stack",
    "responsibilities",
    "qualifications_required",
    "qualifications_preferred",
    "rejection_reasons",
  ],
  additionalProperties: false,
};

export interface AnalyzeResponse {
  result: AnalysisResult;
  token_usage: number;
}

export async function analyzeJobDescription(
  url: string,
  jdText: string
): Promise<AnalyzeResponse> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const systemPrompt = await getAnalysisPrompt();
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";

  let response;
  try {
    response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyze this job posting.

URL: ${url}

Job Description:
${jdText}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "jd_analysis",
          strict: true,
          schema: ANALYSIS_SCHEMA,
        },
      },
    });
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? (error as { status?: number }).status
        : undefined;
    if (status === 401) {
      throw new Error("OpenAI API key is invalid or expired (401)");
    }
    throw error;
  }

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  const parsed = JSON.parse(content) as AnalysisResult;
  const token_usage =
    (response.usage?.prompt_tokens ?? 0) +
    (response.usage?.completion_tokens ?? 0);

  return {
    result: {
      ...parsed,
      tech_stack: parsed.tech_stack as TechStack,
    },
    token_usage,
  };
}
