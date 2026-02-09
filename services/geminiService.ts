
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, Project, ResumeContent, CareerPredictionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface FileInput {
  mimeType: string;
  data: string;
}

export const analyzeResume = async (
  jdText: string, 
  resumeInput?: string | FileInput,
  enVariant: string = 'American'
): Promise<AnalysisResult> => {
  const model = "gemini-3-flash-preview"; 

  // --- 1. Strict Null/Length Validation ---
  const isTextResume = typeof resumeInput === 'string';
  const resumeLen = isTextResume ? (resumeInput as string).length : 100;
  
  if (!jdText || jdText.length < 50 || (isTextResume && resumeLen < 50)) {
     return {
        overallScore: 0,
        scoreBreakdown: {
            coreSkills: 0,
            starQuality: 0,
            industryRelevance: 0,
            formatting: 0,
            explanation: "Insufficient information. Please provide a detailed JD and Resume (min 50 chars)."
        },
        weights: { jdRequirements: 0, skillOverlap: 0 },
        hardSkills: [],
        softSkills: [],
        missingSkills: [],
        optimizedResume: {
            fullName: "", contactInfo: "", summary: "", technicalSkills: [], softSkills: [], 
            experiences: [], volunteer: [], schoolProjects: [], education: [], references: []
        },
        coverLetter: ""
     };
  }

  let userContentPart: any;
  let isFile = false;

  if (typeof resumeInput === 'object' && resumeInput !== null) {
     isFile = true;
     userContentPart = {
        inlineData: { mimeType: resumeInput.mimeType, data: resumeInput.data }
     };
  } else {
     userContentPart = { text: resumeInput || "No resume provided" };
  }

  const variantInstruction = enVariant === 'British' 
    ? "Use British English (Traditional)." 
    : enVariant === 'Australian'
    ? "Use Australian English."
    : "Use American English (Simplified).";

  const systemInstruction = `
    Role: Senior Executive Headhunter & Career Strategist.
    Task: Analyze the resume against the JD with a focus on POTENTIAL, SEMANTIC RELEVANCE, and TRANSFERABLE SKILLS.
    
    LANGUAGE VARIANT: ${variantInstruction}

    *** NEW SCORING LOGIC (SEMANTIC & POTENTIAL) ***
    
    1. **SEMANTIC SIMILARITY (CRITICAL):**
       - DO NOT limit to exact keyword matching.
       - Recognize domain authorities: e.g., "UnionPay", "Alipay", "Stripe" = "Fintech/Payment Systems".
       - "EverFresh", "FMCG" = "Supply Chain" or "Retail".
       - If JD asks for "Website Management" and candidate has "Social Media Management", award **50% credit**.
       - If JD asks for "Photoshop" and candidate has "Canva", award **50% credit**.
    
    2. **POTENTIAL SCORE (For Students/Juniors):**
       - Weight **School Projects** and **Education** equal to Professional Experience for < 2 years experience.
       - High-quality academic assessments count as "Work History".

    3. **SCORING GRADIENT (0-100):**
       - 0: No mention.
       - 40: Weak mention.
       - 60: Transferable Skill / Related Tool.
       - 80: Direct Skill Match.
       - 100: Direct Match + Quantified Result (STAR).

    4. **SCORE BOOSTING STRATEGY (MANDATORY):**
       - Provide a specific "Quick Fix".
       - Format: "Strategy: Add '[Metric]' to '[Project Name]' to boost score by +[Points]."

    5. **COVER LETTER GENERATION (CRITICAL):**
       - Write a **3-4 paragraph** persuasive cover letter body.
       - Do NOT use generic placeholders like "[Your Name]". Use the candidate's actual data.
       - **Paragraph 1:** Hook the recruiter by mentioning the specific role and a shared value/goal found in the JD.
       - **Paragraph 2:** "The Evidence". Deep dive into 1-2 specific projects or roles from the resume that DIRECTLY prove the core skills required.
       - **Paragraph 3:** "The Fit". Mention why this specific company/industry appeals to the candidate based on their background.
       - **Paragraph 4:** Call to action.
       - **IMPORTANT:** DO NOT include a sign-off (e.g., "Sincerely", "Best regards") or the candidate's name at the end. The UI appends this automatically. Only provide the body text.
       - Tone: Professional, confident, enthusiastic.

    *** CONTENT RECONSTRUCTION ***
    - Extract "Professional Experience", "Volunteer", and "School Projects" separately.
  `;

  const promptText = `
    [TARGET JOB DESCRIPTION]
    ${jdText}

    [CANDIDATE SOURCE RESUME]
    ${isFile ? 'Analyze and return ALL professional history from this file.' : userContentPart.text}
  `;

  const parts: any[] = [{ text: promptText }];
  if (isFile) {
     parts.push(userContentPart);
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedLanguage: { type: Type.STRING, enum: ['en', 'zh'] },
            overallScore: { type: Type.NUMBER },
            scoreBreakdown: {
                type: Type.OBJECT,
                properties: {
                    coreSkills: { type: Type.NUMBER, description: "Includes semantic matches (50% credit)" },
                    starQuality: { type: Type.NUMBER, description: "Based on quantification" },
                    industryRelevance: { type: Type.NUMBER },
                    formatting: { type: Type.NUMBER },
                    explanation: { type: Type.STRING, description: "Include Score Boosting Strategy." }
                },
                required: ['coreSkills', 'starQuality', 'industryRelevance', 'formatting', 'explanation']
            },
            weights: {
              type: Type.OBJECT,
              properties: {
                jdRequirements: { type: Type.NUMBER },
                skillOverlap: { type: Type.NUMBER }
              }
            },
            hardSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            softSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
            coverLetter: { type: Type.STRING },
            optimizedResume: {
              type: Type.OBJECT,
              properties: {
                fullName: { type: Type.STRING },
                contactInfo: { type: Type.STRING },
                linkedin: { type: Type.STRING },
                github: { type: Type.STRING },
                website: { type: Type.STRING },
                summary: { type: Type.STRING },
                targetJobTitle: { type: Type.STRING },
                targetCompany: { type: Type.STRING },
                targetAddress: { type: Type.STRING },
                recipientName: { type: Type.STRING },
                technicalSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
                softSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
                education: { 
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      school: { type: Type.STRING },
                      degree: { type: Type.STRING },
                      startDate: { type: Type.STRING },
                      endDate: { type: Type.STRING }
                    }
                  } 
                },
                references: { 
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      fullName: { type: Type.STRING },
                      jobTitle: { type: Type.STRING },
                      company: { type: Type.STRING },
                      contactInfo: { type: Type.STRING },
                      relationship: { type: Type.STRING }
                    },
                    required: ['fullName', 'jobTitle', 'company', 'contactInfo', 'relationship']
                  }
                },
                experiences: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      role: { type: Type.STRING },
                      company: { type: Type.STRING },
                      period: { type: Type.STRING },
                      bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                      isMatch: { type: Type.BOOLEAN }
                    }
                  }
                },
                volunteer: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      role: { type: Type.STRING },
                      company: { type: Type.STRING },
                      period: { type: Type.STRING },
                      bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                      isMatch: { type: Type.BOOLEAN }
                    }
                  }
                },
                schoolProjects: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      role: { type: Type.STRING, description: "Project Role or Name" },
                      company: { type: Type.STRING, description: "Course Name or Institution" },
                      period: { type: Type.STRING },
                      bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                      isMatch: { type: Type.BOOLEAN }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{}') as AnalysisResult;
    
    // SAFETY INITIALIZATION
    if (!result.optimizedResume) {
        result.optimizedResume = {
            fullName: "", contactInfo: "", summary: "", 
            technicalSkills: [], softSkills: [], 
            experiences: [], volunteer: [], schoolProjects: [], 
            education: [], references: []
        };
    }

    const ensureIds = (list: any[], prefix: string) => 
        (list || []).map((item, idx) => ({ ...item, id: item.id || `${prefix}-${idx}-${Date.now()}` }));

    result.optimizedResume.education = ensureIds(result.optimizedResume.education, 'edu');
    result.optimizedResume.experiences = ensureIds(result.optimizedResume.experiences, 'exp');
    result.optimizedResume.volunteer = ensureIds(result.optimizedResume.volunteer, 'vol');
    result.optimizedResume.schoolProjects = ensureIds(result.optimizedResume.schoolProjects, 'proj');
    result.optimizedResume.references = ensureIds(result.optimizedResume.references, 'ref');
    
    if (!result.optimizedResume.recipientName) {
      result.optimizedResume.recipientName = 'The Hiring Manager';
    }

    if (!result.scoreBreakdown) {
       result.scoreBreakdown = {
           coreSkills: 40, 
           starQuality: 20,
           industryRelevance: 20,
           formatting: 10,
           explanation: "Score estimated. Add metrics to improve."
       };
    }

    // Force score to be at least 40 if there are skills found
    if ((result.hardSkills || []).length > 0 && result.overallScore < 40) {
        result.overallScore = 45;
    }

    return result;
  } catch (error) {
    console.error("Error analyzing resume:", error);
    throw error;
  }
};


export const analyzeProjectMedia = async (
  inputData: string, 
  mimeType: string,
  fileName: string
): Promise<Omit<Project, 'id' | 'originalFileName' | 'originalMimeType' | 'base64Data'>> => {
  const model = "gemini-3-flash-preview";

  const isText = mimeType === 'text/plain';
  const isVideo = mimeType.startsWith('video/');
  const isAudio = mimeType.startsWith('audio/');
  
  const systemInstruction = `
    Role: Creative Director & Senior Content Strategist.
    Task: Analyze the uploaded portfolio file and generate a high-impact entry.
    
    CLASSIFICATION RULES (Strictly adhere to these categories):
    - "Visual Design": Images, UI mocks, Figma screenshots, Artwork.
    - "Marketing Strategy": PDF reports, Word Docs, Research papers, Text content.
    - "Video Content": MP4, QuickTime, Animation files.
    - "Audio Content": MP3, WAV, Podcasts.
    - "Other": Certificates, etc.

    OUTPUT REQUIREMENTS:
    1. Title: 
       - For Video/Audio: GENERATE A CREATIVE TITLE based on the content (e.g. "Brand Campaign V1" instead of "vid_final.mp4").
       - For Docs: Use a clean professional title.
    2. Executive Summary (Description): 
       - For Documents/Strategy: WRITE A SOPHISTICATED 100-WORD SUMMARY of the strategy, results, or methodology. This is mandatory.
       - For Visuals: Describe the aesthetic style, tools used, and user impact.
    3. Key Competencies (Tag): A list of 1-3 highly relevant professional tags (e.g. "Market Research", "UX Design", "Brand Strategy").

    OUTPUT JSON SCHEMA:
    {
      "category": "Visual Design" | "Marketing Strategy" | "Video Content" | "Audio Content" | "Other",
      "type": "UI/Code" | "Photo" | "Document" | "Video" | "Audio",
      "title": "String",
      "executiveSummary": "String",
      "keyCompetencies": ["String"]
    }
  `;

  const parts: any[] = [];
  
  if (isText) {
    parts.push({ text: `File Content Preview:\n${inputData.substring(0, 5000)}` });
  } else {
    parts.push({
      inlineData: {
        data: inputData,
        mimeType: mimeType,
      },
    });
  }

  parts.push({
    text: `Analyze this file: "${fileName}". Return JSON matching the schema.`
  });

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING },
            type: { type: Type.STRING },
            title: { type: Type.STRING },
            executiveSummary: { type: Type.STRING },
            keyCompetencies: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['category', 'type', 'title', 'executiveSummary', 'keyCompetencies']
        },
      },
    });

    const result = JSON.parse(response.text || '{}');
    
    // Correction Logic ensuring category mapping is robust
    let finalCategory = result.category;
    if (isVideo) finalCategory = 'Video Content';
    if (isAudio) finalCategory = 'Audio Content';
    if (!finalCategory) finalCategory = 'Other';

    return {
        category: finalCategory,
        type: result.type || 'Document',
        title: result.title || fileName,
        description: result.executiveSummary || "No description available.",
        associatedSkills: result.keyCompetencies || ['Project']
    };

  } catch (error) {
    // Fallback if AI fails
    let type: any = 'Other';
    let category: any = 'Marketing Strategy';
    if (mimeType.startsWith('image/')) { type = 'Photo'; category = 'Visual Design'; }
    if (mimeType.startsWith('video/')) { type = 'Video'; category = 'Video Content'; }
    if (mimeType.startsWith('audio/')) { type = 'Audio'; category = 'Audio Content'; }
    if (mimeType.includes('pdf') || mimeType.includes('word')) { type = 'Document'; category = 'Marketing Strategy'; }

    return {
      category,
      type,
      title: fileName.split('.').slice(0, -1).join('.') || 'Untitled Project',
      description: 'Project uploaded successfully. Please add a description.',
      associatedSkills: ['Project']
    };
  }
};

export const generatePortfolioBio = async (
    projects: Project[],
    resume: ResumeContent | null
): Promise<{ bio: string; role: string }> => {
    const model = "gemini-3-flash-preview";
    const projectSummary = projects.map(p => `${p.title} (${p.type}): ${p.description}`).join('\n');
    const resumeSummary = resume ? `Name: ${resume.fullName}, Current Role: ${resume.experiences?.[0]?.role}` : "No resume";

    const systemInstruction = `
        Role: Portfolio Copywriter.
        Task: Write a captivating, executive-style bio (max 40 words) and a professional role title.
        
        Input Data:
        - Projects: ${projectSummary}
        - Resume: ${resumeSummary}
        
        Output JSON:
        {
           "bio": "First person bio. Engaging, confident, professional.",
           "role": "A defining professional title (e.g. 'Multidisciplinary Designer' or 'Strategic Product Lead')"
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: [{ text: "Generate bio based on my work." }],
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        bio: { type: Type.STRING },
                        role: { type: Type.STRING }
                    }
                }
            }
        });
        return JSON.parse(response.text || '{"bio": "Creative professional with a diverse portfolio.", "role": "Creative Lead"}');
    } catch (e) {
        return { bio: "Creative professional showcasing a diverse collection of work.", role: "Portfolio Owner" };
    }
};

export const generateDocumentSummary = async (
    base64Data: string, 
    mimeType: string,
    userContext?: string
): Promise<{ summary: string; keyPoints: string[] }> => {
    const model = "gemini-3-flash-preview";
    const contextStr = userContext ? `Candidate Background Context: ${userContext} (e.g., RMIT Business, Data Analysis).` : "";
    
    const parts = [
        {
            inlineData: {
                data: base64Data,
                mimeType: mimeType
            }
        },
        {
            text: `
                ${contextStr}
                Analyze this document content (which might be a report, assignment, or project).
                
                1. **EXECUTIVE SUMMARY**: Write a sophisticated 100-word professional summary. Connect the project content to high-value skills like "Statistical Modeling", "Brand Strategy", or "Data Optimization" if relevant to the user context. Frame it as a professional achievement.
                
                2. **KEY COMPETENCIES**: Extract 3-5 specific, punchy technical or soft skill keywords (e.g. "TikTok Ads", "ROI Optimization", "Python").
            `
        }
    ];

    try {
        const response = await ai.models.generateContent({
            model,
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING, description: "Professional executive summary" },
                        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Competency tags" }
                    }
                }
            }
        });
        return JSON.parse(response.text || '{"summary": "Analysis failed", "keyPoints": []}');
    } catch (e) {
        console.error(e);
        return { summary: "Could not analyze document content. Please try downloading the original file.", keyPoints: ["Document Analysis"] };
    }
};

export const generateCareerPrediction = async (
  projects: Project[],
  resume: ResumeContent | null,
  targetRole?: string,
  targetJd?: string
): Promise<CareerPredictionResult> => {
  const model = "gemini-3-flash-preview";

  const projectsContext = projects.map(p => `- ${p.title} (${p.type}): ${p.description}`).join('\n');
  const experiences = resume?.experiences?.map(e => `${e.role} at ${e.company} (${e.period})`).join('\n') || "";
  const education = resume?.education?.map(e => `${e.degree} at ${e.school} (${e.startDate} - ${e.endDate})`).join('\n') || "";

  const resumeContext = resume ? `
    Name: ${resume.fullName}
    Experiences:
    ${experiences}
    Education:
    ${education}
    Skills: ${resume.technicalSkills.join(', ')}
  ` : "Resume not fully parsed yet. Use available project data.";

  const targetContext = targetRole ? `
    *** TARGETED ANALYSIS REQUESTED ***
    The user is aiming for the role: "${targetRole}"
    ${targetJd ? `Target Job Description Context: ${targetJd}` : ""}
  ` : "Perform a general trajectory analysis based on skills.";

  // TIME CONTEXT OVERRIDE
  const timeContext = `
    CURRENT YEAR: 2026.
    Assume the user is starting their career path planning from TODAY (2026).
    All timeline projections must start from 2026 and extend into the future (e.g., 2027, 2028).
  `;

  const systemInstruction = `
    Role: AI Career Futurist & Headhunter.
    Task: Analyze trajectory and predict 3 paths.
    
    *** TRAJECTORY ANALYSIS ***
    - DETECT SKILL EVOLUTION: Segregate into Early Skills, Strategic Skills, and Gap Skills for the target role.
    
    Output strict JSON.
  `;

  const prompt = `
    Analyze this portfolio and resume data.
    ${timeContext}
    ${targetContext}
    
    [PROJECTS]
    ${projectsContext || "No projects uploaded."}

    [RESUME]
    ${resumeContext}

    Return 3 career paths with detailed gap analysis, salary, and action plans. 
    Also return a 'skillTrajectory' which maps years to key skills evolved (Start from 2026).
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            currentLevel: { type: Type.STRING },
            skillTrajectory: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  year: { type: Type.STRING },
                  skill: { type: Type.STRING }
                }
              }
            },
            paths: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  role: { type: Type.STRING },
                  match: { type: Type.NUMBER },
                  salaryRange: { type: Type.STRING },
                  timeToReach: { type: Type.STRING },
                  description: { type: Type.STRING },
                  missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
                  detailedPlan: {
                      type: Type.ARRAY,
                      items: {
                          type: Type.OBJECT,
                          properties: {
                              step: { type: Type.STRING },
                              description: { type: Type.STRING },
                              impact: { type: Type.STRING }
                          }
                      }
                  }
                }
              }
            },
            actionPlan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  step: { type: Type.STRING },
                  description: { type: Type.STRING },
                  impact: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text || '{}') as CareerPredictionResult;
    
    // Ensure descriptions are present
    if (result.paths) {
        result.paths.forEach(p => {
            if (!p.description || p.description.length < 5) {
                p.description = `Predicted career trajectory for ${p.role}. Requires bridging ${p.missingSkills?.[0] || 'specific skills'}.`;
            }
        });
    }
    
    return result;
  } catch (error) {
    console.error("Career Prediction Error", error);
    return {
      currentLevel: "Professional",
      skillTrajectory: [{year: "2026", skill: "Core Skills"}],
      paths: [],
      actionPlan: []
    };
  }
};

export const generateCareerStrategy = async (
    resume: ResumeContent | null,
    projects: Project[],
    targetRole: string,
    missingSkills: string[]
): Promise<any> => {
    const model = "gemini-3-flash-preview";
    const systemInstruction = `
        Role: AI Senior Talent Architect.
        Task: Create a deep execution strategy document.
        Context: The user has a background often associated with institutions like RMIT and specific project history.
    `;

    const prompt = `
        Create a career strategy for: ${targetRole}.
        Current Skills: ${resume?.technicalSkills.join(', ')}
        Projects: ${projects.map(p => p.title).join(', ')}
        Gap Skills: ${missingSkills.join(', ')}

        Generate JSON:
        {
          "gapFix": [ { "topic": string, "advice": string, "resource": string } ],
          "interviewPrep": [ { "question": string, "suggestedAnswer": string } ],
          "portfolioUpgrade": [ { "title": string, "strategy": string } ]
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: [{ text: prompt }],
            config: { systemInstruction, responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return { gapFix: [], interviewPrep: [], portfolioUpgrade: [] };
    }
};

export const generateProjectSuggestion = async (
  skill: string,
  resumeContext: string
): Promise<{ title: string; description: string; type: string }> => {
  const model = "gemini-3-flash-preview";
  const prompt = `
    The user is missing the skill: "${skill}".
    Based on their background: ${resumeContext},
    Generate a concrete "Gap-Filling Project" idea they can do to prove this skill.
    
    Output JSON with title, description, and suggested project type (e.g. Case Study, GitHub Repo, Mockup).
  `;

  try {
     const response = await ai.models.generateContent({
        model,
        contents: [{ text: prompt }],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    type: { type: Type.STRING }
                }
            }
        }
     });
     return JSON.parse(response.text || '{}');
  } catch (e) {
      return { title: "Custom Project", description: `Create a project demonstrating ${skill}.`, type: "Self-Directed" };
  }
}

export const getAICoachResponse = async (
    chatHistory: { role: string; parts: { text: string }[] }[], 
    currentPortfolioData: any,
    resumeContent?: ResumeContent | null,
    jdText?: string
): Promise<string> => {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    Role: AI Career Coach.
    Task: Provide career advice.
  `;
    const messages = [
    {
      role: 'user',
      parts: [{ text: `
        CONTEXT DATA:
        Portfolio Health: ${currentPortfolioData.healthScore}/100
        JD: ${jdText ? jdText.substring(0, 300) : "N/A"}
        Chat: ${JSON.stringify(chatHistory)}
      ` }]
    }
  ];

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: messages,
      config: { systemInstruction },
    });
    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    return "I'm experiencing some technical difficulties.";
  }
};
