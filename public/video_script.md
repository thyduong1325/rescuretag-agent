# RescureTag™ Video Demo Script (5-Minute Walkthrough)

This script is structured to hit all Kaggle Capstone AI Agent scoring criteria (Problem Statement, Multi-Agent Architecture, MCP tool calls, Security Guards, and Human-in-the-Loop design).

---

## ⏱️ Timeline Summary
- **0:00 - 0:45:** Section 1: Hook & Problem Statement
- **0:45 - 1:30:** Section 2: AI Agent & MCP Architecture
- **1:30 - 2:30:** Section 3: Live Scan & AR Triage HUD (Webcam scan demo)
- **2:30 - 3:30:** Section 4: SSO Auth & Proactive Agent Briefing
- **3:30 - 4:30:** Section 5: ReAct Reasoning & Physician E-Sign (HITL)
- **4:30 - 5:00:** Section 6: Wrap-up & GitHub Sync

---

## 🎙️ Spoken Script & Screen Actions

### Section 1: The Hook & The Problem Statement
**Timing:** 0:00 - 0:45  
**Screen Action:** Open `http://localhost:3000` in your browser. Click **📱 Focus Phone Mode** in the top-right corner to center the smartphone mockup. Keep the printed QR sheet ready in your hands.

> **[SPOKEN VOICE]**  
> *"Hi everyone, I'm Uyen Thy Duong, and today I'm excited to present **RescureTag**—our capstone project for the Kaggle AI Agents capstone hackathon.
> 
> In medical emergencies, every second counts. However, first responders and clinicians face a major triple threat: first, communication barriers—especially for Deaf or limited-English patients during triage; second, cognitive delays while clinicians navigate complex EMR records to find crucial histories; and third, privacy concerns—we cannot simply print sensitive medical details on a public tag.
> 
> RescureTag solves this by linking a discreet, inside-cuff QR tag printed on activewear with a secure, two-tier AI agent system. Let's see how we built it."*

---

### Section 2: AI Agent & MCP Architecture
**Timing:** 0:45 - 1:30  
**Screen Action:** Click **Show Web Dashboard** to temporarily reveal the left dashboard. Point your cursor to the tech badges on the left (*ADK Multi-Agent, Custom EMR MCP, PII Scrubbing, Signed Links*).

> **[SPOKEN VOICE]**  
> *"Before we scan the physical tag, let's talk about the AI engine. We implemented four key course concepts:
> 
> First, **Multi-Agent Collaboration**, splitting roles between an *Emergency Dispatcher Agent* on public views and a secure *EMR Clinical Syncer Agent* on clinical views.
> 
> Second, a **Custom MCP Server** that exposes JSON-RPC tools to safely retrieve records and audit drug data.
> 
> Third, **Advanced Security Guards**, validating scans using rotating signed nonces, and running a local **PII Redaction Guard** that scrubs patient names and birthdates before sending prompts to the Gemini API, restoring them locally.
> 
> And fourth, **Human-in-the-Loop Alignment**, ensuring AI recommendations are verified by a physician before logging them to the EMR database."*

---

### Section 3: Live Scan & AR Triage HUD
**Timing:** 1:30 - 2:30  
**Screen Action:** Click **Focus Phone Mode** again. Inside the phone mockup, click **📷 Start Scanner Cam**. Hold your printed QR code (or tablet screen) up to your laptop camera. Once the scan beep chimes and Robert Cooper's profile loads, show the ASL tiles, then click the **AR Triage** tab. Click **ASL Pose Sync**.

> **[SPOKEN VOICE]**  
> *"Now, let's run a live physical scan. I'll click **Start Scanner Cam** on our phone simulator and hold up Robert Cooper's printed QR tag to my laptop webcam.
> 
> [Webcam parses QR ➔ Beep sound plays ➔ Bystander screen loads]
> 
> The camera immediately parses the tag, matches the nonce, and opens **Tier 1: Public Emergency View**. Because Robert is Deaf, a bystander can immediately see his warning badge and click these interactive ASL guide tiles to see signed phrase graphics.
> 
> Let's switch to the **AR Triage** tab. The phone HUD overlays real-time camera frames with computer vision tracking boundaries. If I click **ASL Pose Sync**, the simulated vision agent translates Robert's signs in real-time, displaying: 'Signs: Pain in left knee, bleeding risk' and translating them on the fly."*

---

### Section 4: SSO Auth & Proactive Agent Briefing
**Timing:** 2:30 - 3:30  
**Screen Action:** Switch back to the **Tag Scan** tab. Click **Request Secure Unlock** to show it fails. Toggle the **Clinician SSO** on the left dashboard to active, click unlock again. Watch the FaceID sweep animation, then scroll to show the **Proactive Agent Assessment** at the top of the secure view.

> **[SPOKEN VOICE]**  
> *"When a paramedic arrives, they authenticate. Clicking secure unlock without credentials fails, as our security guard blocks unauthorized requests.
> 
> But if we toggle our mock Clinician SSO badge to generate a token, FaceID sweeps our ID, validates the signature, and opens **Tier 2: Secure EMR View**.
> 
> Notice the top of the secure screen. Instead of raw database dumps, the EMR Clinical Agent instantly delivers a **Proactive Agent Assessment**. It has parsed Robert's EMR history, flagged that he takes Eliquis—a strong blood thinner—and highlighted a critical warning against NSAID administration."*

---

### Section 5: ReAct Reasoning & Physician E-Sign (HITL)
**Timing:** 3:30 - 4:30  
**Screen Action:** In the chat input, type: *"Is it safe to give Robert Aspirin?"* and send. When the warning loads, click the floating **🤖** button on the phone to slide open the Mind Stream overlay. Then scroll down in the chat and check the **E-Sign checkbox**. Watch the card turn green and the transaction log append.

> **[SPOKEN VOICE]**  
> *"We can chat with the clinical assistant directly. Let's ask: 'Is it safe to give Robert Aspirin?'
> 
> The agent outputs a critical warning. To verify how the agent reasoned, we can click this floating **Agent Mind Stream** button. Here, you see a full **ReAct reasoning loop** logged in real-time: the agent formulated a Thought, triggered the EMR tool to check active meds, observed the critical bleeding conflict, and redacted Robert's PII locally before sending the prompt to the LLM.
> 
> Crucially, the agent appends a **Physician E-Sign Approval Card** in the chat. As the doctor, I review the agent's calculations, check the box, and commit the signed audit trail to the EMR database."*

---

### Section 6: Wrap-up & GitHub Sync
**Timing:** 4:30 - 5:00  
**Screen Action:** Toggle Focus Mode off. Show the GitHub repository main page.

> **[SPOKEN VOICE]**  
> *"By combining physical QR tags, custom EMR MCP tools, outbound PII redaction, and interactive Human-in-the-Loop gates, RescureTag demonstrates how secure AI agents can save lives at the bedside.
> 
> The entire codebase is fully open-sourced on GitHub. Thank you for watching, and let me know if you have any questions!"*
