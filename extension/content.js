// --- TOKEN EXTRACTION INJECTION ---

// --- TOKEN STATE ---
window.spotifyDislikeTokens = { bearer: null, client: null };
// --- USER ID STORAGE & PROMPT ---
function getStoredSpotifyUserId() {
    try {
        return localStorage.getItem("spoti-dislike-userid") || null;
    } catch (e) {
        return null;
    }
}

function setStoredSpotifyUserId(userId) {
    try {
        localStorage.setItem("spoti-dislike-userid", userId);
    } catch (e) {}
}
// --- STATE ---
window.currentTrackUri = null;

// --- TRACK URI FROM DOM ---
function extractTrackUriFromDOM() {
    const panel = document.getElementById("Desktop_PanelContainer_Id");
    if (!panel) return null;

    // Find all <a> tags with data-context-item-type="track"
    const links = panel.querySelectorAll('a[data-context-item-type="track"]');
    for (const a of links) {
        // Try to extract the URI from the href attribute
        const href = a.getAttribute("href") || "";
        // Look for uri=spotify:track:... or uri=spotify%3Atrack%3A...
        const uriMatch = href.match(/uri=spotify:(track:[^&]+)/) || href.match(/uri=spotify%3Atrack%3A([^&]+)/);
        if (uriMatch) {
            // If percent-encoded, decode
            let uri = uriMatch[1].startsWith("track:") ? "spotify:" + uriMatch[1] : decodeURIComponent("spotify%3Atrack%3A" + uriMatch[1]);
            return uri;
        }
        // Or, try to extract from the href if it contains /track/ or ends with a track id
        const directUri = a.getAttribute("href");
        const directMatch = directUri && directUri.match(/uri=spotify:track:([a-zA-Z0-9]+)/);
        if (directMatch) {
            return "spotify:track:" + directMatch[1];
        }
        // Or, try to extract from the href if it contains uri=spotify%3Atrack%3A...
        const encodedMatch = directUri && directUri.match(/uri=spotify%3Atrack%3A([a-zA-Z0-9]+)/);
        if (encodedMatch) {
            return "spotify:track:" + encodedMatch[1];
        }
        // Or, try to extract from the href if it contains /track/<id>
        const pathMatch = directUri && directUri.match(/\/track\/([a-zA-Z0-9]+)/);
        if (pathMatch) {
            return "spotify:track:" + pathMatch[1];
        }
        // Or, try to extract from the href if it contains uri as a query param
        const url = new URL("https://dummy.com" + href);
        const uriParam = url.searchParams.get("uri");
        if (uriParam && uriParam.startsWith("spotify:track:")) {
            return uriParam;
        }
    }
    return null;
}

// --- FETCH HOOK ---
const origFetch = window.fetch;
window.fetch = async (...args) => {
    const res = await origFetch(...args);

    try {
        const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");
        const reqInit = args[1] || {};

        // Capture tokens from outgoing request headers (e.g. spclient requests)
        // This catches the Bearer token even if /api/token fired before extension loaded
        const reqHeaders = reqInit.headers || (args[0]?.headers);
        if (reqHeaders) {
            let authHeader = null;
            let clientHeader = null;
            if (reqHeaders instanceof Headers) {
                authHeader = reqHeaders.get("authorization") || reqHeaders.get("Authorization");
                clientHeader = reqHeaders.get("client-token");
            } else if (typeof reqHeaders === "object") {
                authHeader = reqHeaders["authorization"] || reqHeaders["Authorization"];
                clientHeader = reqHeaders["client-token"];
            }
            if (authHeader && authHeader.startsWith("Bearer ") && !window.spotifyDislikeTokens.bearer) {
                window.spotifyDislikeTokens.bearer = authHeader.slice(7);
                console.log("[spoti-dislike] ✓ Bearer token captured from request headers");
                updateStatusPanel();
            }
            if (clientHeader && !window.spotifyDislikeTokens.client) {
                window.spotifyDislikeTokens.client = clientHeader;
                console.log("[spoti-dislike] ✓ Client token captured from request headers");
                updateStatusPanel();
            }
            const appVersion = reqHeaders instanceof Headers
                ? reqHeaders.get("spotify-app-version")
                : reqHeaders["spotify-app-version"];
            if (appVersion && !window.spotifyAppVersion) {
                window.spotifyAppVersion = appVersion;
                console.log("[spoti-dislike] ✓ App version captured:", appVersion);
            }
        }

        // Capture Bearer token from /api/token response (absolute or relative URL)
        if (url.includes("/api/token")) {
            console.log("[spoti-dislike] Intercepted /api/token request:", url);
            res.clone().json().then(data => {
                console.log("[spoti-dislike] /api/token response keys:", data ? Object.keys(data) : null);
                if (data?.accessToken) {
                    window.spotifyDislikeTokens.bearer = data.accessToken;
                    console.log("[spoti-dislike] ✓ Bearer token captured");
                    updateStatusPanel();
                } else {
                    console.warn("[spoti-dislike] /api/token response had no accessToken");
                }
            }).catch((e) => { console.warn("[spoti-dislike] Failed to parse /api/token response", e); });
        }

        // Capture client token from /clienttoken
        if (url.includes("clienttoken.spotify.com/v1/clienttoken")) {
            console.log("[spoti-dislike] Intercepted /clienttoken request:", url);
            res.clone().json().then(data => {
                console.log("[spoti-dislike] /clienttoken response keys:", data ? Object.keys(data) : null);
                if (data?.granted_token?.token) {
                    window.spotifyDislikeTokens.client = data.granted_token.token;
                    console.log("[spoti-dislike] ✓ Client token captured");
                    updateStatusPanel();
                } else {
                    console.warn("[spoti-dislike] /clienttoken response had no granted_token.token");
                }
            }).catch((e) => { console.warn("[spoti-dislike] Failed to parse /clienttoken response", e); });
        }

        // Try to update track URI from DOM first
        const domUri = extractTrackUriFromDOM();
        if (domUri) {
            if (domUri !== window.currentTrackUri) {
                window.currentTrackUri = domUri;
                window.currentTrackIgnored = undefined;
                console.log("[spoti-dislike] ✓ Track detected (DOM):", window.currentTrackUri);
                updateStatusPanel();
                refreshIgnoredState();
            }
        } else if (url.includes("/metadata/4/track/")) {
            console.log("[spoti-dislike] Intercepted /metadata/4/track/ request:", url);
            res.clone().json().then(data => {
                if (data?.canonical_uri && data.canonical_uri !== window.currentTrackUri) {
                    window.currentTrackUri = data.canonical_uri;
                    window.currentTrackIgnored = undefined;
                    console.log("[spoti-dislike] ✓ Track detected (metadata):", window.currentTrackUri);
                    updateStatusPanel();
                    refreshIgnoredState();
                }
            }).catch(() => {});
        }
    } catch (e) {}

    return res;
};

// --- XHR HOOK (fallback) ---
const origOpen = XMLHttpRequest.prototype.open;
const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (name.toLowerCase() === "authorization" && value.startsWith("Bearer ") && !window.spotifyDislikeTokens.bearer) {
        window.spotifyDislikeTokens.bearer = value.slice(7);
        console.log("[spoti-dislike] ✓ Bearer token captured from XHR request header");
        updateStatusPanel();
    }
    if (name.toLowerCase() === "client-token" && !window.spotifyDislikeTokens.client) {
        window.spotifyDislikeTokens.client = value;
        console.log("[spoti-dislike] ✓ Client token captured from XHR request header");
        updateStatusPanel();
    }
    return origSetRequestHeader.apply(this, arguments);
};

XMLHttpRequest.prototype.open = function (...args) {
    this.addEventListener("load", function () {
        try {
            // Try to update from DOM first
            const domUri = extractTrackUriFromDOM();
            if (domUri) {
                window.currentTrackUri = domUri;
                console.log("Track detected (DOM/XHR):", window.currentTrackUri);
            } else if (this.responseURL.includes("/metadata/4/track/")) {
                const data = JSON.parse(this.responseText);
                if (data?.canonical_uri) {
                    window.currentTrackUri = data.canonical_uri;
                    console.log("Track detected (XHR):", window.currentTrackUri);
                }
            }
        } catch (e) {}
    });

    return origOpen.apply(this, args);
};

// --- CHECK IF TRACK IS ALREADY IGNORED ---
function buildSpotifyHeaders() {
    const bearer = window.spotifyDislikeTokens?.bearer;
    const client = window.spotifyDislikeTokens?.client;
    const headers = {
        "content-type": "application/json",
        "accept": "application/json",
        "app-platform": "WebPlayer",
        "spotify-app-version": window.spotifyAppVersion || "1.0.0.0.0"
    };
    if (bearer) headers["authorization"] = "Bearer " + bearer;
    if (client) headers["client-token"] = client;
    return headers;
}

async function isTrackIgnored(uri, userId) {
    const bearer = window.spotifyDislikeTokens?.bearer;
    const client = window.spotifyDislikeTokens?.client;
    if (!bearer || !client || !uri || !userId) return false;

    try {
        const res = await origFetch(
            "https://spclient.wg.spotify.com/collection/v2/contains?market=from_token",
            {
                method: "POST",
                credentials: "include",
                headers: buildSpotifyHeaders(),
                body: JSON.stringify({ username: userId, set: "ignoreinrecs", items: [{ uri }] })
            }
        );
        if (res.ok) {
            const data = await res.json();
            return data?.found?.[0] === true;
        }
    } catch (e) {
        console.warn("[spoti-dislike] Failed to check ignored state", e);
    }
    return false;
}

async function refreshIgnoredState() {
    const uri = window.currentTrackUri;
    const userId = getStoredSpotifyUserId();
    if (!uri || !userId || !window.spotifyDislikeTokens?.bearer || !window.spotifyDislikeTokens?.client) return;
    const ignored = await isTrackIgnored(uri, userId);
    window.currentTrackIgnored = ignored;
    console.log("[spoti-dislike] Track ignored state:", ignored);
    updateStatusPanel();
}

// --- IGNORE FUNCTION ---
async function ignoreCurrentTrack() {
    // Always try to extract from DOM first
    let uri = extractTrackUriFromDOM();
    if (!uri) uri = window.currentTrackUri;
    if (!uri) {
        alert("No track detected yet");
        return;
    }

    // Get user ID from extension storage, or prompt the user
    let userId = getStoredSpotifyUserId();
    if (!userId) {
        userId = prompt("Enter your Spotify user ID (you can find it in your profile URL or in localStorage):");
        if (userId && typeof userId === "string" && userId.length >= 22 && /^[a-z0-9]+$/.test(userId)) {
            setStoredSpotifyUserId(userId);
        } else {
            alert("Invalid user ID. Please enter your Spotify user ID (lowercase letters and numbers only, at least 22 characters).");
            return;
        }
    }

    const body = {
        username: userId,
        set: "ignoreinrecs",
        items: [{ uri }]
    };


    // Ensure tokens are available
    const bearer = window.spotifyDislikeTokens?.bearer;
    const client = window.spotifyDislikeTokens?.client;

    const res = await fetch(
        "https://spclient.wg.spotify.com/collection/v2/write?market=from_token",
        {
            method: "POST",
            credentials: "include",
            headers: buildSpotifyHeaders(),
            body: JSON.stringify(body)
        }
    );

    if (res.ok) {
        console.log("[spoti-dislike] Ignored:", uri, `(user: ${userId})`);
        window.currentTrackIgnored = true;
        return true;
    } else {
        console.error("[spoti-dislike] Failed to ignore track", res.status, await res.text().catch(() => ""));
        return false;
    }
}

// --- STATUS PANEL ---
function updateStatusPanel() {
    const panel = document.getElementById("spoti-dislike-status");
    if (!panel) return;

    const bearer = window.spotifyDislikeTokens?.bearer;
    const client = window.spotifyDislikeTokens?.client;
    const track = window.currentTrackUri;
    const allReady = !!(bearer && client && track);
    const tokensReady = !!(bearer && client);

    // Hide the status panel when everything is ready
    panel.style.display = allReady ? "none" : "block";

    if (!allReady) {
        const row = (label, ok) =>
            `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
                <span style="font-size:12px;color:${ok ? '#1db954' : '#f59e0b'}">${ok ? '✓' : '⏳'}</span>
                <span style="font-size:11px;opacity:0.85">${label}: ${ok ? 'ready' : 'waiting...'}</span>
            </div>`;
        panel.innerHTML =
            row('Bearer', !!bearer) +
            row('Client token', !!client) +
            row('Track', !!track);
    }

    // Update button appearance
    const btn = document.getElementById("spotify-ignore-btn");
    if (!btn) return;
    const active = btn.innerText === "Ignore" || btn.innerText === "⏳ Detecting..." || btn.innerText === "Already ignored";
    if (!active) return;

    if (allReady) {
        if (window.currentTrackIgnored) {
            btn.innerText = "Already ignored";
            btn.style.background = "#555";
            btn.style.cursor = "default";
        } else {
            btn.innerText = "Ignore";
            btn.style.background = "#1db954";
            btn.style.cursor = "pointer";
        }
        btn.title = "";
    } else if (tokensReady) {
        btn.innerText = "⏳ Detecting...";
        btn.style.background = "#b45309";
        btn.style.cursor = "default";
        btn.title = "Waiting for track detection";
    } else {
        btn.innerText = "⏳ Detecting...";
        btn.style.background = "#7c3aed";
        btn.style.cursor = "default";
        btn.title = "Waiting for: " + [!bearer && "Bearer", !client && "Client token", !track && "Track"].filter(Boolean).join(", ");
    }
}

// --- UI BUTTON ---
function injectButton() {
    if (document.getElementById("spotify-ignore-btn")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "spoti-dislike-wrapper";
    Object.assign(wrapper.style, {
        position: "fixed",
        bottom: "120px",
        right: "20px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "6px"
    });

    const status = document.createElement("div");
    status.id = "spoti-dislike-status";
    Object.assign(status.style, {
        background: "rgba(0,0,0,0.75)",
        color: "#fff",
        borderRadius: "10px",
        padding: "6px 10px",
        fontSize: "11px",
        backdropFilter: "blur(4px)"
    });

    const btn = document.createElement("button");
    btn.id = "spotify-ignore-btn";
    btn.innerText = "Ignore";

    Object.assign(btn.style, {
        padding: "10px 14px",
        background: "#b45309",
        color: "#fff",
        border: "none",
        borderRadius: "20px",
        cursor: "pointer",
        fontSize: "14px"
    });

    btn.onclick = async () => {
        if (window.currentTrackIgnored) return;
        btn.innerText = "Working...";
        btn.style.cursor = "default";
        const ok = await ignoreCurrentTrack();
        btn.innerText = ok ? "Ignored ✓" : "Failed";
        setTimeout(() => {
            // Reset text so updateStatusPanel guard passes and re-evaluates state
            btn.innerText = "Ignore";
            updateStatusPanel();
        }, 2000);
    };

    wrapper.appendChild(status);
    wrapper.appendChild(btn);
    document.body.appendChild(wrapper);
    updateStatusPanel();
}

// --- KEYBOARD SHORTCUT (Shift + X) ---
document.addEventListener("keydown", async (e) => {
    if (e.shiftKey && e.key.toLowerCase() === "x") {
        if (window.currentTrackIgnored) return;
        const btn = document.getElementById("spotify-ignore-btn");
        if (btn) { btn.innerText = "Working..."; btn.style.cursor = "default"; }
        const ok = await ignoreCurrentTrack();
        if (btn) {
            btn.innerText = ok ? "Ignored ✓" : "Failed";
            setTimeout(() => { btn.innerText = "Ignore"; updateStatusPanel(); }, 2000);
        }
    }
});

// --- INIT ---
setInterval(() => {
    if (!document.getElementById("spoti-dislike-wrapper")) {
        injectButton();
    } else {
        // Re-check DOM for track changes
        const domUri = extractTrackUriFromDOM();
        if (domUri && domUri !== window.currentTrackUri) {
            window.currentTrackUri = domUri;
            window.currentTrackIgnored = undefined;
            console.log("[spoti-dislike] ✓ Track changed (interval):", domUri);
            refreshIgnoredState();
        }
        updateStatusPanel();
    }
}, 2000);
