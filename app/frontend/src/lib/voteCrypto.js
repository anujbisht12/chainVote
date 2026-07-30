// voteCrypto.js
// All RSA key generation and signing happens HERE, in the browser, using
// the native Web Crypto API. The private key this module produces is
// never sent anywhere — Register.jsx only ever transmits the PUBLIC key
// to the server, and ElectionDetail.jsx only ever transmits a SIGNATURE.
//
// Salt length is fixed to 32 bytes (SHA-256 digest size) to match the
// server's verification config exactly (see backend/server.py,
// PSS_SALT_LENGTH). If you change one side, change the other.

const PSS_SALT_LENGTH = 32;

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function wrapPem(base64, label) {
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  return base64ToArrayBuffer(b64);
}

const RSA_ALG = {
  name: "RSA-PSS",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

/**
 * Generates a fresh RSA-2048 keypair entirely in the browser.
 * Returns PEM strings for both keys. Nothing is transmitted by this
 * function — the caller decides what to do with the result.
 */
export async function generateVoterKeypairPem() {
  const keyPair = await window.crypto.subtle.generateKey(RSA_ALG, true, ["sign", "verify"]);

  const spki = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const pkcs8 = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  return {
    publicKeyPem: wrapPem(arrayBufferToBase64(spki), "PUBLIC KEY"),
    privateKeyPem: wrapPem(arrayBufferToBase64(pkcs8), "PRIVATE KEY"),
  };
}

/**
 * Imports a PEM-encoded PKCS8 private key (e.g. pasted or uploaded by the
 * voter) as a non-extractable CryptoKey usable only for signing.
 */
async function importPrivateKeyPem(pem) {
  const buffer = pemToArrayBuffer(pem);
  return window.crypto.subtle.importKey(
    "pkcs8",
    buffer,
    { name: "RSA-PSS", hash: "SHA-256" },
    false, // non-extractable — can't be read back out of the CryptoKey object
    ["sign"]
  );
}

/**
 * Signs `message` with the given PEM private key and returns a base64
 * signature. The private key PEM lives only in local JS variables for the
 * duration of this call and is never sent over the network.
 */
export async function signMessage(privateKeyPem, message) {
  const key = await importPrivateKeyPem(privateKeyPem);
  const data = new TextEncoder().encode(message);
  const signature = await window.crypto.subtle.sign(
    { name: "RSA-PSS", saltLength: PSS_SALT_LENGTH },
    key,
    data
  );
  return arrayBufferToBase64(signature);
}

/**
 * Basic client-side sanity check that a pasted/uploaded string looks like
 * a PKCS8 private key PEM, before we try to use it.
 */
export function looksLikePrivateKeyPem(pem) {
  return typeof pem === "string" && pem.includes("BEGIN PRIVATE KEY") && pem.includes("END PRIVATE KEY");
}
