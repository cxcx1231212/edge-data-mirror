import { readEncryptedResponse } from "../shared/crypto.js";
const nativeFetch = window.fetch.bind(window);
function encryptedUrl(input) {
    if (input instanceof Request)
        return input;
    const url = new URL(String(input), location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/") || url.pathname.startsWith("/api/track"))
        return input;
    url.searchParams.set("encrypted", "1");
    return url.toString();
}
window.fetch = async (input, init) => {
    const target = encryptedUrl(input);
    const response = await nativeFetch(target, init);
    const url = new URL(target instanceof Request ? target.url : String(target), location.href);
    if (url.origin !== location.origin || url.searchParams.get("encrypted") !== "1" || !response.ok)
        return response;
    const data = await readEncryptedResponse(response.clone());
    return Response.json(data, { status: response.status, headers: { "cache-control": "no-store" } });
};
async function mount() {
    try {
        const endpoint = new URL("/api/page.php", location.origin);
        endpoint.searchParams.set("path", location.pathname);
        endpoint.searchParams.set("encrypted", "1");
        const payload = await readEncryptedResponse(await nativeFetch(endpoint, { cache: "no-store" }));
        document.title = payload.title;
        document.open();
        document.write(payload.html);
        document.close();
        document.title = payload.title;
    }
    catch (error) {
        console.error("Page decryption/mount failed", error);
        const root = document.getElementById("secure-loader");
        if (root)
            root.innerHTML = '<p role="alert">页面加载失败，请刷新后重试。</p>';
    }
}
void mount();
