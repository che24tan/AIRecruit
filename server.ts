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

async function generateGeminiContent(ai: GoogleGenAI, contents: any, config?: any) {
  const modelsToTry = ["gemini-2.5-flash", "gemini-1.5-flash"];
  let lastErr: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          ...(config ? { config } : {}),
        });
        if (response && response.text) {
          return response;
        }
      } catch (err: any) {
        lastErr = err;
        console.warn(`Model ${model} attempt ${attempt + 1} failed: ${err.message || err}`);
        // Delay before retry if rate limited or transient error
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
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

function extractHeuristicsFromText(text: string, filename: string) {
  const clean = text || "";

  // Email
  const emailMatch = clean.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : "";

  // Phone
  const phoneMatch = clean.match(/(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/) || clean.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
  const phone = phoneMatch ? phoneMatch[0] : "";

  // Visa Status
  let visa = "";
  if (/\b(us citizen|u\.s\. citizen|citizen)\b/i.test(clean)) visa = "US Citizen";
  else if (/\b(green card|gc|permanent resident)\b/i.test(clean)) visa = "Green Card";
  else if (/\b(h1b|h-1b)\b/i.test(clean)) visa = "H1B";
  else if (/\b(opt|stem opt)\b/i.test(clean)) visa = "OPT";
  else if (/\b(ead|h4 ead|l2 ead)\b/i.test(clean)) visa = "EAD";
  else if (/\b(tn visa|tn)\b/i.test(clean)) visa = "TN Visa";
  else if (/\b(cpt)\b/i.test(clean)) visa = "CPT";

  // Employment Type
  let empType = "";
  if (/\b(c2c|corp-to-corp|corp to corp)\b/i.test(clean)) empType = "C2C";
  if (/\b(w2|w-2)\b/i.test(clean)) empType = empType ? "W2/C2C" : "W2";
  if (/\b(fte|full time|full-time)\b/i.test(clean)) empType = empType ? `${empType}/FTE` : "FTE";

  // Location (e.g. City, ST or major US tech hubs)
  const locMatch = clean.match(/\b([A-Z][a-zA-B\s]{2,15},\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY))\b/i) || clean.match(/\b(Dallas|San Jose|New York|San Francisco|Austin|Chicago|Houston|Seattle|Boston|Atlanta|Denver|Los Angeles|Charlotte|Tampa|Miami|Phoenix|San Diego|Philadelphia|Raleigh|Columbus|Detroit|Indianapolis|Minneapolis|Salt Lake City)\b/i);
  const location = locMatch ? locMatch[0] : "";

  // Common Tech Skills Dictionary
  const commonSkills = [
    "Java", "Spring Boot", "Spring", "Microservices", "Python", "Django", "React", "Angular", "Vue", "Node.js",
    "JavaScript", "TypeScript", "C#", ".NET", "AWS", "Azure", "GCP", "SQL", "PostgreSQL", "MySQL", "Oracle",
    "MongoDB", "Kubernetes", "Docker", "Kafka", "Spark", "Hadoop", "DevOps", "Terraform", "Jenkins",
    "REST API", "GraphQL", "Snowflake", "Databricks", "Tableau", "Power BI", "Salesforce", "MuleSoft",
    "Golang", "Scala", "C++", "Linux", "CI/CD", "Agile", "Scrum", "Selenium", "Cypress", "JIRA", "J2EE"
  ];
  const detectedSkills = commonSkills.filter((s) => new RegExp(`\\b${s.replace(".", "\\.").replace("+", "\\+")}\\b`, "i").test(clean));

  // Job Title extraction heuristics
  let title = "";
  const titleRegex = /(Senior|Sr\.?|Lead|Principal|Junior|Jr\.?|Staff)?\s*(Java|J2EE|Python|Full\s*Stack|React|Angular|Node|Frontend|Backend|Software|Data|Database|DevOps|Cloud|QA|Test|Automation|\.Net|Dotnet|C#|C\+\+|Go|Golang|Scala|SAP|Salesforce|AWS|Azure|GCP|Network|Security|Infrastructure|Systems|System|Solution|Enterprise|Project|Product|Scrum|Agile|Business|ETL|BI|Big\s*Data|MuleSoft)?\s*(Developer|Engineer|Architect|Lead|Manager|Consultant|Analyst|Admin|Administrator|Specialist|Tester|Master|Designer|Scientist|DBA)/i;
  const titleMatch = clean.match(titleRegex);
  if (titleMatch) {
    title = titleMatch[0];
  }

  // Name heuristic if needed
  const lines = clean.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  let name = "";
  for (const line of lines.slice(0, 5)) {
    if (!line.includes("@") && !line.match(/\d{3}/) && line.length > 2 && line.length < 35) {
      if (/^[A-Za-z\s.'-]+$/.test(line) && !/resume|curriculum|profile|summary|experience|education/i.test(line)) {
        name = line;
        break;
      }
    }
  }

  return { name, title, email, phone, location, visa, empType, skills: detectedSkills };
}

// 3. Parse Resume Text or Document into Structured Candidate Record
app.post("/api/parse-resume", async (req, res) => {
  try {
    const { resumeText, filename, fileBase64, mimeType } = req.body;
    const cleanText = (resumeText || "").toString().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ").trim();
    const fallbackName = (filename || "Candidate")
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (l: string) => l.toUpperCase());

    const heuristics = extractHeuristicsFromText(cleanText, filename || "");

    try {
      const ai = getGeminiClient();
      const promptText = `Extract structured recruiting data from this candidate resume.
Rules:
- name: Candidate's full name (e.g. "Jane Smith")
- title: Candidate's primary/current job title (e.g. "Senior Java Developer", "Cloud Architect")
- email: Candidate's email address (e.g. "jane.smith@gmail.com")
- phone: Candidate's phone number
- skills: array of top 6-12 technical skills (e.g. ["Java", "Spring Boot", "AWS", "Microservices", "Docker"])
- location: City, State or Location (e.g. "Dallas, TX" or "San Jose, CA")
- visa_status_stated: Visa / work authorization claimed on resume (e.g. "H1B", "Green Card", "US Citizen", "OPT", "TN", "EAD") or "" if unstated
- employment_type_stated: Employment type mentioned, e.g. "C2C", "W2", "FTE", or ""
- years_experience: Estimated total years of experience
- summary: One concise sentence summarizing their core background and experience

Filename reference: ${filename || "pasted"}`;

      const contents: any[] = [];

      // Multimodal document support for Gemini
      if (fileBase64 && typeof fileBase64 === "string" && fileBase64.length > 50) {
        let effectiveMime = mimeType || "application/pdf";
        if (filename?.toLowerCase().endsWith(".pdf")) effectiveMime = "application/pdf";
        else if (filename?.toLowerCase().endsWith(".png")) effectiveMime = "image/png";
        else if (filename?.toLowerCase().endsWith(".jpg") || filename?.toLowerCase().endsWith(".jpeg")) effectiveMime = "image/jpeg";

        if (effectiveMime === "application/pdf" || effectiveMime.startsWith("image/")) {
          contents.push({
            inlineData: {
              data: fileBase64,
              mimeType: effectiveMime,
            },
          });
        }
      }

      if (cleanText.length > 0) {
        contents.push(`RESUME TEXT CONTENT:\n${cleanText.slice(0, 10000)}`);
      } else if (contents.length === 0) {
        // If neither text nor document binary could be sent
        return res.json({
          name: heuristics.name || fallbackName,
          title: heuristics.title || "IT Professional",
          email: heuristics.email || "",
          phone: heuristics.phone || "",
          skills: heuristics.skills.length > 0 ? heuristics.skills : ["General IT"],
          years_experience: "",
          location: heuristics.location || "",
          visa_status_stated: heuristics.visa || "",
          employment_type_stated: heuristics.empType || "",
          summary: `Document file uploaded (${filename || "file"}).`,
        });
      }

      contents.push(promptText);

      const response = await generateGeminiContent(ai, contents, {
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

      // Merge AI result with heuristic extractions for guaranteed field completeness
      const finalRecord = {
        name: parsed.name && !parsed.name.toLowerCase().includes("unknown") && parsed.name.trim().length >= 2
          ? parsed.name
          : heuristics.name || fallbackName,
        title: parsed.title || heuristics.title || "IT Professional",
        email: parsed.email || heuristics.email || "",
        phone: parsed.phone || heuristics.phone || "",
        skills: Array.isArray(parsed.skills) && parsed.skills.length > 0
          ? parsed.skills
          : heuristics.skills.length > 0
          ? heuristics.skills
          : ["General IT"],
        years_experience: parsed.years_experience || "",
        location: parsed.location || heuristics.location || "",
        visa_status_stated: parsed.visa_status_stated || heuristics.visa || "",
        employment_type_stated: parsed.employment_type_stated || heuristics.empType || "",
        summary: parsed.summary || `Candidate profile extracted from ${filename || "resume"}.`,
      };

      return res.json(finalRecord);
    } catch (aiErr) {
      console.warn("AI parse error, using heuristic extractions:", aiErr);
      return res.json({
        name: heuristics.name || fallbackName,
        title: heuristics.title || "IT Professional",
        email: heuristics.email || "",
        phone: heuristics.phone || "",
        skills: heuristics.skills.length > 0 ? heuristics.skills : ["Uploaded Candidate"],
        years_experience: "",
        location: heuristics.location || "",
        visa_status_stated: heuristics.visa || "",
        employment_type_stated: heuristics.empType || "",
        summary: `Uploaded resume file (${filename || "file"}).`,
      });
    }
  } catch (err: any) {
    console.error("Error in /api/parse-resume:", err);
    const fallbackName = (req.body?.filename || "Candidate")
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (l: string) => l.toUpperCase());
    res.json({
      name: fallbackName,
      title: "IT Professional",
      email: "",
      phone: "",
      skills: ["Uploaded Resume"],
      years_experience: "",
      location: "",
      visa_status_stated: "",
      employment_type_stated: "",
      summary: `Document imported (${req.body?.filename || "file"}).`,
    });
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
