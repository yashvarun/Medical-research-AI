require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Groq } = require('groq-sdk');

const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.post('/api/research', async (req, res) => {
  const { query, sessionId } = req.body;
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are Aynav.atom, an expert medical research assistant." },
        { role: "user", content: query }
      ],
      model: "llama-3.1-8b-instant", 
      temperature: 0.5,
    });
    res.json({ result: chatCompletion.choices[0].message.content });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Failed to generate AI response" });
  }
});



// ============================================================================
// 1. MONGODB SETUP & SCHEMA
// ============================================================================
// Replace YOUR_MONGODB_PASSWORD with your actual password
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('🟢 Connected to MongoDB Atlas!'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

const chatSessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    messages: [
        {
            role: { type: String, enum: ['user', 'ai'] },
            content: String,
            timestamp: { type: Date, default: Date.now }
        }
    ]
});
const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

// ============================================================================
// 2. THE AI PIPELINE (With JS Link Stitching)
// ============================================================================
async function expandQuery(userQuery, chatHistory) {
    const historyText = chatHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    
    const systemPrompt = `You are a medical research routing assistant. Output ONLY a raw, valid JSON object. Do not include markdown formatting.
    PAST CONVERSATION HISTORY:
    ${historyText}
    EXAMPLE OUTPUT FORMAT: { "disease_condition": "disease name", "pubmed_query": "boolean query", "clinical_trials_query": "keywords", "user_intent": "intent summary" }
    Now, extract parameters for the user's NEW query:`;

    const response = await ollama.chat({
        model: 'llama3.2:1b', 
        messages: [ { role: 'system', content: systemPrompt }, { role: 'user', content: userQuery } ],
        format: 'json',
        options: { temperature: 0.1, num_ctx: 1500 }
    });
    return JSON.parse(response.message.content);
}

async function fetchClinicalTrials(routingData) {
    const condition = encodeURIComponent(routingData.clinical_trials_query);
    const url = `https://clinicaltrials.gov/api/v2/studies?query.cond=${condition}&filter.overallStatus=RECRUITING&pageSize=5&format=json`;
    try {
        const response = await axios.get(url);
        let trialsText = "";
        response.data.studies.forEach((trial) => {
            const title = trial.protocolSection.identificationModule?.officialTitle || "No Title";
            const nctId = trial.protocolSection.identificationModule?.nctId;
            const trialLink = nctId ? `https://clinicaltrials.gov/study/${nctId}` : "https://clinicaltrials.gov";
            trialsText += `* [${title}](${trialLink})\n`;
        });
        return trialsText || "No clinical trials found for this query.";
    } catch (error) { return "Error fetching Clinical Trials."; }
}

async function fetchPubMed(routingData) {
    try {
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(routingData.pubmed_query)}&retmax=5&sort=pub+date&retmode=json`;
        const searchResponse = await axios.get(searchUrl);
        const articleIds = searchResponse.data.esearchresult.idlist;
        if (!articleIds || articleIds.length === 0) return "No PubMed articles found.";

        const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${articleIds.join(',')}&retmode=json`;
        const summaryResponse = await axios.get(summaryUrl);
        let pubmedText = "";
        articleIds.forEach((id) => {
            const title = summaryResponse.data.result[id].title || "No Title";
            const pubmedLink = `https://pubmed.ncbi.nlm.nih.gov/${id}/`;
            pubmedText += `* [${title}](${pubmedLink})\n`;
        });
        return pubmedText;
    } catch (error) { return "Error fetching PubMed articles."; }
}

async function synthesizeResponse(query, context, chatHistory) {
    const formattedHistory = chatHistory.map(msg => ({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.content
    }));

    const systemMessage = {
        role: 'system',
        content: `You are an expert Medical Research Assistant. Based on the user's query and the provided context data, write a brief, insightful overview (3-4 sentences) summarizing the condition and the focus of the current research. 
        DO NOT list the trials or papers. ONLY write the summary paragraph.
        CONTEXT DATA:
        And if the user did not asked about the specific trials or papers, you can provide a general answer to carry the conversation.
        ${context}`
    };

    const messagesArray = [systemMessage, ...formattedHistory, { role: 'user', content: query }];

    const response = await ollama.chat({
        model: 'llama3.2:1b',
        messages: messagesArray,
        options: { temperature: 0.3, num_ctx: 2048 } 
    });
    return response.message.content;
}

// ============================================================================
// 3. THE API ENDPOINT
// ============================================================================
app.post('/api/research', async (req, res) => {
    try {
        const userQuery = req.body.query;
        const sessionId = req.body.sessionId || 'default-session'; 

        if (!userQuery) return res.status(400).json({ error: "Please provide a query." });
        console.log(`\n🚀 Received request: "${userQuery}" [Session: ${sessionId}]`);

        let session = await ChatSession.findOne({ sessionId });
        if (!session) session = new ChatSession({ sessionId, messages: [] });
        
        const recentHistory = session.messages.slice(-4);
        const routingData = await expandQuery(userQuery, recentHistory);
        console.log("✅ Query expanded:", routingData.disease_condition);
        
        const trialsData = await fetchClinicalTrials(routingData);
        const pubmedData = await fetchPubMed(routingData);
        console.log("✅ API Data retrieved.");

        const combinedContext = `TRIALS:\n${trialsData}\n\nPUBMED:\n${pubmedData}`;
        const aiOverview = await synthesizeResponse(userQuery, combinedContext, recentHistory);
        console.log("✅ AI Overview generated.");

        // Stitching it perfectly in Javascript
        const finalReport = `### 1. Condition Overview\n${aiOverview}\n\n### 2. Relevant Clinical Trials\n${trialsData}\n\n### 3. Key Research Papers\n${pubmedData}`;

        session.messages.push({ role: 'user', content: userQuery });
        session.messages.push({ role: 'ai', content: finalReport });
        await session.save();
        console.log("💾 Saved to MongoDB.");

        res.json({ result: finalReport });

    } catch (error) {
        console.error("❌ API Error:", error);
        res.status(500).json({ error: "An error occurred while processing your request." });
    }
});

const PORT = process.env.PORT || 5000;


app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
