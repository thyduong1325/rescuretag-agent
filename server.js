require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const EMRMcpServer = require('./mcp-server');
const security = require('./security');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Google Gemini SDK
// If process.env.GEMINI_API_KEY is not defined, we will run in offline simulation mode gracefully
let ai = null;
if (process.env.GEMINI_API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.log('Gemini API Client initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize Gemini API Client:', err);
  }
} else {
  console.warn('WARNING: GEMINI_API_KEY not found in environment. Running in Offline Mock Mode.');
}

// Instantiate Custom MCP Server
const mcpServer = new EMRMcpServer();

// --- Express Endpoints ---

// 1. Scan tag and retrieve public tier data
app.post('/api/scan', async (req, res) => {
  const { tagId, nonce, authToken } = req.body;
  const debugLogs = [];

  debugLogs.push(`[SCAN] Scanning Tag: ${tagId}`);
  
  // Validate scan URL credentials (nonce check)
  const validation = security.validateSignedScan(tagId, nonce);
  if (!validation.isValid) {
    debugLogs.push(`[SECURITY ALERT] ${validation.reason}`);
    return res.status(403).json({ error: validation.reason, debugLogs });
  }

  debugLogs.push(`[SECURITY] Signed link validated successfully. Nonce matching.`);

  try {
    // 1. Fetch public record using MCP Tool
    const mcpPublicResult = await mcpServer.callTool('get_patient_public_record', { tagId });
    const publicData = JSON.parse(mcpPublicResult.content[0].text);
    debugLogs.push(`[MCP SERVER] Tool called: get_patient_public_record. Returned public emergency view.`);

    let secureData = null;

    // 2. If authenticated clinician, also pull secure data
    if (authToken === 'MOCK_CLINICIAN_AUTH_TOKEN_SUCCESS') {
      debugLogs.push(`[SECURITY] Role-Based Access Control verified: Clinician.`);
      const mcpSecureResult = await mcpServer.callTool('get_patient_secure_record', {
        tagId,
        authToken
      });
      secureData = JSON.parse(mcpSecureResult.content[0].text);
      debugLogs.push(`[MCP SERVER] Tool called: get_patient_secure_record. Unlocked medical history.`);
    } else if (authToken) {
      debugLogs.push(`[SECURITY ACCESS DENIED] Invalid clinician token: ${authToken}`);
    }

    res.json({
      success: true,
      tagId,
      publicTier: publicData,
      secureTier: secureData,
      debugLogs
    });

  } catch (err) {
    debugLogs.push(`[ERROR] Scan processing failed: ${err.message}`);
    res.status(500).json({ error: err.message, debugLogs });
  }
});

// 2. Chat endpoint for authorized clinicians (Clinical Agent)
app.post('/api/agent/chat', async (req, res) => {
  const { tagId, message, authToken } = req.body;
  const debugLogs = [];

  // Check auth
  if (authToken !== 'MOCK_CLINICIAN_AUTH_TOKEN_SUCCESS') {
    debugLogs.push(`[SECURITY ALERT] Blocked chat request. Clinician is not authenticated.`);
    return res.status(403).json({ error: 'Access Denied: Clinician authentication required.', debugLogs });
  }

  try {
    // Get patient details from EMR MCP
    const mcpSecureResult = await mcpServer.callTool('get_patient_secure_record', {
      tagId,
      authToken
    });
    
    if (mcpSecureResult.isError) {
      debugLogs.push(`[MCP ERROR] Failed to load secure record: ${mcpSecureResult.content[0].text}`);
      return res.status(400).json({ error: mcpSecureResult.content[0].text, debugLogs });
    }

    const rawPatientRecord = JSON.parse(mcpSecureResult.content[0].text);
    const patientObj = { secureTier: rawPatientRecord };

    // --- SECURITY FILTER: PII Redaction ---
    debugLogs.push(`[SECURITY] Intercepting chat message. Scanning for patient PII...`);
    const redactedMessage = security.redactPII(message, patientObj);
    const redactedNotes = security.redactPII(rawPatientRecord.clinicalNotes, patientObj);
    
    if (redactedMessage !== message) {
      debugLogs.push(`[SECURITY] Scrubbed patient name/DOB from clinician input.`);
    } else {
      debugLogs.push(`[SECURITY] No raw patient PII found in input message.`);
    }
    
    // --- MCP TOOL: Drug Contraindication Checker (Optional trigger) ---
    let contraindicationReport = "";
    // Regex matching common drug checking phrases: e.g., "give them Advil", "prescribe aspirin", "take Propranolol"
    const drugMatch = message.match(/(?:give|prescribe|administer|take|check|for|inject)\s+([a-zA-Z\-]{3,20})/i);
    
    if (drugMatch && drugMatch[1]) {
      const detectedDrug = drugMatch[1];
      debugLogs.push(`[AGENT REASONING] Clinician mentioned drug '${detectedDrug}'. Triggering contraindication check on EMR MCP server.`);
      
      const mcpDrugResult = await mcpServer.callTool('check_drug_contraindications', {
        tagId,
        newDrug: detectedDrug
      });
      
      const contraindicationData = JSON.parse(mcpDrugResult.content[0].text);
      contraindicationReport = `\nMCP CONTRAINDICATION TOOL REPORT:\n${JSON.stringify(contraindicationData, null, 2)}`;
      debugLogs.push(`[MCP SERVER] Tool called: check_drug_contraindications. Alert level: ${contraindicationData.alertLevel}.`);
    }

    let agentResponseText = "";

    if (ai) {
      debugLogs.push(`[AGENT REASONING] Assembling system prompt and calling Gemini model (gemini-2.5-flash)...`);
      
      const systemInstruction = `You are a clinical decision support agent for the RescureTag Emergency/Medical platform.
You assist emergency responders and clinicians at bedside. 
The patient's name and DOB are redacted in your view for privacy reasons. 
You MUST NOT refer to the patient by their real name (if you somehow deduce it); use 'the patient' or '[REDACTED_PATIENT_NAME]'.

Here is the patient's redacted EMR context:
- MRN: ${rawPatientRecord.mrn}
- Active Medications: ${JSON.stringify(rawPatientRecord.activeMedications)}
- Clinical Notes: ${redactedNotes}
- Recent Labs: ${JSON.stringify(rawPatientRecord.recentLabs)}
${contraindicationReport}

Answer the clinician's query clearly, professionally, and concisely. If a drug contraindication is flagged, highlight it immediately and list the safe alternative action.`;

      // Call Gemini API
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: redactedMessage,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.2
        }
      });

      const rawLlmResponse = result.text;
      debugLogs.push(`[GEMINI API] Received response from Gemini API.`);

      // --- SECURITY FILTER: PII Restoration ---
      agentResponseText = security.unredactPII(rawLlmResponse, patientObj);
      debugLogs.push(`[SECURITY] Re-populating patient name and identity details locally for authorized view.`);

    } else {
      // Offline fallback mock responses for testing without API keys
      debugLogs.push(`[AGENT REASONING (OFFLINE)] Matching prompt to offline mock response list...`);
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate latency
      
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes('aspirin') || lowerMsg.includes('ibuprofen') || lowerMsg.includes('advil')) {
        agentResponseText = `I have reviewed the patient's records. **CRITICAL WARNING:** ${rawPatientRecord.fullName} is currently prescribed Apixaban (Eliquis), a strong anticoagulant. Giving NSAIDs such as Aspirin or Ibuprofen increases the risk of severe internal bleeding. Please consult hematology or use a non-NSAID alternative (e.g. Acetaminophen) if appropriate.`;
      } else if (lowerMsg.includes('propranolol') || lowerMsg.includes('beta blocker')) {
        agentResponseText = `I have reviewed the patient's records. **WARNING:** ${rawPatientRecord.fullName} is asthmatic and uses Albuterol. Beta-blockers like Propranolol can provoke severe bronchial constriction. Do not administer.`;
      } else if (lowerMsg.includes('medication') || lowerMsg.includes('meds')) {
        const medList = rawPatientRecord.activeMedications.map(m => `- **${m.name}** (${m.dose}, ${m.frequency})`).join('\n');
        agentResponseText = `Here is ${rawPatientRecord.fullName}'s current active medication list:\n${medList}\n\nPlease verify that these match the current administration schedule.`;
      } else if (lowerMsg.includes('summarize') || lowerMsg.includes('history') || lowerMsg.includes('summary')) {
        const medList = rawPatientRecord.activeMedications.map(m => `- **${m.name}** (${m.dose}, ${m.frequency})`).join('\n');
        agentResponseText = `### Clinical Summary for ${rawPatientRecord.fullName} (MRN: ${rawPatientRecord.mrn})
- **Primary Diagnosis:** ${rawPatientRecord.condition}
- **Clinical Narrative:** ${rawPatientRecord.clinicalNotes}
- **Active Medications:**
${medList}

*Clinical briefing completed by EMR Decision Agent (Offline Sandbox Mode).*`;
      } else {
        agentResponseText = `I am the EMR Clinical Agent. I have analyzed ${rawPatientRecord.fullName}'s secure records (MRN: ${rawPatientRecord.mrn}). Let me know if you need to check drug contraindications, review recent labs, or get clinical summaries.`;
      }
      debugLogs.push(`[AGENT REASONING] Offline mock response generated successfully.`);
    }

    res.json({
      success: true,
      response: agentResponseText,
      debugLogs
    });

  } catch (err) {
    debugLogs.push(`[ERROR] Chat execution failed: ${err.message}`);
    res.status(500).json({ error: err.message, debugLogs });
  }
});

// Expose local network IP to dynamically generate scan links
app.get('/api/ip', (req, res) => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.family === 'IPv4') {
        localIp = iface.address;
        break;
      }
    }
    if (localIp !== 'localhost') break;
  }
  res.json({ ip: localIp });
});

// Start Express Server
app.listen(port, () => {
  console.log(`RescureTag Simulator Backend running on http://localhost:${port}`);
});

