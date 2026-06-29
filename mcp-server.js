const fs = require('fs');
const path = require('path');

class EMRMcpServer {
  constructor() {
    this.dbPath = path.join(__dirname, 'db.json');
  }

  // Load database content dynamically to support real-time updates
  _loadDb() {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading Mock EMR DB:', err);
      return { patients: {} };
    }
  }

  // Simulate listing available MCP tools
  listTools() {
    return [
      {
        name: 'get_patient_public_record',
        description: 'Retrieves the public emergency medical badge and immediate first-aid steps for a scanned tag.',
        inputSchema: {
          type: 'object',
          properties: {
            tagId: { type: 'string', description: 'The unique ID printed on the tag QR code' }
          },
          required: ['tagId']
        }
      },
      {
        name: 'get_patient_secure_record',
        description: 'Retrieves full clinical history, MRN, medications, and lab reports. Requires authentication validation.',
        inputSchema: {
          type: 'object',
          properties: {
            tagId: { type: 'string', description: 'The unique ID printed on the tag QR code' },
            authToken: { type: 'string', description: 'Clinician authenticated token or FaceID success indicator' }
          },
          required: ['tagId', 'authToken']
        }
      },
      {
        name: 'check_drug_contraindications',
        description: 'Compares a proposed new drug against the patient active medications in the secure EMR.',
        inputSchema: {
          type: 'object',
          properties: {
            tagId: { type: 'string', description: 'The unique ID printed on the tag QR code' },
            newDrug: { type: 'string', description: 'The name of the new drug/medication to check' }
          },
          required: ['tagId', 'newDrug']
        }
      }
    ];
  }

  // Simulates callTool request
  async callTool(name, args) {
    const db = this._loadDb();
    const patient = db.patients[args.tagId];

    if (!patient) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Patient record not found for tagId: ${args.tagId}` }]
      };
    }

    switch (name) {
      case 'get_patient_public_record':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(patient.publicTier, null, 2)
          }]
        };

      case 'get_patient_secure_record':
        if (!args.authToken || args.authToken !== 'MOCK_CLINICIAN_AUTH_TOKEN_SUCCESS') {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Access Denied: Invalid credentials or insufficient permissions.' }]
          };
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              fullName: patient.secureTier.fullName,
              dob: patient.secureTier.dob,
              mrn: patient.secureTier.mrn,
              activeMedications: patient.secureTier.activeMedications,
              clinicalNotes: patient.secureTier.clinicalNotes,
              recentLabs: patient.secureTier.recentLabs
            }, null, 2)
          }]
        };

      case 'check_drug_contraindications':
        const activeMeds = patient.secureTier.activeMedications.map(m => m.name.toLowerCase());
        const proposedDrug = args.newDrug.toLowerCase();
        
        let contraindicationText = "No known contraindications found in mock database. Suggest double-checking clinical references.";
        let alertLevel = "INFO";

        // Simple hardcoded checks for presentation realism
        if (activeMeds.includes('apixaban (eliquis)') || activeMeds.includes('apixaban')) {
          if (proposedDrug.includes('aspirin') || proposedDrug.includes('ibuprofen') || proposedDrug.includes('advil')) {
            contraindicationText = `CRITICAL ALERT: Patient is taking Apixaban (Eliquis) which is a strong anticoagulant. Administering ${args.newDrug} (an NSAID) significantly increases risk of major gastrointestinal and systemic bleeding.`;
            alertLevel = "CRITICAL";
          }
        }
        if (activeMeds.includes('albuterol')) {
          if (proposedDrug.includes('propranolol') || proposedDrug.includes('metoprolol') || proposedDrug.includes('beta blocker')) {
            contraindicationText = `WARNING: Patient is taking Albuterol (Beta-2 agonist). Beta-blockers like ${args.newDrug} can cause severe bronchospasm in asthmatic patients and antagonize albuterol effectiveness.`;
            alertLevel = "HIGH";
          }
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              alertLevel,
              detail: contraindicationText,
              activeMedications: patient.secureTier.activeMedications
            }, null, 2)
          }]
        };

      default:
        return {
          isError: true,
          content: [{ type: 'text', text: `Unknown tool name: ${name}` }]
        };
    }
  }
}

module.exports = EMRMcpServer;
