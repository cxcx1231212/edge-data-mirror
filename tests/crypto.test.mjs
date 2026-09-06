import assert from "node:assert/strict";
import { decrypt, decryptJsonPayload, encrypt, encryptJsonPayload, importAesKey } from "../public/assets/secure/shared/crypto.js";

const key = await importAesKey();
assert.equal(key.algorithm.name, "AES-GCM");
const plain = "自动解密测试";
const first = await encrypt(plain);
const second = await encrypt(plain);
assert.equal(await decrypt(first), plain);
assert.notEqual(first.iv, second.iv, "every encryption must use a different IV");
assert.equal(Buffer.from(first.iv, "base64").length, 12);
assert.equal(Buffer.from(first.tag, "base64").length, 16);
const object = { success: true, records: [{ period: "236", content: "测试" }] };
assert.deepEqual(await decryptJsonPayload(await encryptJsonPayload(object)), object);

for (const field of ["ciphertext", "iv", "tag"]) {
  const tampered = { ...first };
  const bytes = Buffer.from(tampered[field], "base64");
  bytes[0] ^= 1;
  tampered[field] = bytes.toString("base64");
  await assert.rejects(() => decrypt(tampered), /数据解密失败|12 bytes|16 bytes/);
}
console.log("crypto tests passed");
