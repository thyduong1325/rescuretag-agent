// --- Global State ---
let currentTagId = 'tag_asthma_001';
let currentNonce = 'xyz123';
let authToken = null;
let currentScenarioData = null;
let currentLanguage = 'en';
let lastActiveScreen = 'screen-waiting';
let videoStream = null;
let scanningActive = false;
let arVideoStream = null;


// Native Web Audio Synthesizer chimes
function playSound(type) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'scan') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.08, now);
      osc.start(now);
      osc.frequency.setValueAtTime(1320, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.stop(now + 0.2);
    } else if (type === 'success') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      gain.gain.setValueAtTime(0.12, now);
      osc.start(now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);
      osc.frequency.setValueAtTime(1046.50, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc.stop(now + 0.45);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.12, now);
      osc.start(now);
      osc.frequency.setValueAtTime(130, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.stop(now + 0.25);
    }
  } catch (err) {
    console.warn('AudioContext failed:', err);
  }
}

// Initialize app on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  logToConsole('RescureTag sandbox initialized. Ready for scan event.', 'system');
  logToConsole('Express router listening at port 3000.', 'system');

  // Check URL query parameters to auto-trigger scan (physical tag scans)
  const urlParams = new URLSearchParams(window.location.search);
  const urlTagId = urlParams.get('tagId');
  const urlNonce = urlParams.get('nonce');
  if (urlTagId && urlNonce) {
    currentTagId = urlTagId;
    currentNonce = urlNonce;
    
    // Auto-select card on Left panel if it exists
    const scenarioBtn = document.getElementById(`scen-${urlTagId}`);
    if (scenarioBtn) {
      document.querySelectorAll('.scenario-card').forEach(card => card.classList.remove('active'));
      scenarioBtn.classList.add('active');
    }
    
    logToConsole(`🚨 Physical QR scan detected via URL parameters! Loading ${urlTagId}...`, 'security');
    // Start scan automatically
    simulateScan();
  }
});

// Write line into Debugger Console
function logToConsole(message, type = 'system') {
  const container = document.getElementById('console-logs-container');
  const timestamp = new Date().toLocaleTimeString();

  if (container) {
    const line = document.createElement('div');
    line.className = `console-line ${type}-line`;
    line.innerText = `[${timestamp}] ${message}`;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  }

  // Duplicate to phone overlay logs for focus mode
  const overlayLogs = document.getElementById('phone-agent-overlay-logs');
  if (overlayLogs) {
    const line = document.createElement('div');
    line.className = `overlay-log-line ${type}-line`;
    line.innerText = `[${timestamp}] ${message}`;
    overlayLogs.appendChild(line);
    overlayLogs.scrollTop = overlayLogs.scrollHeight;
  }
}

// Clear Debugger Console
function clearConsole() {
  const container = document.getElementById('console-logs-container');
  if (container) container.innerHTML = '';
  const overlayLogs = document.getElementById('phone-agent-overlay-logs');
  if (overlayLogs) overlayLogs.innerHTML = '';
}

// 1. Select cuff tag scenario
function selectScenario(tagId, nonce) {
  currentTagId = tagId;
  currentNonce = nonce;
  currentLanguage = 'en';
  
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
  playSound('scan');
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
    playSound('error');
    logToConsole('[SECURITY SHIELD] Blocked unlock. Clinician key not present. SSO validation failed.', 'error');
    alert('Access Denied: Please toggle "Clinician SSO" to active on the left to simulate a secure card tap/SSO.');
  }
}

// Run Biometric scan animation before showing Tier 2
function triggerFaceIDUnlock(data) {
  transitionScreen('screen-faceid');
  playSound('success');
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

  // AI Agent Proactive Briefing Evaluation
  const briefingEl = document.getElementById('t2-agent-briefing');
  if (briefingEl) {
    let briefText = '';
    if (currentTagId === 'tag_asthma_001') {
      briefText = `🛡️ <strong>Clinical Dispatch Agent Synced</strong> | <em>Ethan Carter</em> (21yo CS Student)<br>
      • <strong>EMR Meds Checked:</strong> Albuterol & Flovent. No conflicting active drugs.<br>
      • <strong>Proactive Check:</strong> Asthmatic history flags respiratory distress risk. Advise checking for inhaler availability.<br>
      • <strong>Clinician Action:</strong> Oxygen saturations check indicated. If cold-air or exercise-induced, provide warmth.`;
    } else if (currentTagId === 'tag_stroke_002') {
      briefText = `🛡️ <strong>Clinical Dispatch Agent Synced</strong> | <em>Robert Cooper</em> (52yo Immigrant)<br>
      • <strong>EMR Meds Checked:</strong> Eliquis (Apixaban). <strong style="color:#f87171;">CRITICAL BLEEDING CONTRAINDICATION</strong> active.<br>
      • <strong>Drug Safety warning:</strong> STRICTLY AVOID NSAIDs (Aspirin, Advil, Ibuprofen). Risk of fatal haemorrhage.<br>
      • <strong>Accessibility Assist:</strong> Patient is DEAF. Use interactive ASL pain assessment tiles below for triage.`;
    } else if (currentTagId === 'tag_bleeding_003') {
      briefText = `🛡️ <strong>Clinical Dispatch Agent Synced</strong> | <em>John R. Doe</em> (29yo Adventurer)<br>
      • <strong>EMR Meds Checked:</strong> Factor VIII Infusion kit. <strong style="color:#f87171;">CRITICAL HEMOPHILIA A WARNING</strong> active.<br>
      • <strong>Drug Safety warning:</strong> STRICTLY AVOID Aspirin/Ibuprofen. Increases bleed times.<br>
      • <strong>Clinician Action:</strong> Apply firm, continuous pressure to wound for >15 minutes. Infusion kit in backpack.`;
    } else {
      briefText = `🛡️ <strong>EMR Agent Briefing Active</strong> | Records Synced. Ready for drug safety queries.`;
    }
    briefingEl.innerHTML = briefText;
  }

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

    // Auto-trigger HITL card for prescription or critical clinical instructions
    const lowerText = text.toLowerCase();
    if (lowerText.includes('aspirin') || lowerText.includes('advil') || lowerText.includes('propranolol') || lowerText.includes('med') || lowerText.includes('summarize')) {
      setTimeout(appendHITLApprovalBlock, 400);
    }

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
  
  // Format simple markdown-like bold text and linebreaks for display
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
    
  msg.innerHTML = html;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

// --- Human-In-The-Loop (HITL) E-Sign Approval Gate ---
function appendHITLApprovalBlock() {
  const box = document.getElementById('chat-messages-box');
  const card = document.createElement('div');
  card.className = 'hitl-approval-card font-outfit';
  const approvalId = `hitl-check-${Date.now()}`;
  
  card.innerHTML = `
    <div class="hitl-header">
      <span class="hitl-icon">⚖️</span>
      <span class="hitl-title">Physician E-Sign Approval Required</span>
    </div>
    <p class="hitl-desc">Confirm you have verified the agent's contraindication checks and wish to commit this consultation log to the EMR database.</p>
    <div class="hitl-action-row">
      <label class="hitl-checkbox-label">
        <input type="checkbox" id="${approvalId}" onchange="signAgentGuidance('${approvalId}')">
        <span class="hitl-checkbox-text">E-Sign & Log Recommendations</span>
      </label>
    </div>
  `;
  
  box.appendChild(card);
  box.scrollTop = box.scrollHeight;
}

function signAgentGuidance(checkboxId) {
  const checkbox = document.getElementById(checkboxId);
  const card = checkbox.closest('.hitl-approval-card');
  
  if (checkbox.checked) {
    checkbox.disabled = true;
    card.classList.add('approved');
    playSound('success');
    logToConsole('[SECURITY] HITL SIGNATURE CONFIRMED. Physician e-signed agent recommendations. Audit logged to EMR.', 'security');
    
    // Insert confirmation bubble in chat
    const box = document.getElementById('chat-messages-box');
    const msg = document.createElement('div');
    msg.className = 'msg msg-system-alert';
    msg.innerHTML = `✍️ <strong>EMR Transaction Confirmed:</strong> Guidance logged under signature ID <code>SEC-${Date.now().toString().slice(-6)}</code>.`;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
  }
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
  if (screenId !== 'screen-faceid' && screenId !== 'screen-arcam') {
    lastActiveScreen = screenId;
  }
}

// Reset entire simulator
function resetSimulator() {
  stopCameraScanner();
  stopARCameraStream();
  transitionScreen('screen-waiting');

  currentScenarioData = null;
  currentLanguage = 'en';
  
  // Reset active language selectors
  document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
  const enBtn = document.getElementById('lang-btn-en');
  if (enBtn) enBtn.classList.add('active');

  // Reset tab navigation active state
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const scanTab = document.getElementById('tab-btn-scan');
  if (scanTab) scanTab.classList.add('active');

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

// --- Dynamic Multilingual Translation Maps ---
const translationMaps = {
  tag_asthma_001: {
    en: {
      condition: "Severe Asthma",
      contact: "Mother: (555) 019-2834 (English/Spanish)",
      steps: [
        "Locate rescue inhaler (Albuterol) in backpack front pocket.",
        "Assist patient in sitting upright and taking 2 puffs.",
        "Call 911 if breathing doesn't improve within 5 minutes."
      ]
    },
    es: {
      condition: "Asma Grave",
      contact: "Madre: (555) 019-2834 (Inglés/Español)",
      steps: [
        "Busque el inhalador de rescate (Albuterol) en el bolsillo delantero de la mochila.",
        "Ayude al paciente a sentarse erguido y a inhalar 2 dosis.",
        "Llame al 911 si la respiración no mejora en 5 minutos."
      ]
    },
    vi: {
      condition: "Hen suyễn Nặng",
      contact: "Mẹ: (555) 019-2834 (Tiếng Anh/Tây Ban Nha)",
      steps: [
        "Tìm bình xịt cắt cơn (Albuterol) ở ngăn trước ba lô.",
        "Đỡ bệnh nhân ngồi thẳng dậy và xịt 2 nhát.",
        "Gọi 115 nếu thở không cải thiện sau 5 phút."
      ]
    }
  },
  tag_stroke_002: {
    en: {
      condition: "Deaf / Prior Stroke History",
      contact: "Spouse: (555) 014-9988 (Text Only)",
      steps: [
        "Patient is DEAF. Please use clear gestures or write notes on paper/phone.",
        "Check for FAST stroke signs (Face drooping, Arm weakness, Speech difficulty).",
        "If signs are present, write '911' on a paper and call immediately."
      ]
    },
    es: {
      condition: "Sordo / Historial de Accidente Cerebrovascular",
      contact: "Cónyuge: (555) 014-9988 (Solo Mensajes)",
      steps: [
        "El paciente es SORDO. Use gestos claros o escriba notas en el teléfono/papel.",
        "Examine los signos de FAST (rostro caído, debilidad en brazos, dificultad para hablar).",
        "Si detecta signos, escriba '911' en un papel y llame de inmediato."
      ]
    },
    vi: {
      condition: "Bị Điếc / Tiền sử Đột quỵ",
      contact: "Vợ/Chồng: (555) 014-9988 (Chỉ Nhắn tin)",
      steps: [
        "Bệnh nhân bị ĐIẾC. Vui lòng dùng cử chỉ rõ ràng hoặc viết giấy/điện thoại.",
        "Kiểm tra dấu hiệu đột quỵ FAST (Méo mặt, yếu tay, khó nói).",
        "Nếu có dấu hiệu, ghi chữ '911' (hoặc 115) lên giấy và gọi ngay lập tức."
      ]
    }
  },
  tag_bleeding_003: {
    en: {
      condition: "Hemophilia A (Severe)",
      contact: "Hematology Clinic: (555) 887-2190",
      steps: [
        "Apply firm, continuous pressure to any bleeding site for at least 15 minutes.",
        "DO NOT give aspirin or ibuprofen (causes increased bleeding).",
        "Patient has factor VIII infusion kit in outdoor pack; assist if trained."
      ]
    },
    es: {
      condition: "Hemofilia A (Grave)",
      contact: "Clínica Hematológica: (555) 887-2190",
      steps: [
        "Aplique presión firme y continua en cualquier zona de sangrado durante 15 minutos.",
        "NO administre aspirina ni ibuprofeno (agravan el sangrado).",
        "El paciente lleva un kit de infusión de Factor VIII en su mochila; ayude si sabe."
      ]
    },
    vi: {
      condition: "Ưa chảy máu Hemophilia A (Nặng)",
      contact: "Phòng khám Huyết học: (555) 887-2190",
      steps: [
        "Đè ép chặt và liên tục lên chỗ chảy máu trong ít nhất 15 phút.",
        "KHÔNG ĐƯỢC cho dùng aspirin hoặc ibuprofen (làm tăng chảy máu).",
        "Bệnh nhân có bộ truyền yếu tố VIII trong ba lô ngoại cảnh; hỗ trợ nếu đã tập huấn."
      ]
    }
  }
};

function changeLanguage(lang) {
  currentLanguage = lang;
  logToConsole(`Language changed: ${lang.toUpperCase()}`, 'system');
  playSound('scan');

  // Toggle active styling on language buttons
  document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
  
  const scanBtn = document.getElementById(`lang-btn-${lang}`);
  if (scanBtn) scanBtn.classList.add('active');
  
  const arBtn = document.getElementById(`lang-btn-ar-${lang}`);
  if (arBtn) arBtn.classList.add('active');

  // If a scenario is scanned, translate public DOM elements
  if (currentScenarioData) {
    const content = translationMaps[currentTagId][lang];
    if (content) {
      document.getElementById('t1-condition-badge').innerText = content.condition;
      document.getElementById('t1-contact').innerText = content.contact;

      const listContainer = document.getElementById('t1-first-aid-list');
      listContainer.innerHTML = '';
      content.steps.forEach(step => {
        const li = document.createElement('li');
        li.innerText = step;
        listContainer.appendChild(li);
      });
    }
  }
}

// --- Phone Navigation Tabs ---
function switchPhoneTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  
  if (tab === 'scan') {
    document.getElementById('tab-btn-scan').classList.add('active');
    logToConsole('Phone view switched to Tag Scanner.', 'system');
    stopARCameraStream();
    transitionScreen(lastActiveScreen);
  } else if (tab === 'camera') {
    document.getElementById('tab-btn-camera').classList.add('active');
    logToConsole('Phone view switched to Live AR Triage Cam.', 'system');
    startARCameraStream();
    transitionScreen('screen-arcam');
  }
}

// --- AR Camera Scenario Simulation ---
function triggerARScenario(type) {
  playSound('scan');
  
  const speakerEl = document.getElementById('arcam-speaker');
  const subsEl = document.getElementById('arcam-subtitles');
  const transEl = document.getElementById('arcam-translation');

  const arScenarios = {
    tag_asthma_001: {
      speech: {
        speaker: "🧑‍⚕️ CLINICIAN (ENGLISH)",
        subs: '"I am administering Albuterol now. Sit up straight and try to take slow, deep breaths."',
        trans: {
          vi: '"Tôi đang cho dùng thuốc xịt Albuterol. Hãy ngồi thẳng dậy và cố gắng thở chậm, sâu."',
          es: '"Estoy administrando Albuterol ahora. Siéntese derecho e intente respirar lento y profundo."',
          en: '"I am administering Albuterol now. Sit up straight and try to take slow, deep breaths."'
        }
      },
      sign: {
        speaker: "🦻 PATIENT SIGN POSE (ASL)",
        subs: 'Signs: [CANT BREATHE] -> [CHEST] -> [TIGHT]',
        trans: {
          vi: '"Bản dịch ngôn ngữ ký hiệu: [KHÔNG THỂ THỞ] -> [NGỰC] -> [TỨC]" (Tôi không thể thở được, ngực tôi rất tức.)',
          es: '"Traducción de Señas: [NO PUEDO RESPIRAR] -> [PECHO] -> [APRETADO]" (No puedo respirar, mi pecho está muy apretado.)',
          en: '"ASL Translation: [CAN\'T BREATHE] -> [CHEST] -> [TIGHT]" (I cannot breathe, my chest is very tight.)'
        }
      }
    },
    tag_stroke_002: {
      speech: {
        speaker: "🧑‍⚕️ CLINICIAN (ENGLISH)",
        subs: '"Robert, we are preparing an IV. Can you squeeze my hand if you feel this?"',
        trans: {
          vi: '"Robert, chúng tôi đang chuẩn bị truyền dịch. Chú có thể bóp tay cháu nếu cảm thấy thế này không?"',
          es: '"Robert, estamos preparando una vía intravenosa. ¿Puede apretar mi mano si siente esto?"',
          en: '"Robert, we are preparing an IV. Can you squeeze my hand if you feel this?"'
        }
      },
      sign: {
        speaker: "🦻 PATIENT SIGN POSE (ASL)",
        subs: 'Signs: [HEADACHE] -> [NUMB] -> [LEFT ARM]',
        trans: {
          vi: '"Bản dịch ngôn ngữ ký hiệu: [ĐAU ĐẦU] -> [TÊ LỆT] -> [TAY TRÁI]" (Tôi bị đau đầu dữ dội và cánh tay trái của tôi bị tê.)',
          es: '"Traducción de Señas: [DOLOR DE CABEZA] -> [ENTUMECIDO] -> [BRAZO IZQUIERDO]" (Tengo un fuerte dolor de cabeza y mi brazo izquierdo está entumecido.)',
          en: '"ASL Translation: [HEADACHE] -> [NUMB] -> [LEFT ARM]" (I have a severe headache and my left arm is numb.)'
        }
      }
    },
    tag_bleeding_003: {
      speech: {
        speaker: "🧑‍⚕️ CLINICIAN (ENGLISH)",
        subs: '"Applying firm pressure to your wound. We have Factor VIII ready to infuse."',
        trans: {
          vi: '"Đang ép chặt vết thương của bạn. Chúng tôi đã có sẵn Yếu tố VIII để truyền."',
          es: '"Aplicando presión firme en su herida. Tenemos listo el Factor VIII para infundir."',
          en: '"Applying firm pressure to your wound. We have Factor VIII ready to infuse."'
        }
      },
      sign: {
        speaker: "🦻 PATIENT SIGN POSE (ASL)",
        subs: 'Signs: [BLEEDING] -> [FALL] -> [PAIN]',
        trans: {
          vi: '"Bản dịch ngôn ngữ ký hiệu: [CHẢY MÁU] -> [NGÃ] -> [ĐAU]" (Tôi bị ngã và đang chảy máu, tôi rất đau.)',
          es: '"Traducción de Señas: [SANGRANDO] -> [CAÍDA] -> [DOLOR]" (Me caí y estoy sangrando, tengo mucho dolor.)',
          en: '"ASL Translation: [BLEEDING] -> [FALL] -> [PAIN]" (I fell down and I am bleeding, I have a lot of pain.)'
        }
      }
    }
  };

  const scenarioKey = arScenarios[currentTagId] ? currentTagId : 'tag_asthma_001';
  const data = arScenarios[scenarioKey][type];

  if (data) {
    logToConsole(`AR Triage Sync triggered: ${type.toUpperCase()} scenario.`, 'system');
    speakerEl.innerText = data.speaker;
    subsEl.innerText = data.subs;
    
    // Choose translation overlay based on active language
    const transText = data.trans[currentLanguage] || data.trans['en'];
    transEl.innerText = transText;
  }
}

// --- Focus Phone Only Mode ---
function toggleFocusMode() {
  document.body.classList.toggle('focus-phone');
  const btn = document.getElementById('focus-toggle');
  if (document.body.classList.contains('focus-phone')) {
    btn.innerText = '💻 Show Web Dashboard';
    logToConsole('Focus Phone Only Mode active. Hiding desktop controls.', 'security');
  } else {
    btn.innerText = '📱 Focus Phone Mode';
    logToConsole('Desktop Web Dashboard visible.', 'system');
  }
}

// --- Phone Agent Reasoning Overlay ---
function togglePhoneAgentOverlay() {
  const panel = document.getElementById('phone-agent-overlay-panel');
  if (panel) {
    panel.classList.toggle('hidden');
    playSound('scan');
  }
}

// --- Laptop Camera QR Scanner ---
async function startCameraScanner() {
  const video = document.getElementById('scanner-video');
  const placeholder = document.getElementById('mock-qr-placeholder');
  const startBtn = document.getElementById('start-webcam-btn');
  const stopBtn = document.getElementById('stop-webcam-btn');
  const title = document.getElementById('scan-status-title');
  const desc = document.getElementById('scan-status-desc');

  logToConsole('Initiating laptop camera webcam stream...', 'system');
  if (title) title.innerText = 'Requesting Camera...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "environment", width: { ideal: 300 }, height: { ideal: 300 } } 
    });
    
    videoStream = stream;
    if (video) {
      video.srcObject = stream;
      video.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    
    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'block';
    
    if (title) title.innerText = 'Align QR Code';
    if (desc) desc.innerText = 'Hold the printed QR code sheet up to your laptop camera.';
    
    scanningActive = true;
    requestAnimationFrame(tickScan);
    logToConsole('Webcam stream active. Scanning for printed RescureTag QR nonces...', 'security');
  } catch (err) {
    logToConsole(`Camera access denied or unavailable: ${err.message}`, 'error');
    if (title) title.innerText = 'Camera Error';
    if (desc) desc.innerText = 'Could not access webcam. Make sure permissions are granted, or select a scenario card on the left.';
    if (startBtn) startBtn.style.display = 'block';
    if (stopBtn) stopBtn.style.display = 'none';
  }
}

function stopCameraScanner() {
  scanningActive = false;
  
  const video = document.getElementById('scanner-video');
  const placeholder = document.getElementById('mock-qr-placeholder');
  const startBtn = document.getElementById('start-webcam-btn');
  const stopBtn = document.getElementById('stop-webcam-btn');
  const title = document.getElementById('scan-status-title');
  const desc = document.getElementById('scan-status-desc');

  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }

  if (video) {
    video.srcObject = null;
    video.style.display = 'none';
  }
  
  if (placeholder) placeholder.style.display = 'grid';
  
  if (startBtn) startBtn.style.display = 'block';
  if (stopBtn) stopBtn.style.display = 'none';
  
  if (title) title.innerText = 'Ready to Scan';
  if (desc) desc.innerText = 'Print the physical QR codes and hold them up to your laptop camera, or select a scenario on the left.';
  logToConsole('Webcam stream stopped.', 'system');
}

function tickScan() {
  if (!scanningActive) return;

  if (typeof jsQR === 'undefined') {
    logToConsole('[ERROR] jsQR scan engine is not loaded yet. Make sure your laptop has internet access to retrieve the library from the CDN.', 'error');
    stopCameraScanner();
    alert('QR Decoder engine is not loaded. Ensure your laptop is connected to the internet, or click the "mock scan" bypass link.');
    return;
  }

  const video = document.getElementById('scanner-video');
  const canvas = document.getElementById('scanner-canvas');

  if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code) {
      logToConsole(`QR Code parsed: ${code.data}`, 'security');
      try {
        const url = new URL(code.data);
        const tagId = url.searchParams.get('tagId');
        const nonce = url.searchParams.get('nonce');
        
        if (tagId && nonce) {
          logToConsole(`Valid RescureTag QR detected! [Tag: ${tagId.toUpperCase()}, Nonce: ${nonce}]`, 'security');
          
          // Switch global state parameters
          currentTagId = tagId;
          currentNonce = nonce;
          
          // Synchronize scenario card selection on the left
          const scenarioBtn = document.getElementById(`scen-${tagId}`);
          if (scenarioBtn) {
            document.querySelectorAll('.scenario-card').forEach(card => card.classList.remove('active'));
            scenarioBtn.classList.add('active');
          }
          
          stopCameraScanner();
          simulateScan();
          return; // Stop scan loop
        } else {
          logToConsole('Scanned QR code does not contain RescureTag parameters.', 'error');
        }
      } catch (e) {
        logToConsole(`Scanned non-URL text: "${code.data}"`, 'error');
      }
    }
  }

  requestAnimationFrame(tickScan);
}

// --- AR Camera Stream ---
async function startARCameraStream() {
  if (arVideoStream) return;
  
  const video = document.getElementById('ar-video');
  logToConsole('Initiating AR Triage live webcam stream...', 'system');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: "environment" } 
    });
    
    arVideoStream = stream;
    if (video) {
      video.srcObject = stream;
    }
    logToConsole('AR webcam feed active behind HUD.', 'security');
  } catch (err) {
    logToConsole(`AR webcam feed failed: ${err.message}`, 'error');
  }
}

function stopARCameraStream() {
  const video = document.getElementById('ar-video');
  if (arVideoStream) {
    arVideoStream.getTracks().forEach(track => track.stop());
    arVideoStream = null;
  }
  if (video) {
    video.srcObject = null;
  }
  logToConsole('AR webcam feed stopped.', 'system');
}


