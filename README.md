# RescureTag™: Scan for Help. Unlock Secure Details.

**Track Submission:** Agents for Good (Secondary: Concierge Agents / Agents for Business)  
**Concept Focus:** Multi-Agent Systems (ADK), Custom EMR MCP Server, Dynamic Security Guards (PII Scrubbing), Local Signed QR Nonces.

RescureTag is a hardware-enabled SaaS platform pairing a hidden, skin-comfortable QR tag sewn inside a garment's wrist-cuff flap with a secure, two-tier, accessibility-first software experience. This repository contains the complete local sandbox prototype demonstrating the agent interactions, security compliance filters, and custom MCP EMR tools.

---

## 📖 The Problem & Solution

### The Problem
In medical emergencies and routine healthcare operations, seconds are lost searching for vital information and communicating across language, hearing, or cognitive barriers. 
- **Deaf/Hard of Hearing patients** face severe communication barriers in emergency triage.
- **Clinicians** waste time context-switching in Electronic Medical Records (EMRs) to confirm medication lists or allergies.
- **Privacy constraints (HIPAA/GDPR)** prevent printing sensitive details directly on a public wristband or tag.

### The RescureTag Solution
A two-tier secure response system triggered by scanning an inside-cuff QR code:
1. **Tier 1 (Public View):** Scanned by any bystander. Shows owner-approved, minimum-necessary data (e.g., severe allergies, condition badge) along with plain-language first-aid steps and American Sign Language (ASL) tiles.
2. **Tier 2 (Secure View):** Unlocked via clinician SSO or patient biometrics. Grants access to the full EMR history (medications, clinical notes) and triggers a **Clinical Decision Support Agent** that checks drug contraindications and acts as a bedside assistant.

---

## 🛠️ System Architecture

```text
+------------------------------+
|     Glassmorphic Frontend    | <--- Scenario switches, Phone Emulator, Chat UI
+------------------------------+
               | (Fetch API)
               v
+------------------------------+
|      Node.js API Server      | <--- Validates nonces, enforces RBAC token
+------------------------------+
               |
               v
+------------------------------+
|       Security Guard         | <--- Redacts patient PII (Names, DOB) from prompts
+------------------------------+
               |
               v
+------------------------------+       +------------------------------+
|   ADK Multi-Agent System     | <---> |    Custom EMR MCP Server     |
|   (Gemini Decision Support)  |       |   (Query records, check meds)|
+------------------------------+       +------------------------------+
                                                      |
                                                      v
                                       +------------------------------+
                                       |       Mock EMR Database      |
                                       +------------------------------+
```

---

## 💡 Key Capstone Concepts Demonstrated

### 1. Multi-Agent System (ADK)
Coordinates two specialized agents:
- **Emergency Dispatcher Agent:** Active on Tier 1 scans, summarizing essential alerts.
- **EMR Clinical Syncer Agent:** Active on Tier 2 logins, querying the MCP server, running drug interaction checks, and formulating expert diagnostic notes.

### 2. Custom MCP Server (`mcp-server.js`)
Implements standard Model Context Protocol (MCP) JSON-RPC tool endpoints:
- `get_patient_public_record`
- `get_patient_secure_record`
- `check_drug_contraindications`

### 3. Advanced Security Features (`security.js`)
- **Signed URL Nonce Check:** Validates that incoming scan tokens match expected rotating parameters to prevent brute-force tag ID exploration.
- **Local PII Redaction Guard:** Automatically detects patient names and dates of birth, scrubbing them (e.g., replacement with `[REDACTED_PATIENT_NAME]`) before forwarding data to external LLM APIs, and locally re-populates them before returning advice to the clinician.

---

## 🚀 Setup & Execution Guide

### Prerequisites
- Node.js installed (v18+ recommended)
- A Google Gemini API Key (Optional. If not provided, the simulator will automatically run in a high-fidelity **Offline Mock Mode** so you can still fully demo all scenarios).

### Step 1: Install Dependencies
```bash
git clone https://github.com/thyduong1325/rescuretag-agent.git
cd rescuretag-agent
npm install
```

### Step 2: Configure Environment Variable (Optional)
To enable live AI generation with Gemini, create a `.env` file in the root of the project:
```env
GEMINI_API_KEY="your-google-gemini-api-key-here"
```

### Step 3: Run the Server
```bash
npm start
```

### Step 4: Access the Simulator
Open your browser and navigate to:
```text
http://localhost:3000
```

---

## 🧪 Simulation Walkthrough to Demo

1. **Choose a Scenario:** Click one of the patient cards on the left panel (e.g. *Ethan Carter* or *Robert Cooper*).
2. **Scan Public Tier 1:** Click **Scan Tag Now** on the virtual phone. View the public emergency instructions, dial numbers, and click the ASL cards to play sign actions.
3. **Attempt Secure Unlock (Denied):** Click **Unlock Secure Medical Records** inside the phone. The security debugger will flag that SSO keys are missing and block access.
4. **Authorize Clinician SSO:** Toggle the **Clinician Identity Gate** on the left. You will see the cryptographic token generated.
5. **Unlock Secure Tier 2:** Click **Unlock Secure Medical Records** again. Watch the FaceID verify, and unlock the detailed medications and clinical files.
6. **Chat with Clinical Agent:** Use the suggestion buttons at the bottom or type a custom command in the chat box (e.g. *"Check if giving them Aspirin is safe"*). 
7. **Observe Debugger Console:** Watch the right-hand terminal. It highlights:
   - URL verification passes.
   - PII Scrubbing: Redacting patient name from prompt.
   - MCP Server tool calls executing.
   - LLM processing and localized PII restoration.
