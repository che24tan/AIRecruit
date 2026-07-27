import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = 3000;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function cleanAndParseJson(text: string) {
  if (!text) return {};
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        console.error("Failed to parse extracted JSON block:", e);
      }
    }
    throw err;
  }
}

async function generateGeminiContent(ai: GoogleGenAI, contents: string, config?: any) {
  const modelsToTry = ["gemini-2.5-flash", "gemini-3.6-flash", "gemini-1.5-flash"];
  let lastErr: any = null;
  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        ...(config ? { config } : {}),
      });
      if (response && response.text) {
        return response;
      }
    } catch (err) {
      console.warn(`Model ${model} call failed, trying fallback model...`, err);
      lastErr = err;
    }
  }
  throw lastErr || new Error("All Gemini AI models failed to respond.");
}

// 1. Generate LinkedIn Outreach Post
app.post("/api/gen-post", async (req, res) => {
  try {
    const { jd, jobId, jobTitle, jobLocation } = req.body;
    if (!jd || typeof jd !== "string") {
      return res.status(400).json({ error: "Job description is required." });
    }

    const ai = getGeminiClient();
    const prompt = `You are an IT staffing recruiter writing a polished, professional, LinkedIn-native post to attract candidates for this job.

Role Context:
${jobId ? `Job ID: ${jobId}` : ""}
${jobTitle ? `Title: ${jobTitle}` : ""}
${jobLocation ? `Location: ${jobLocation}` : ""}

Requirements:
- Strip out any client/end-client name, vendor name, or internal job ID/req number from the JD — do not mention them anywhere in the post.
- State clearly this is a full-time / contract requirement.
- Instead of restricting to "Green Card/Citizen only" (which is illegal under U.S. anti-discrimination law, INA §274B, to advertise), use this legally compliant sponsorship line instead: "Must be authorized to work in the U.S. without employer sponsorship, now or in the future."
- Do not include any "locals only" or geographic-preference exclusion language.
- Include this contact info at the end for interested candidates to reach out: Phone: 870-210-2115, Email: chetan@abcocomputers.com
- End with 8-10 relevant, currently trending hashtags for IT/tech recruiting (e.g. mix of role-specific, #hiring, #TechJobs style tags) — pick ones fitting the specific tech stack in the JD, not generic filler.
- Keep it scannable: short paragraphs/line breaks, bullet points for key requirements, not a wall of text.
Output ONLY the post text, nothing else.

JOB DESCRIPTION:
${jd}`;

    const response = await generateGeminiContent(ai, prompt);

    res.json({ post: response.text || "" });
  } catch (err: any) {
    console.error("Error in /api/gen-post:", err);
    res.status(500).json({ error: err.message || "Failed to generate LinkedIn post." });
  }
});

// 2. Generate Boolean Search Strings
app.post("/api/gen-boolean", async (req, res) => {
  try {
    const { jd, jobTitle, jobLocation } = req.body;
    if (!jd || typeof jd !== "string") {
      return res.status(400).json({ error: "Job description is required." });
    }

    const ai = getGeminiClient();
    const prompt = `You are an IT staffing recruiter. Based on this job description, produce ready-to-paste Boolean search strings for sourcing candidates.
Give one string each optimized for:
(1) Dice resume database
(2) CareerBuilder resume database
(3) LinkedIn people search
(4) General Google X-ray search (site:linkedin.com/in)

Use core skills, title variations, seniority, and any visa/status keywords relevant. Label each clearly with markdown subheadings.
Output ONLY the labeled strings, no extra commentary.

Context:
${jobTitle ? `Title: ${jobTitle}` : ""}
${jobLocation ? `Location: ${jobLocation}` : ""}

JOB DESCRIPTION:
${jd}`;

    const response = await generateGeminiContent(ai, prompt);

    res.json({ booleanStrings: response.text || "" });
  } catch (err: any) {
    console.error("Error in /api/gen-boolean:", err);
    res.status(500).json({ error: err.message || "Failed to generate Boolean strings." });
  }
});

// 3. Parse Resume Text into Structured Candidate Record
app.post("/api/parse-resume", async (req, res) => {
  try {
    const { resumeText, filename } = req.body;
    if (!resumeText || typeof resumeText !== "string") {
      return res.status(400).json({ error: "Resume text is required." });
    }

    const ai = getGeminiClient();
    const prompt = `Extract structured recruiting data from this resume text.
Rules:
- title: candidate's current or most recent job title (e.g. "Senior Java Developer", "Data Engineer")
- visa_status_stated: only what the resume itself claims (e.g. "H1B", "Green Card", "US Citizen", "OPT", or "" if not mentioned) — do not verify or guess
- employment_type_stated: work arrangement stated, e.g. "C2C", "W2", "FTE", or combinations like "W2/C2C" — use "" if not mentioned
- summary: one concise sentence summarizing their core experience
- If a field is missing or not found, use an empty string or empty array.

Filename reference: ${filename || "pasted"}

RESUME TEXT:
${resumeText.slice(0, 8000)}`;

    const response = await generateGeminiContent(ai, prompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          title: { type: Type.STRING },
          email: { type: Type.STRING },
          phone: { type: Type.STRING },
          skills: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          years_experience: { type: Type.STRING },
          location: { type: Type.STRING },
          visa_status_stated: { type: Type.STRING },
          employment_type_stated: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ["name", "title", "email", "phone", "skills", "summary"],
      },
    });

    const parsed = cleanAndParseJson(response.text || "{}");
    res.json(parsed);
  } catch (err: any) {
    console.error("Error in /api/parse-resume:", err);
    res.status(500).json({ error: err.message || "Failed to parse resume." });
  }
});

// 4. Score Candidate Match against Job Description
app.post("/api/match-candidate", async (req, res) => {
  try {
    const { jd, candidate } = req.body;
    if (!jd || !candidate) {
      return res.status(400).json({ error: "Job description and candidate are required." });
    }

    const skillsStr = Array.isArray(candidate.skills)
      ? candidate.skills.join(", ")
      : typeof candidate.skills === "string"
      ? candidate.skills
      : "";

    const ai = getGeminiClient();
    const prompt = `You are screening an IT candidate against a job description.
Score candidate fit from 0 to 100.
Provide a concise 1-2 sentence rationale.
List flags if any (e.g., "Skill gap: AWS", "Location mismatch", "Unclear visa status", "Underqualified", "Overqualified", "No recent Java experience").

JOB DESCRIPTION:
${jd.slice(0, 4000)}

CANDIDATE PROFILE:
Name: ${candidate.name || "Unknown"}
Title: ${candidate.title || ""}
Location: ${candidate.location || ""}
Stated Visa: ${candidate.visa_status_stated || "Not stated"}
Stated Work Arrangement: ${candidate.employment_type_stated || "Not stated"}
Skills: ${skillsStr}
Summary: ${candidate.summary || ""}

RESUME TEXT:
${(candidate.resume_text || candidate.resumeText || "").slice(0, 4000)}`;

    const response = await generateGeminiContent(ai, prompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER, description: "Match score from 0 to 100" },
          rationale: { type: Type.STRING, description: "1-2 sentence match rationale" },
          flags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Key flags or risk factors",
          },
          keyMatches: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Key matching skills or strengths",
          },
        },
        required: ["score", "rationale", "flags"],
      },
    });

    const parsed = cleanAndParseJson(response.text || "{}");
    res.json(parsed);
  } catch (err: any) {
    console.error("Error in /api/match-candidate:", err);
    res.status(500).json({ error: err.message || "Failed to score candidate match." });
  }
});

// 5. Quick-Score LinkedIn Profile
app.post("/api/score-linkedin", async (req, res) => {
  try {
    const { jd, profileText } = req.body;
    if (!jd || !profileText) {
      return res.status(400).json({ error: "Job description and profile text are required." });
    }

    const ai = getGeminiClient();
    const prompt = `Score how well this LinkedIn profile text matches the job description (0-100).
Provide a clear 1-2 sentence rationale, key matched skills, and any missing gaps.

JOB DESCRIPTION:
${jd.slice(0, 4000)}

LINKEDIN PROFILE TEXT:
${profileText.slice(0, 4000)}`;

    const response = await generateGeminiContent(ai, prompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.NUMBER },
          rationale: { type: Type.STRING },
          highlights: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          gaps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["score", "rationale", "highlights", "gaps"],
      },
    });

    res.json(cleanAndParseJson(response.text || "{}"));
  } catch (err: any) {
    console.error("Error in /api/score-linkedin:", err);
    res.status(500).json({ error: err.message || "Failed to score LinkedIn profile." });
  }
});

// 6. Direct LinkedIn Sourcing Assistant
app.post("/api/source-linkedin", async (req, res) => {
  try {
    const { jd, jobTitle, jobLocation, jobId } = req.body;
    if (!jd || typeof jd !== "string") {
      return res.status(400).json({ error: "Job description is required." });
    }

    const ai = getGeminiClient();
    const prompt = `You are an expert tech recruiter sourcing candidates directly on LinkedIn for this requirement.

JOB CONTEXT:
${jobId ? `Req ID: ${jobId}` : ""}
${jobTitle ? `Title: ${jobTitle}` : ""}
${jobLocation ? `Location: ${jobLocation}` : ""}

JOB DESCRIPTION:
${jd.slice(0, 4000)}

Analyze the requirement and return JSON:
1. "searchKeywords": A single, high-precision keyword string formatted for LinkedIn search (e.g. '"Senior Java Developer" AND "Spring Boot" AND ("Kafka" OR "AWS")'). Keep it under 120 characters, clean, without redundant words.
2. "titleVariations": Array of 4-5 realistic job titles for candidates who fit this role on LinkedIn.
3. "mustHaveSkills": Array of 5 core technical skill tags to look for on LinkedIn profiles.
4. "inMailTemplate": A short, highly engaging, personalized LinkedIn InMail/Direct Message template (under 120 words) to send to sourced candidates. Do NOT include prohibited GC/USC restrictions. Use: "Must be authorized to work in the U.S. without employer sponsorship."
5. "sourcingAdvice": A 1-2 sentence tip for sourcing this specific stack on LinkedIn.`;

    const response = await generateGeminiContent(ai, prompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          searchKeywords: { type: Type.STRING },
          titleVariations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          mustHaveSkills: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          inMailTemplate: { type: Type.STRING },
          sourcingAdvice: { type: Type.STRING },
        },
        required: [
          "searchKeywords",
          "titleVariations",
          "mustHaveSkills",
          "inMailTemplate",
          "sourcingAdvice",
        ],
      },
    });

    const parsed = cleanAndParseJson(response.text || "{}");

    // Construct direct URLs
    const cleanKeywords = parsed.searchKeywords || jobTitle || "Java Developer";
    const linkedinDirectUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
      cleanKeywords
    )}`;
    const googleXrayUrl = `https://www.google.com/search?q=${encodeURIComponent(
      `site:linkedin.com/in/ ${cleanKeywords}`
    )}`;

    res.json({
      ...parsed,
      linkedinDirectUrl,
      googleXrayUrl,
    });
  } catch (err: any) {
    console.error("Error in /api/source-linkedin:", err);
    res.status(500).json({ error: err.message || "Failed to generate LinkedIn sourcing details." });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
