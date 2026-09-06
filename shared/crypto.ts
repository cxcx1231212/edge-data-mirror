export type EncryptedPayload = { ciphertext: string; iv: string; tag: string };

const KEY_PARTS = [
  "3dda8abdbf1884ac",
  "591469669405c9ac",
  "a3d1823be596b093",
  "91d40066f5666b5c"
] as const;
const KEY_ORDER = [1, 3, 0, 2] as const;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function keyBytes(): Uint8Array {
  const hex = KEY_ORDER.map(index => KEY_PARTS[index]).join("");
  if (hex.length !== 64) throw new Error("AES key must be exactly 32 bytes");
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map(value => Number.parseInt(value, 16)));
  if (bytes.byteLength !== 32) throw new Error("AES key must be exactly 32 bytes");
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string, field: string): Uint8Array {
  try {
    if (!value || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error("invalid base64");
    return Uint8Array.from(atob(value), char => char.charCodeAt(0));
  } catch (error) {
    throw new Error(`${field} is not valid Base64`, { cause: error });
  }
}

function inputBytes(value: string | Uint8Array): Uint8Array {
  return typeof value === "string" ? encoder.encode(value) : value;
}

function exactBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

export function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (!value || typeof value !== "object") return false;
  const object = value as Record<string, unknown>;
  return typeof object.ciphertext === "string" && typeof object.iv === "string" && typeof object.tag === "string";
}

export async function importAesKey(): Promise<CryptoKey> {
  const bytes = keyBytes();
  if (bytes.byteLength !== 32) throw new Error("AES key must be exactly 32 bytes");
  return crypto.subtle.importKey("raw", exactBuffer(bytes), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encrypt(value: string | Uint8Array): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: exactBuffer(iv), tagLength: 128 },
    await importAesKey(),
    exactBuffer(inputBytes(value))
  ));
  if (encrypted.byteLength < 16) throw new Error("AES-GCM output is missing its authentication tag");
  return {
    ciphertext: toBase64(encrypted.subarray(0, -16)),
    iv: toBase64(iv),
    tag: toBase64(encrypted.subarray(-16))
  };
}

export async function decrypt(payload: EncryptedPayload): Promise<string> {
  if (!isEncryptedPayload(payload)) throw new Error("Encrypted payload is malformed");
  const iv = fromBase64(payload.iv, "iv");
  const tag = fromBase64(payload.tag, "tag");
  const ciphertext = fromBase64(payload.ciphertext, "ciphertext");
  if (iv.byteLength !== 12) throw new Error("AES-GCM IV must be exactly 12 bytes");
  if (tag.byteLength !== 16) throw new Error("AES-GCM tag must be exactly 16 bytes");
  const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.byteLength);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: exactBuffer(iv), tagLength: 128 },
      await importAesKey(),
      exactBuffer(combined)
    );
    return decoder.decode(plain);
  } catch (error) {
    console.error("AES-GCM authentication/decryption failed", error);
    throw new Error("数据解密失败，请稍后重试", { cause: error });
  }
}

export function encryptJsonPayload(value: unknown): Promise<EncryptedPayload> {
  return encrypt(JSON.stringify(value));
}

export async function decryptJsonPayload<T>(payload: EncryptedPayload): Promise<T> {
  const plain = await decrypt(payload);
  try {
    return JSON.parse(plain) as T;
  } catch (error) {
    console.error("Decrypted JSON parsing failed", error);
    throw new Error("数据格式错误，请稍后重试", { cause: error });
  }
}

export async function readEncryptedResponse<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    console.error("Response JSON parsing failed", error);
    throw new Error("数据加载失败", { cause: error });
  }
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload
      ? String((payload as { message?: unknown }).message || "数据加载失败")
      : "数据加载失败";
    throw new Error(message);
  }
  if (!isEncryptedPayload(payload)) return payload as T;
  return decryptJsonPayload<T>(payload);
}
