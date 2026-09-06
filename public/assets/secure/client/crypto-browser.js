import { decrypt, decryptJsonPayload, encrypt, encryptJsonPayload, importAesKey, readEncryptedResponse } from "../shared/crypto.js";
window.SecurePayload = { importAesKey, encrypt, decrypt, encryptJsonPayload, decryptJsonPayload, readEncryptedResponse };
