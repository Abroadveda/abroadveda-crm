// Simple hash function for password verification (non-cryptographic)
// Used only for basic password checks in this demo CRM
export function hashPassword(password) {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = ((hash << 5) + hash + password.charCodeAt(i)) >>> 0;
  }
  return "h" + hash.toString(36);
}

export function validatePassword(input, hashedPassword) {
  return hashPassword(input) === hashedPassword;
}
