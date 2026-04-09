// ============================================================
//  Spoti-Ignore — content script
// ============================================================

// --- DEBUG LOGGING ---
// Toggle in the extension popup, or manually:
//   localStorage.setItem('spoti-ignore-debug', 'true')
function isDebugEnabled() {
    try { return localStorage.getItem("spoti-ignore-debug") === "true"; } catch(e) { return false; }
}
function dbg(...args)  { if (isDebugEnabled()) console.log("[spoti-ignore]", ...args); }
function dbgw(...args) { if (isDebugEnabled()) console.warn("[spoti-ignore]", ...args); }
function dbge(...args) { if (isDebugEnabled()) console.error("[spoti-ignore]", ...args); }

// --- TOKEN STATE ---
window.spotifyDislikeTokens = { bearer: null, client: null };

// --- USER ID STORAGE ---
function getStoredSpotifyUserId() {
    try { return localStorage.getItem("spoti-ignore-userid") || null; } catch (e) { return null; }
}
function setStoredSpotifyUserId(userId) {
    try { localStorage.setItem("spoti-ignore-userid", userId); } catch (e) {}
}
function clearStoredSpotifyUserId() {
    try { localStorage.removeItem("spoti-ignore-userid"); } catch (e) {}
}

// --- STATE ---
window.currentTrackUri = null;

// ============================================================
//  USER ID MODAL
// ============================================================

function extractUserIdFromURL() {
    const m = window.location.href.match(/open\.spotify\.com\/user\/([a-zA-Z0-9_]+)/);
    return m ? m[1] : null;
}

function isValidUserId(id) {
    return typeof id === "string" && id.length >= 2 && /^[a-zA-Z0-9_]+$/.test(id);
}

let _modalResolve = null;

/**
 * Called by the fetch hook when the user-profile-view API reveals the user ID.
 * If the setup modal is currently open, auto-fills and closes it.
 * Otherwise just saves the ID silently.
 */
function autoFillModalUserId(userId) {
    setStoredSpotifyUserId(userId);
    dbg("User ID auto-captured from profile API:", userId);

    const modal = document.getElementById("spoti-ignore-modal-overlay");
    if (!modal) return;

    // Update the waiting badge to show success
    const badge = document.getElementById("spoti-ignore-detect-badge");
    if (badge) {
        badge.style.background = "rgba(29,185,84,0.15)";
        badge.style.color = "#1db954";
        badge.style.borderColor = "#1db954";
        badge.textContent = `\u2713 Detected: ${userId}`;
    }

    // Brief delay so the user can see the success state, then auto-close
    setTimeout(() => {
        modal.remove();
        if (_modalResolve) {
            _modalResolve(userId);
            _modalResolve = null;
        }
    }, 900);
}

function showUserIdModal(opts = {}) {
    const isReset = opts.mode === "reset";

    const existing = document.getElementById("spoti-ignore-modal-overlay");
    if (existing) existing.remove();

    return new Promise((resolve) => {
        _modalResolve = resolve;

        const overlay = document.createElement("div");
        overlay.id = "spoti-ignore-modal-overlay";
        Object.assign(overlay.style, {
            position: "fixed", inset: "0", zIndex: "99999",
            background: "rgba(0,0,0,0.72)", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontFamily: "circular,helvetica,arial,sans-serif"
        });

        const card = document.createElement("div");
        Object.assign(card.style, {
            background: "#1a1a1a", borderRadius: "16px",
            padding: "32px 36px", maxWidth: "440px", width: "90%",
            color: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            display: "flex", flexDirection: "column", gap: "16px"
        });

        const title = document.createElement("h2");
        title.style.cssText = "margin:0;font-size:20px;font-weight:700;color:#1db954";
        title.textContent = isReset ? "Change Spotify User ID" : "Welcome to Spoti-Ignore!";

        const desc = document.createElement("p");
        desc.style.cssText = "margin:0;font-size:14px;line-height:1.55;color:#b3b3b3";
        desc.innerHTML = isReset
            ? "Enter a new Spotify User ID below, or open your profile page and we'll detect it automatically."
            : "To ignore songs, we need your <strong style='color:#fff'>Spotify User ID</strong> once.";

        // Step-by-step instruction box (only shown during onboarding)
        let detectSection = null;
        if (!isReset) {
            detectSection = document.createElement("div");
            Object.assign(detectSection.style, {
                background: "#111", borderRadius: "10px",
                padding: "14px 16px", display: "flex",
                flexDirection: "column", gap: "10px"
            });

            const steps = document.createElement("p");
            steps.style.cssText = "margin:0;font-size:13px;line-height:1.6;color:#ccc";
            steps.innerHTML =
                "<strong style='color:#fff'>Automatic detection:</strong><br>"
                + "1. Click your <strong style='color:#fff'>profile icon</strong> in the top-right corner of Spotify.<br>"
                + "2. Click <strong style='color:#fff'>Profile</strong>.<br>"
                + "3. We'll detect your ID automatically \u2014 no copy-paste needed.";

            const badge = document.createElement("div");
            badge.id = "spoti-ignore-detect-badge";
            Object.assign(badge.style, {
                display: "inline-flex", alignItems: "center", gap: "6px",
                fontSize: "12px", color: "#888",
                border: "1px solid #333", borderRadius: "20px",
                padding: "5px 12px", alignSelf: "flex-start",
                transition: "all 0.3s"
            });
            badge.innerHTML = '<span style="animation:spin 1s linear infinite;display:inline-block">&#8635;</span> Waiting for profile visit...';

            if (!document.getElementById("spoti-ignore-spin-style")) {
                const style = document.createElement("style");
                style.id = "spoti-ignore-spin-style";
                style.textContent = "@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }";
                document.head.appendChild(style);
            }

            detectSection.appendChild(steps);
            detectSection.appendChild(badge);
        }

        const divider = document.createElement("div");
        divider.style.cssText = "display:flex;align-items:center;gap:10px;color:#555;font-size:12px";
        divider.innerHTML = '<div style="flex:1;height:1px;background:#333"></div>or enter manually<div style="flex:1;height:1px;background:#333"></div>';

        const inputWrap = document.createElement("div");
        inputWrap.style.cssText = "display:flex;flex-direction:column;gap:6px";

        const inputLabel = document.createElement("label");
        inputLabel.htmlFor = "spoti-ignore-userid-input";
        inputLabel.style.cssText = "font-size:12px;color:#b3b3b3";
        inputLabel.textContent = "Spotify User ID (from open.spotify.com/user/YOUR_ID)";

        const input = document.createElement("input");
        input.id = "spoti-ignore-userid-input";
        input.type = "text";
        input.placeholder = "e.g. abc123xyz";
        input.value = opts.prefill || "";
        Object.assign(input.style, {
            padding: "10px 12px", borderRadius: "8px",
            border: "1px solid #333", background: "#111",
            color: "#fff", fontSize: "14px", outline: "none"
        });
        input.addEventListener("focus", () => { input.style.borderColor = "#1db954"; });
        input.addEventListener("blur",  () => { input.style.borderColor = "#333"; });

        const errorMsg = document.createElement("span");
        errorMsg.style.cssText = "font-size:12px;min-height:16px";

        // Auto-fill if already on profile page
        const urlId = extractUserIdFromURL();
        if (urlId) {
            input.value = urlId;
            errorMsg.style.color = "#1db954";
            errorMsg.textContent = `\u2713 Detected from URL: ${urlId}`;
        }

        inputWrap.appendChild(inputLabel);
        inputWrap.appendChild(input);
        inputWrap.appendChild(errorMsg);

        const confirmBtn = document.createElement("button");
        confirmBtn.textContent = "Save & continue";
        Object.assign(confirmBtn.style, {
            padding: "12px", background: "#1db954", color: "#000",
            border: "none", borderRadius: "24px", cursor: "pointer",
            fontSize: "15px", fontWeight: "700", marginTop: "4px"
        });

        const doConfirm = () => {
            const val = input.value.trim();
            if (!isValidUserId(val)) {
                errorMsg.style.color = "#e5373a";
                errorMsg.textContent = "Invalid ID \u2014 use only letters, numbers, underscores (min 2 chars).";
                return;
            }
            setStoredSpotifyUserId(val);
            overlay.remove();
            _modalResolve = null;
            resolve(val);
        };

        confirmBtn.onclick = doConfirm;
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") doConfirm(); });

        card.appendChild(title);
        card.appendChild(desc);
        if (detectSection) card.appendChild(detectSection);
        card.appendChild(divider);
        card.appendChild(inputWrap);
        card.appendChild(confirmBtn);

        // Dismiss button — different label for reset vs onboarding but same behaviour
        const dismissBtn = document.createElement("button");
        dismissBtn.textContent = isReset ? "Cancel" : "Skip for now";
        Object.assign(dismissBtn.style, {
            padding: isReset ? "10px" : "6px",
            background: "transparent",
            color: isReset ? "#b3b3b3" : "#666",
            border: isReset ? "1px solid #333" : "none",
            borderRadius: "24px",
            cursor: "pointer",
            fontSize: isReset ? "14px" : "12px",
            textDecoration: isReset ? "none" : "underline"
        });
        dismissBtn.onclick = () => {
            overlay.remove();
            _modalResolve = null;
            resolve(null);
        };
        card.appendChild(dismissBtn);

        overlay.appendChild(card);
        document.body.appendChild(overlay);
        setTimeout(() => input.focus(), 50);
    });
}

async function ensureUserId() {
    let userId = getStoredSpotifyUserId();
    if (!userId) {
        const urlId = extractUserIdFromURL();
        if (urlId) {
            setStoredSpotifyUserId(urlId);
            dbg("Auto-captured user ID from profile URL:", urlId);
            return urlId;
        }
        userId = await showUserIdModal({ mode: "onboarding" });
    }
    return userId;
}

// Exposed so the extension popup can trigger the modal via chrome.scripting.executeScript
window.spotiIgnoreOpenModal = showUserIdModal;

// ============================================================
//  TRACK URI EXTRACTION
// ============================================================

function extractTrackUriFromDOM() {
    const panel = document.getElementById("Desktop_PanelContainer_Id");
    if (!panel) return null;

    const links = panel.querySelectorAll('a[data-context-item-type="track"]');
    for (const a of links) {
        const href = a.getAttribute("href") || "";
        const uriMatch = href.match(/uri=spotify:(track:[^&]+)/) || href.match(/uri=spotify%3Atrack%3A([^&]+)/);
        if (uriMatch) {
            const uri = uriMatch[1].startsWith("track:")
                ? "spotify:" + uriMatch[1]
                : decodeURIComponent("spotify%3Atrack%3A" + uriMatch[1]);
            return uri;
        }
        const directUri = a.getAttribute("href");
        const directMatch = directUri && directUri.match(/uri=spotify:track:([a-zA-Z0-9]+)/);
        if (directMatch) return "spotify:track:" + directMatch[1];
        const encodedMatch = directUri && directUri.match(/uri=spotify%3Atrack%3A([a-zA-Z0-9]+)/);
        if (encodedMatch) return "spotify:track:" + encodedMatch[1];
        const pathMatch = directUri && directUri.match(/\/track\/([a-zA-Z0-9]+)/);
        if (pathMatch) return "spotify:track:" + pathMatch[1];
        try {
            const url = new URL("https://dummy.com" + href);
            const uriParam = url.searchParams.get("uri");
            if (uriParam && uriParam.startsWith("spotify:track:")) return uriParam;
        } catch (_) {}
    }
    return null;
}

// ============================================================
//  FETCH / XHR HOOKS
// ============================================================

const origFetch = window.fetch;
window.fetch = async (...args) => {
    const res = await origFetch(...args);
    try {
        const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");
        const reqInit = args[1] || {};
        const reqHeaders = reqInit.headers || (args[0]?.headers);

        if (reqHeaders) {
            let authHeader = null, clientHeader = null;
            if (reqHeaders instanceof Headers) {
                authHeader   = reqHeaders.get("authorization") || reqHeaders.get("Authorization");
                clientHeader = reqHeaders.get("client-token");
            } else if (typeof reqHeaders === "object") {
                authHeader   = reqHeaders["authorization"] || reqHeaders["Authorization"];
                clientHeader = reqHeaders["client-token"];
            }
            if (authHeader && authHeader.startsWith("Bearer ") && !window.spotifyDislikeTokens.bearer) {
                window.spotifyDislikeTokens.bearer = authHeader.slice(7);
                dbg("Bearer token captured from request headers");
                updateStatusPanel();
            }
            if (clientHeader && !window.spotifyDislikeTokens.client) {
                window.spotifyDislikeTokens.client = clientHeader;
                dbg("Client token captured from request headers");
                updateStatusPanel();
            }
            const appVersion = reqHeaders instanceof Headers
                ? reqHeaders.get("spotify-app-version")
                : reqHeaders["spotify-app-version"];
            if (appVersion && !window.spotifyAppVersion) {
                window.spotifyAppVersion = appVersion;
                dbg("App version captured:", appVersion);
            }
        }

        if (url.includes("/api/token")) {
            res.clone().json().then(data => {
                if (data?.accessToken) {
                    window.spotifyDislikeTokens.bearer = data.accessToken;
                    dbg("Bearer token captured from /api/token");
                    updateStatusPanel();
                }
            }).catch(() => {});
        }

        if (url.includes("clienttoken.spotify.com/v1/clienttoken")) {
            res.clone().json().then(data => {
                if (data?.granted_token?.token) {
                    window.spotifyDislikeTokens.client = data.granted_token.token;
                    dbg("Client token captured from /clienttoken");
                    updateStatusPanel();
                }
            }).catch(() => {});
        }

        // Auto-capture user ID from the profile-view API
        // URL pattern: /user-profile-view/v3/profile/<userid>/...
        if (!getStoredSpotifyUserId() && url.includes("user-profile-view")) {
            const profileMatch = url.match(/user-profile-view\/v3\/profile\/([a-zA-Z0-9_]+)/);
            if (profileMatch) {
                autoFillModalUserId(profileMatch[1]);
            }
        }

        const domUri = extractTrackUriFromDOM();
        if (domUri) {
            if (domUri !== window.currentTrackUri) {
                window.currentTrackUri = domUri;
                window.currentTrackIgnored = undefined;
                dbg("Track detected (DOM):", window.currentTrackUri);
                updateStatusPanel();
                refreshIgnoredState();
            }
        } else if (url.includes("/metadata/4/track/")) {
            res.clone().json().then(data => {
                if (data?.canonical_uri && data.canonical_uri !== window.currentTrackUri) {
                    window.currentTrackUri = data.canonical_uri;
                    window.currentTrackIgnored = undefined;
                    dbg("Track detected (metadata):", window.currentTrackUri);
                    updateStatusPanel();
                    refreshIgnoredState();
                }
            }).catch(() => {});
        }
    } catch (e) {}
    return res;
};

const origOpen = XMLHttpRequest.prototype.open;
const origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (name.toLowerCase() === "authorization" && value.startsWith("Bearer ") && !window.spotifyDislikeTokens.bearer) {
        window.spotifyDislikeTokens.bearer = value.slice(7);
        dbg("Bearer token captured from XHR");
        updateStatusPanel();
    }
    if (name.toLowerCase() === "client-token" && !window.spotifyDislikeTokens.client) {
        window.spotifyDislikeTokens.client = value;
        dbg("Client token captured from XHR");
        updateStatusPanel();
    }
    return origSetRequestHeader.apply(this, arguments);
};

XMLHttpRequest.prototype.open = function (...args) {
    this.addEventListener("load", function () {
        try {
            const domUri = extractTrackUriFromDOM();
            if (domUri) {
                window.currentTrackUri = domUri;
            } else if (this.responseURL.includes("/metadata/4/track/")) {
                const data = JSON.parse(this.responseText);
                if (data?.canonical_uri) window.currentTrackUri = data.canonical_uri;
            }
        } catch (e) {}
    });
    return origOpen.apply(this, args);
};

// ============================================================
//  SPOTIFY API HELPERS
// ============================================================

function buildSpotifyHeaders() {
    const { bearer, client } = window.spotifyDislikeTokens || {};
    const headers = {
        "content-type": "application/json",
        "accept": "application/json",
        "app-platform": "WebPlayer",
        "spotify-app-version": window.spotifyAppVersion || "1.0.0.0.0"
    };
    if (bearer) headers["authorization"] = "Bearer " + bearer;
    if (client)  headers["client-token"] = client;
    return headers;
}

async function isTrackIgnored(uri, userId) {
    if (!window.spotifyDislikeTokens?.bearer || !window.spotifyDislikeTokens?.client || !uri || !userId) return false;
    try {
        const res = await origFetch(
            "https://spclient.wg.spotify.com/collection/v2/contains?market=from_token",
            {
                method: "POST", credentials: "include",
                headers: buildSpotifyHeaders(),
                body: JSON.stringify({ username: userId, set: "ignoreinrecs", items: [{ uri }] })
            }
        );
        if (res.ok) {
            const data = await res.json();
            return data?.found?.[0] === true;
        }
    } catch (e) { dbgw("Failed to check ignored state", e); }
    return false;
}

async function refreshIgnoredState() {
    const uri    = window.currentTrackUri;
    const userId = getStoredSpotifyUserId();
    if (!uri || !userId || !window.spotifyDislikeTokens?.bearer || !window.spotifyDislikeTokens?.client) return;
    window.currentTrackIgnored = await isTrackIgnored(uri, userId);
    dbg("Track ignored state:", window.currentTrackIgnored);
    updateStatusPanel();
}

async function ignoreCurrentTrack() {
    let uri = extractTrackUriFromDOM() || window.currentTrackUri;
    if (!uri) { dbgw("No track URI detected"); return false; }

    let userId = getStoredSpotifyUserId();
    if (!userId) {
        userId = await ensureUserId();
        if (!userId) return false;
    }

    const res = await fetch(
        "https://spclient.wg.spotify.com/collection/v2/write?market=from_token",
        {
            method: "POST", credentials: "include",
            headers: buildSpotifyHeaders(),
            body: JSON.stringify({ username: userId, set: "ignoreinrecs", items: [{ uri }] })
        }
    );

    if (res.ok) {
        dbg("Ignored:", uri, `(user: ${userId})`);
        window.currentTrackIgnored = true;
        return true;
    }
    dbge("Failed to ignore track", res.status, await res.text().catch(() => ""));
    return false;
}

// ============================================================
//  STATUS PANEL + BUTTON
// ============================================================

function updateStatusPanel() {
    const panel = document.getElementById("spoti-ignore-status");
    if (!panel) return;

    const { bearer, client } = window.spotifyDislikeTokens || {};
    const track      = window.currentTrackUri;
    const allReady   = !!(bearer && client && track);
    const tokensReady = !!(bearer && client);

    panel.style.display = allReady ? "none" : "block";

    if (!allReady) {
        const row = (label, ok) =>
            `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
                <span style="font-size:12px;color:${ok ? '#1db954' : '#f59e0b'}">${ok ? '\u2713' : '\u23f3'}</span>
                <span style="font-size:11px;opacity:0.85">${label}: ${ok ? 'ready' : 'waiting...'}</span>
            </div>`;
        panel.innerHTML = row("Bearer", !!bearer) + row("Client token", !!client) + row("Track", !!track);
    }

    const btn = document.getElementById("spotify-ignore-btn");
    if (!btn) return;
    const stable = btn.innerText === "Ignore" || btn.innerText === "\u23f3 Detecting..." || btn.innerText === "Already ignored";
    if (!stable) return;

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
        btn.innerText = "\u23f3 Detecting...";
        btn.style.background = "#b45309";
        btn.style.cursor = "default";
        btn.title = "Waiting for track detection";
    } else {
        btn.innerText = "\u23f3 Detecting...";
        btn.style.background = "#7c3aed";
        btn.style.cursor = "default";
        btn.title = "Waiting for: " + [!bearer && "Bearer", !client && "Client token", !track && "Track"].filter(Boolean).join(", ");
    }
}

// ============================================================
//  FLOATING WIDGET
// ============================================================

function injectButton() {
    if (document.getElementById("spotify-ignore-btn")) return;

    const wrapper = document.createElement("div");
    wrapper.id = "spoti-ignore-wrapper";
    Object.assign(wrapper.style, {
        position: "fixed", bottom: "120px", right: "20px",
        zIndex: "9999", display: "flex", flexDirection: "column",
        alignItems: "flex-end", gap: "6px",
        fontFamily: "circular,helvetica,arial,sans-serif"
    });

    const status = document.createElement("div");
    status.id = "spoti-ignore-status";
    Object.assign(status.style, {
        background: "rgba(0,0,0,0.75)", color: "#fff",
        borderRadius: "10px", padding: "6px 10px",
        fontSize: "11px", backdropFilter: "blur(4px)"
    });

    const btn = document.createElement("button");
    btn.id = "spotify-ignore-btn";
    btn.innerText = "Ignore";
    Object.assign(btn.style, {
        padding: "10px 18px", background: "#b45309",
        color: "#fff", border: "none", borderRadius: "20px",
        cursor: "pointer", fontSize: "14px", fontWeight: "600"
    });

    btn.onclick = async () => {
        if (window.currentTrackIgnored) return;
        btn.innerText = "Working...";
        btn.style.cursor = "default";
        const ok = await ignoreCurrentTrack();
        btn.innerText = ok ? "Ignored \u2713" : "Failed";
        setTimeout(() => { btn.innerText = "Ignore"; updateStatusPanel(); }, 2000);
    };

    const changeUser = document.createElement("button");
    changeUser.id = "spoti-ignore-change-user";
    changeUser.textContent = "\u2699 Change account";
    changeUser.title = "Change your Spotify User ID";
    Object.assign(changeUser.style, {
        background: "transparent", border: "none",
        color: "#888", fontSize: "11px", cursor: "pointer",
        padding: "2px 4px", textDecoration: "underline"
    });
    changeUser.onmouseenter = () => { changeUser.style.color = "#fff"; };
    changeUser.onmouseleave = () => { changeUser.style.color = "#888"; };
    changeUser.onclick = async () => {
        const current = getStoredSpotifyUserId();
        const newId = await showUserIdModal({ mode: "reset", prefill: current || "" });
        if (newId) {
            window.currentTrackIgnored = undefined;
            refreshIgnoredState();
            updateStatusPanel();
        }
    };

    wrapper.appendChild(status);
    wrapper.appendChild(btn);
    document.body.appendChild(wrapper);
    updateStatusPanel();
}

// ============================================================
//  KEYBOARD SHORTCUT  (Shift + X)
// ============================================================

document.addEventListener("keydown", async (e) => {
    if (e.shiftKey && e.key.toLowerCase() === "x") {
        if (window.currentTrackIgnored) return;
        const btn = document.getElementById("spotify-ignore-btn");
        if (btn) { btn.innerText = "Working..."; btn.style.cursor = "default"; }
        const ok = await ignoreCurrentTrack();
        if (btn) {
            btn.innerText = ok ? "Ignored \u2713" : "Failed";
            setTimeout(() => { btn.innerText = "Ignore"; updateStatusPanel(); }, 2000);
        }
    }
});

// ============================================================
//  INIT
// ============================================================

// Show onboarding modal if no stored user ID, but wait for DOM to settle first.
setTimeout(async () => {
    if (!getStoredSpotifyUserId()) {
        const urlId = extractUserIdFromURL();
        if (urlId) {
            setStoredSpotifyUserId(urlId);
            dbg("User ID auto-captured on load:", urlId);
        } else {
            await showUserIdModal({ mode: "onboarding" });
        }
    }
}, 1500);

setInterval(() => {
    if (!document.getElementById("spoti-ignore-wrapper")) {
        injectButton();
    } else {
        const domUri = extractTrackUriFromDOM();
        if (domUri && domUri !== window.currentTrackUri) {
            window.currentTrackUri = domUri;
            window.currentTrackIgnored = undefined;
            dbg("Track changed (interval):", domUri);
            refreshIgnoredState();
        }
        updateStatusPanel();
    }
}, 2000);
