(function() {
    function extractBearerToken() {
        let token = null;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.toLowerCase().includes('access')) {
                    const val = localStorage.getItem(key);
                    if (val && val.match(/Bearer [A-Za-z0-9\-_\.]+/)) {
                        token = val.match(/Bearer ([A-Za-z0-9\-_\.]+)/)[1];
                        break;
                    }
                    if (val && val.length > 100 && val.match(/^[A-Za-z0-9\-_\.]+$/)) {
                        token = val;
                        break;
                    }
                }
            }
        } catch (e) {}
        if (!token) {
            try {
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key && key.toLowerCase().includes('access')) {
                        const val = sessionStorage.getItem(key);
                        if (val && val.match(/Bearer [A-Za-z0-9\-_\.]+/)) {
                            token = val.match(/Bearer ([A-Za-z0-9\-_\.]+)/)[1];
                            break;
                        }
                        if (val && val.length > 100 && val.match(/^[A-Za-z0-9\-_\.]+$/)) {
                            token = val;
                            break;
                        }
                    }
                }
            } catch (e) {}
        }
        return token;
    }

    function extractClientToken() {
        let token = null;
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.toLowerCase().includes('client')) {
                    const val = localStorage.getItem(key);
                    if (val && val.length > 100 && val.match(/^[A-Za-z0-9\-\/\+\.\=]+$/)) {
                        token = val;
                        break;
                    }
                }
            }
        } catch (e) {}
        if (!token) {
            try {
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key && key.toLowerCase().includes('client')) {
                        const val = sessionStorage.getItem(key);
                        if (val && val.length > 100 && val.match(/^[A-Za-z0-9\-\/\+\.\=]+$/)) {
                            token = val;
                            break;
                        }
                    }
                }
            } catch (e) {}
        }
        return token;
    }

    const bearer = extractBearerToken();
    const client = extractClientToken();
    window.dispatchEvent(new CustomEvent('spoti-dislike-tokens', { detail: { bearer, client } }));
})();