// --- Global State ---
let currentTagId = 'tag_asthma_001';
let currentNonce = 'xyz123';
let authToken = null;
let currentScenarioData = null;

// Initialize app on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  logToConsole('RescureTag sandbox initialized. Ready for scan event.', 'system');
  logToConsole('Express router listening at port 3000.', 'system');
});

// Write line into Debugger Console
function logToConsole(message, type = 'system') {
  const container = document.getElementById('console-logs-container');
  if (!container) return;

  const line = document.createElement('div');
  line.className = `console-line ${type}-line`;
  
  const timestamp = new Date().toLocaleTimeString();
  line.innerText = `[${timestamp}] ${message}`;
  
  container.appendChild(line);
  container.scrollTop = container.scrollHeight;
}

// Clear Debugger Console
function clearConsole() {
  const container = document.getElementById('console-logs-container');
  if (container) container.innerHTML = '';
}

// 1. Select cuff tag scenario
function selectScenario(tagId, nonce) {
  currentTagId = tagId;
  currentNonce = nonce;
  
  // Highlight active card
  document.querySelectorAll('.scenario-card').forEach(card => card.classList.remove('active'));
  document.getElementById(`scen-${tagId}`).classList.add('active');
  
  logToConsole(`Scenario Switched: ${tagId.toUpperCase()}. Ready to scan.`, 'system');
  
  // Reset screen view back to scan pending
  resetSimulator();
}

// Toggle Clinician Authentication Mode (SSO)
function toggleAuth() {
  const checkbox = document.getElementById('clinician-auth-toggle');
  const label = document.getElementById('auth-status-text');
  const badge = document.getElementById('sso-badge-display');
  
  if (checkbox.checked) {
    authToken = 'MOCK_CLINICIAN_AUTH_TOKEN_SUCCESS';
    label.innerText = 'Clinician Active (SSO)';
    label.classList.add('auth-active');
    badge.innerHTML = `🔑 Mock Token: <span class="badge-code active">SSO_VERIFIED_JWT_2026</span>`;
    logToConsole('Clinician SSO verified. Cryptographic token generated.', 'security');
  } else {
    authToken = null;
    label.innerText = 'Clinician Offline';
    label.classList.remove('auth-active');
    badge.innerHTML = `🔑 Mock Token: <span class="badge-code">NONE</span>`;
    logToConsole('Clinician SSO logged out. Token revoked.', 'security');
    
    // If currently viewing secure, force lock it back to Tier 1 public view
    if (!document.getElementById('screen-tier2').classList.contains('hidden')) {
      lockSecureView();
    }
  }
}

// 2. Perform mock QR scan (call Express API)
async function simulateScan() {
  logToConsole(`Initiating Scan Request for ${currentTagId}...`, 'system');
  
  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tagId: currentTagId,
        nonce: currentNonce,
        authToken: authToken
      })
    });

    const data = await response.json();
    
    // Dump backend logs into debugger console
    if (data.debugLogs) {
      data.debugLogs.forEach(log => {
        let type = 'system';
        if (log.includes('[SECURITY]')) type = 'security';
        if (log.includes('[SECURITY ALERT]')) type = 'error';
        if (log.includes('[MCP SERVER]')) type = 'mcp';
        if (log.includes('[ERROR]')) type = 'error';
        logToConsole(log, type);
      });
    }

    if (!response.ok) {
      alert(`Scan Failed: ${data.error}`);
      return;
    }

    currentScenarioData = data;
    renderTier1View(data.publicTier);

    // Navigate Views based on Authentication state
    if (authToken === 'MOCK_CLINICIAN_AUTH_TOKEN_SUCCESS') {
      triggerFaceIDUnlock(data);
    } else {
      transitionScreen('screen-tier1');
    }

  } catch (err) {
    logToConsole(`Connection Failure: ${err.message}`, 'error');
    alert(`Could not connect to backend server. Make sure node server.js is running.`);
  }
}

// Render Public emergency view details
function renderTier1View(publicData) {
  document.getElementById('t1-tag-id').innerText = currentTagId.toUpperCase();
  document.getElementById('t1-condition-badge').innerText = publicData.conditionBadge;
  document.getElementById('t1-contact').innerText = publicData.emergencyContact;

  // Render First Aid Bullet Points
  const listContainer = document.getElementById('t1-first-aid-list');
  listContainer.innerHTML = '';
  publicData.firstAidSteps.forEach(step => {
    const li = document.createElement('li');
    li.innerText = step;
    listContainer.appendChild(li);
  });

  // Render ASL Communication Tiles
  const aslGrid = document.getElementById('t1-asl-grid');
  aslGrid.innerHTML = '';
  
  const aslMap = {
    "help": { emoji: "🤝", label: "Help" },
    "inhaler": { emoji: "💨", label: "Inhaler" },
    "breathe": { emoji: "🫁", label: "Breathe" },
    "deaf": { emoji: "🦻", label: "Deaf" },
    "pain": { emoji: "⚡", label: "Pain" },
    "hospital": { emoji: "🏥", label: "Hospital" },
    "doctor": { emoji: "🩺", label: "Doctor" }
  };

  publicData.aslTiles.forEach(tileKey => {
    const tileMeta = aslMap[tileKey] || { emoji: "💬", label: tileKey };
    const tileDiv = document.createElement('div');
    tileDiv.className = 'asl-tile';
    tileDiv.onclick = () => {
      openAslModal(tileKey, tileMeta.label);
    };
    
    tileDiv.innerHTML = `
      <span class="asl-tile-graphic">${tileMeta.emoji}</span>
      <span class="asl-tile-label">${tileMeta.label}</span>
    `;
    aslGrid.appendChild(tileDiv);
  });
}

// Attempt to open Secure Tier 2 from Public Tier 1 drawer
function attemptSecureUnlock() {
  if (authToken === 'MOCK_CLINICIAN_AUTH_TOKEN_SUCCESS') {
    simulateScan(); // Rescans with token to unlock Tier 2
  } else {
    logToConsole('[SECURITY SHIELD] Blocked unlock. Clinician key not present. SSO validation failed.', 'error');
    alert('Access Denied: Please toggle "Clinician SSO" to active on the left to simulate a secure card tap/SSO.');
  }
}

// Run Biometric scan animation before showing Tier 2
function triggerFaceIDUnlock(data) {
  transitionScreen('screen-faceid');
  const statusEl = document.getElementById('faceid-status');
  statusEl.innerText = "Checking clinician certificate...";

  setTimeout(() => {
    statusEl.innerText = "Unlocking medical records...";
    setTimeout(() => {
      renderTier2View(data.secureTier);
      transitionScreen('screen-tier2');
    }, 800);
  }, 1000);
}

// Render Secure EMR info
function renderTier2View(secureData) {
  document.getElementById('t2-patient-name').innerText = secureData.fullName;
  document.getElementById('t2-patient-dob').innerText = secureData.dob;
  document.getElementById('t2-patient-mrn').innerText = secureData.mrn;
  document.getElementById('t2-notes').innerText = secureData.clinicalNotes;

  // Render meds list
  const medsList = document.getElementById('t2-med-list');
  medsList.innerHTML = '';
  secureData.activeMedications.forEach(med => {
    const medCard = document.createElement('div');
    medCard.className = 'med-card';
    medCard.innerHTML = `
      <span class="med-name">${med.name}</span>
      <span class="med-frequency">${med.dose} (${med.frequency})</span>
    `;
    medsList.appendChild(medCard);
  });

  // Reset chat box
  const chatMessagesBox = document.getElementById('chat-messages-box');
  chatMessagesBox.innerHTML = `
    <div class="msg msg-agent">
      Hello. I am the EMR clinical agent. I have loaded ${secureData.fullName}'s secure records. You can ask me to perform drug-interaction checks, review recent lab data, or generate case summaries.
    </div>
  `;
}

// Lock secure view and drop back to Tier 1
function lockSecureView() {
  logToConsole('Locking secure portal. Cleared clinical tokens from memory.', 'security');
  transitionScreen('screen-tier1');
}

// Send user message to Decision Support Agent
async function sendChatMessage() {
  const inputEl = document.getElementById('chat-input-field');
  const text = inputEl.value.trim();
  if (!text) return;

  // Append user message
  appendMessage(text, 'user');
  inputEl.value = '';

  logToConsole(`Sending question to clinical agent: "${text}"`, 'system');
  
  // Show typing indicator
  const typingIndicatorId = appendTypingIndicator();

  try {
    const response = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tagId: currentTagId,
        message: text,
        authToken: authToken
      })
    });

    const data = await response.json();
    
    // Remove typing indicator
    removeTypingIndicator(typingIndicatorId);

    // Dump backend logs
    if (data.debugLogs) {
      data.debugLogs.forEach(log => {
        let type = 'system';
        if (log.includes('[SECURITY]')) type = 'security';
        if (log.includes('[AGENT REASONING]')) type = 'agent';
        if (log.includes('[MCP SERVER]')) type = 'mcp';
        if (log.includes('[GEMINI API]')) type = 'system';
        if (log.includes('[ERROR]')) type = 'error';
        logToConsole(log, type);
      });
    }

    if (!response.ok) {
      appendMessage(`Error: ${data.error || 'Server error'}`, 'agent');
      return;
    }

    appendMessage(data.response, 'agent');

  } catch (err) {
    removeTypingIndicator(typingIndicatorId);
    logToConsole(`Chat connection failed: ${err.message}`, 'error');
    appendMessage("Failed to reach agent backend.", "agent");
  }
}

// Helper to append message in phone chat interface
function appendMessage(text, sender) {
  const box = document.getElementById('chat-messages-box');
  const msg = document.createElement('div');
  msg.className = `msg msg-${sender}`;
  msg.innerText = text;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

// Suggestions tags helper
function useSuggestion(text) {
  document.getElementById('chat-input-field').value = text;
  sendChatMessage();
}

function handleChatKey(event) {
  if (event.key === 'Enter') {
    sendChatMessage();
  }
}

// Utility: Switch virtual screen states
function transitionScreen(screenId) {
  document.querySelectorAll('.screen-state').forEach(screen => {
    screen.classList.add('hidden');
  });
  document.getElementById(screenId).classList.remove('hidden');
}

// Reset entire simulator
function resetSimulator() {
  transitionScreen('screen-waiting');
  currentScenarioData = null;
  logToConsole('Simulator state reset. Virtual screen set to waiting.', 'system');
}

// --- Typing Indicator Helpers ---
function appendTypingIndicator() {
  const box = document.getElementById('chat-messages-box');
  const indicator = document.createElement('div');
  const id = `typing-${Date.now()}`;
  indicator.id = id;
  indicator.className = 'msg msg-agent typing-indicator-container';
  
  indicator.innerHTML = `
    <div class="typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  
  box.appendChild(indicator);
  box.scrollTop = box.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const indicator = document.getElementById(id);
  if (indicator) indicator.remove();
}

// --- Interactive ASL Sign Modal Helpers ---
const aslGraphics = {
  help: {
    svg: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 70 h60 M50 25 v45 M40 35 l10-10 l10 10" />
            <circle cx="50" cy="50" r="30" stroke-dasharray="4 4" />
          </svg>`,
    desc: "Extend your non-dominant hand flat, palm facing up. Place your closed dominant hand (thumbs-up) on top and lift both hands upward together."
  },
  inhaler: {
    svg: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="35" y="20" width="30" height="50" rx="4" />
            <path d="M40 70 v10 h20 v-10" />
            <circle cx="50" cy="35" r="5" fill="currentColor" />
            <path d="M65 35 h15 M70 30 l10 5 l-10 5" stroke-width="2" />
          </svg>`,
    desc: "Hold a mock cylindrical object in front of your mouth with your thumb under the base and index finger on top. Depress your finger twice to simulate spray."
  },
  breathe: {
    svg: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M30 35 c10-10, 30-10, 40 0 M30 65 c10 10, 30 10, 40 0" />
            <path d="M50 20 v60 M40 55 l10 10 l10-10 M60 45 l-10-10 l-10 10" />
          </svg>`,
    desc: "Place both hands flat against your chest. Move them outwards and back inwards in a smooth wave-like rhythm to simulate lung expansion and contraction."
  },
  deaf: {
    svg: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M30 40 c0-10, 20-10, 20 0 v20 c0 10-20 10-20 0 Z" />
            <path d="M50 50 h25 M75 40 v20" />
            <circle cx="75" cy="30" r="4" fill="currentColor" />
          </svg>`,
    desc: "Touch your index finger to your jawline near your ear, then move the finger in a small arc to touch the side of your mouth/chin."
  },
  pain: {
    svg: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 50 l20-20 l15 30 l15-30 l20 20" />
            <path d="M35 50 l10-10 M55 50 l10-10" />
          </svg>`,
    desc: "Form index-finger points with both hands. Bring them near each other in front of the chest, and twist/thrust them twice in opposite directions."
  },
  hospital: {
    svg: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <rect x="25" y="25" width="50" height="50" rx="8" />
            <path d="M50 35 v30 M35 50 h30" stroke-width="6" />
          </svg>`,
    desc: "Using the index and middle finger of your dominant hand, trace a small cross (vertical then horizontal stroke) on your non-dominant shoulder arm."
  },
  doctor: {
    svg: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 65 h50 M30 65 v-15 h20 v15" />
            <path d="M60 40 c0-5, 5-10, 10-10 s10 5, 10 10 v25" />
            <path d="M60 65 h25" />
          </svg>`,
    desc: "Hold out your non-dominant wrist flat, palm facing up. Tap the fingers of your dominant hand twice against the inner pulse region of your wrist."
  }
};

function openAslModal(tileKey, label) {
  const modal = document.getElementById('asl-modal');
  const title = document.getElementById('asl-modal-title');
  const graphic = document.getElementById('asl-sign-graphic');
  const desc = document.getElementById('asl-modal-desc');
  
  if (!modal) return;
  
  logToConsole(`ASL Visualizer Opened: "${label.toUpperCase()}"`, 'system');
  
  const signData = aslGraphics[tileKey] || {
    svg: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4"><circle cx="50" cy="50" r="25"/></svg>`,
    desc: `ASL instruction for: "${label}".`
  };
  
  title.innerText = `Sign Guide: ${label.toUpperCase()}`;
  graphic.innerHTML = signData.svg;
  desc.innerText = signData.desc;
  
  modal.classList.remove('hidden');
}

function closeAslModal() {
  const modal = document.getElementById('asl-modal');
  if (modal) modal.classList.add('hidden');
}

function closeAslModalOnOutsideClick(event) {
  const modal = document.getElementById('asl-modal');
  // Check if click was exactly on the modal backdrop overlay (not on modal content)
  if (event.target === modal) {
    closeAslModal();
  }
}
