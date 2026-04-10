async function getActiveTabId() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0]?.id ?? null;
}

async function execOnPage(func, args = []) {
    const tabId = await getActiveTabId();
    if (tabId === null) return undefined;
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId },
            func,
            args,
            world: "MAIN"
        });
        return results?.[0]?.result;
    } catch (_) {
        return undefined;
    }
}

async function init() {
    // Try to inject — if this fails the tab is not on open.spotify.com
    const state = await execOnPage(() => ({
        userId: localStorage.getItem("spoti-ignore-userid"),
        debug:  localStorage.getItem("spoti-ignore-debug") === "true"
    }));

    if (state === undefined) {
        document.getElementById("not-spotify").style.display = "block";
        return;
    }

    document.getElementById("main-ui").style.display = "block";

    const display = document.getElementById("userid-display");

    function renderUserId(id) {
        if (id) {
            display.textContent = id;
            display.classList.remove("not-set");
        } else {
            display.textContent = "No account set";
            display.classList.add("not-set");
        }
    }

    renderUserId(state.userId);
    document.getElementById("debug-toggle").checked = state.debug;

    // Change account — opens the in-page modal and closes the popup
    document.getElementById("btn-change").onclick = async () => {
        await execOnPage(() => {
            if (typeof window.spotiIgnoreOpenModal === "function") {
                window.spotiIgnoreOpenModal({ mode: "reset" });
            }
        });
        window.close();
    };

    // Clear account — removes the stored ID and reloads the Spotify tab
    document.getElementById("btn-clear").onclick = async () => {
        await execOnPage(() => localStorage.removeItem("spoti-ignore-userid"));
        // Reload the Spotify tab so the setup modal appears fresh
        await execOnPage(() => window.location.reload());
        window.close();
    };

    // Debug toggle
    document.getElementById("debug-toggle").onchange = async (e) => {
        await execOnPage(
            (v) => localStorage.setItem("spoti-ignore-debug", v),
            [e.target.checked ? "true" : "false"]
        );
    };
}

init();
