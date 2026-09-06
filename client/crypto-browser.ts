import {
  decrypt,
  decryptJsonPayload,
  encrypt,
  encryptJsonPayload,
  importAesKey,
  readEncryptedResponse
} from "../shared/crypto.js";

declare global {
  interface Window {
    SecurePayload: {
      importAesKey: typeof importAesKey;
      encrypt: typeof encrypt;
      decrypt: typeof decrypt;
      encryptJsonPayload: typeof encryptJsonPayload;
      decryptJsonPayload: typeof decryptJsonPayload;
      readEncryptedResponse: typeof readEncryptedResponse;
    };
  }
}

window.SecurePayload = { importAesKey, encrypt, decrypt, encryptJsonPayload, decryptJsonPayload, readEncryptedResponse };
