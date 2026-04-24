const { Ollama } = require('ollama');
const axios = require('axios');

const ollama = new Ollama({ host: 'http://localhost:11434' });

// ============================================================================
// 1. THE ROUTER (Expands the query into JSON)
// ============================================================================
async function expandQuery(userQuery) {
    console.log(`\n🧠 STEP 1: Analyzing query...`);
    const systemPrompt = `
You are a medical research routing assistant. Output ONLY a raw, valid JSON object. Do not include markdown formatting.

EXAMPLE INPUT:
"I want to know about new treatments and trials for type 2 diabetes"

EXAMPLE OUTPUT:
{
  "disease_condition": "type 2 diabetes",
  "pubmed_query": "type 2 diabetes AND (treatment OR therapy)",
  "clinical_trials_query": "diabetes type 2",
  "user_intent": "new treatments and clinical trials"
}

Now, do this for the user's query:
`;

    const response = await ollama.chat({
        model: 'llama3.2:1b', // Ensure your model name is correct
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuery }
        ],
        format: 'json',
        options: { temperature: 0.1, num_ctx: 1024 }
    });

    const result = JSON.parse(response.message.content);
    console.log(`✅ Extracted parameters:`, result);
    return result;
}

// ============================================================================
// 2. THE RETRIEVERS (Fetches APIs and returns text blocks)
// ============================================================================
async function fetchClinicalTrials(routingData) {
    console.log(`\n🔍 STEP 2a: Fetching Clinical Trials for "${routingData.clinical_trials_query}"...`);
    const condition = encodeURIComponent(routingData.clinical_trials_query);
    const url = `https://clinicaltrials.gov/api/v2/studies?query.cond=${condition}&filter.overallStatus=RECRUITING&pageSize=5&format=json`;

    try {
        const response = await axios.get(url);
        const trials = response.data.studies;
        let trialsText = "CLINICAL TRIALS FOUND:\n";
        
        trials.forEach((trial, index) => {
            const title = trial.protocolSection.identificationModule?.officialTitle || "No Title";
            trialsText += `Trial ${index + 1}: ${title}\n`;
        });
        
        console.log(`✅ Found ${trials.length} trials.`);
        return trialsText;
    } catch (error) {
        return "Error fetching Clinical Trials.";
    }
}

async function fetchPubMed(routingData) {
    console.log(`\n📚 STEP 2b: Fetching PubMed Research for "${routingData.pubmed_query}"...`);
    try {
        const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(routingData.pubmed_query)}&retmax=5&sort=pub+date&retmode=json`;
        const searchResponse = await axios.get(searchUrl);
        const articleIds = searchResponse.data.esearchresult.idlist;

        if (!articleIds || articleIds.length === 0) return "No PubMed articles found.";

        const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${articleIds.join(',')}&retmode=json`;
        const summaryResponse = await axios.get(summaryUrl);
        const articles = summaryResponse.data.result;

        let pubmedText = "PUBMED RESEARCH FOUND:\n";
        articleIds.forEach((id, index) => {
            const title = articles[id].title || "No Title";
            pubmedText += `Research ${index + 1}: ${title}\n`;
        });

        console.log(`✅ Found ${articleIds.length} research papers.`);
        return pubmedText;
    } catch (error) {
        return "Error fetching PubMed articles.";
    }
}

// ============================================================================
// 3. THE SYNTHESIZER (Writes the final report)
// ============================================================================
async function synthesizeResponse(query, context) {
    console.log(`\n✍️  STEP 3: Synthesizing final report. Please wait...\n`);
    const systemPrompt = `
You are an expert Medical Research Assistant. Answer the user's query using ONLY the provided clinical trials and research data. Do not hallucinate outside information.

Format strictly using this Markdown structure:
### 1. Condition Overview
### 2. Relevant Clinical Trials Found
### 3. Key Research Insights
`;

    const response = await ollama.chat({
        model: 'llama3.2:1b',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `CONTEXT DATA:\n${context}\n\nUSER QUERY:\n${query}` }
        ],
        options: { temperature: 0.3, num_ctx: 2048 }
    });

    console.log("==================== FINAL OUTPUT ====================");
    console.log(response.message.content);
    console.log("======================================================");
}

// ============================================================================
// 4. THE MASTER EXECUTION FLOW
// ============================================================================
async function runMasterAgent() {
    // You can change this query to test different diseases!
    const testQuery = "What are the latest clinical trials and research for type 1 diabetes?";
    
    console.log(`Starting Medical AI Agent for query: "${testQuery}"`);

    // Step 1: Route
    const routingData = await expandQuery(testQuery);

    // Step 2: Fetch Data
    const trialsData = await fetchClinicalTrials(routingData);
    const pubmedData = await fetchPubMed(routingData);

    // Combine all fetched data into one context block
    const combinedContext = `${trialsData}\n\n${pubmedData}`;

    // Step 3: Synthesize
    await synthesizeResponse(testQuery, combinedContext);
}

// Start the app
runMasterAgent();