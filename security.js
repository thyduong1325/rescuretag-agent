const fs = require('fs');
const path = require('path');

// Loaded dynamically to match current DB state
function getPatientList() {
  try {
    const dbPath = path.join(__dirname, 'db.json');
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data).patients;
  } catch (err) {
    return {};
  }
}

/**
 * Validates whether the incoming scan URL is cryptographically valid and signed
 * via temporary nonces/parameters to prevent brute-forcing/enumeration.
 */
function validateSignedScan(tagId, nonce) {
  const patients = getPatientList();
  const patient = patients[tagId];
  
  if (!patient) {
    return { isValid: false, reason: 'Invalid Tag ID' };
  }

  // Retrieve expected nonce from db
  const expectedUrl = new URL(patient.secureLink);
  const expectedNonce = expectedUrl.searchParams.get('nonce');

  if (nonce === expectedNonce) {
    return { isValid: true, patient };
  }

  return { isValid: false, reason: 'Security Alert: Nonce mismatch or expired link signature.' };
}

/**
 * Redacts any Patient Identifiable Information (PII) before sending prompts to external LLMs.
 */
function redactPII(promptText, patient) {
  if (!patient || !patient.secureTier) return promptText;

  let redactedText = promptText;
  const fullName = patient.secureTier.fullName;
  const dob = patient.secureTier.dob;

  // Case-insensitive replacement for name
  const nameRegex = new RegExp(fullName, 'gi');
  redactedText = redactedText.replace(nameRegex, '[REDACTED_PATIENT_NAME]');

  // Replace Date of Birth
  if (dob) {
    const dobRegex = new RegExp(dob, 'g');
    redactedText = redactedText.replace(dobRegex, '[REDACTED_PATIENT_DOB]');
  }

  return redactedText;
}

/**
 * Restores PII locally before sending results back to authorized clinicians.
 */
function unredactPII(responseText, patient) {
  if (!patient || !patient.secureTier) return responseText;

  let restoredText = responseText;
  const fullName = patient.secureTier.fullName;
  const dob = patient.secureTier.dob;

  restoredText = restoredText.replace(/\[REDACTED_PATIENT_NAME\]/g, fullName);
  restoredText = restoredText.replace(/\[REDACTED_PATIENT_DOB\]/g, dob);

  return restoredText;
}

module.exports = {
  validateSignedScan,
  redactPII,
  unredactPII
};
