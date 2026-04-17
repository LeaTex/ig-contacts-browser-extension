(() => {
    const contacts_cache_key = "igFollowersContactsCache";
    const panelId = "igc-panel";
    const iconUrl = chrome.runtime.getURL("./assets/no-avatar.jpg");

    let panel = null;
    let contactsList = null;
    let statusLabel = null;
    let loadButton = null;
    let allContacts = [];
    let filters = {
        followersIFollow: true,
        followersIDontFollow: true,
        followingDontFollowsMe: true
    };

    function normalizeProfilePicUrl(url) {
        if (typeof url !== "string") {
            return "";
        }

        return url.replace(/\\u0026/g, "&").replace(/\u0026/g, "&");
    }

    function createContactItem(user) {
        const contactItem = document.createElement("div");
        contactItem.className = "igc-contact-item";

        const avatar = document.createElement("img");
        avatar.className = "igc-avatar";
        avatar.alt = user.full_name || user.username || "Instagram user";
        avatar.referrerPolicy = "no-referrer";
        avatar.crossOrigin = "anonymous";
        avatar.loading = "lazy";
        avatar.src = normalizeProfilePicUrl(user.profile_pic_url) || iconUrl;

        const contactInfo = document.createElement("div");
        contactInfo.className = "igc-contact-info";

        const nameRow = document.createElement("div");
        nameRow.className = "igc-name-row";

        const fullName = document.createElement("span");
        fullName.className = "igc-full-name";
        fullName.textContent = user.full_name || user.username || "Unknown";
        nameRow.appendChild(fullName);

        if (user.is_verified) {
            const verified = document.createElement("span");
            verified.className = "igc-verified";
            verified.textContent = "✔";
            nameRow.appendChild(verified);
        }

        if (user.is_private) {
            const privateBadge = document.createElement("span");
            privateBadge.className = "igc-grey-badge";
            privateBadge.textContent = "Private";
            nameRow.appendChild(privateBadge);
        }

        const usernameLink = document.createElement("a");
        usernameLink.className = "igc-username";
        usernameLink.target = "_blank";
        usernameLink.rel = "noopener noreferrer";
        usernameLink.href = `https://www.instagram.com/${user.username}`;
        usernameLink.textContent = `@${user.username}`;

        contactInfo.appendChild(nameRow);
        contactInfo.appendChild(usernameLink);

        const statusBadges = document.createElement("div");
        statusBadges.className = "igc-status-badges";

        const followerBadge = document.createElement("span");
        followerBadge.className = user.is_follower ? "igc-green-badge" : "igc-translucent-red-badge";
        followerBadge.textContent = "Follower";
        statusBadges.appendChild(followerBadge);

        const followingBadge = document.createElement("span");
        followingBadge.className = user.is_following ? "igc-green-badge" : "igc-translucent-red-badge";
        followingBadge.textContent = "Following";
        statusBadges.appendChild(followingBadge);

        contactItem.appendChild(avatar);
        contactItem.appendChild(contactInfo);
        contactItem.appendChild(statusBadges);

        return contactItem;
    }

    function renderContacts(users) {
        if (!contactsList) {
            return;
        }

        contactsList.innerHTML = "";

        if (!Array.isArray(users) || users.length === 0) {
            const emptyState = document.createElement("p");
            emptyState.className = "igc-empty";
            emptyState.textContent = "No contacts loaded yet.";
            contactsList.appendChild(emptyState);
            return;
        }

        // Apply filters
        const filteredUsers = users.filter(user => {
            const isFollower = user.is_follower || false;
            const isFollowing = user.is_following || false;

            // If all filters are off, show nothing
            if (!filters.followersIFollow && !filters.followersIDontFollow && !filters.followingDontFollowsMe) {
                console.log("1");
                return false;
            }

            // If all filters are on, show all
            if (filters.followersIFollow && filters.followersIDontFollow && filters.followingDontFollowsMe) {
                console.log("2");
                return true;
            }

            if (filters.followersIFollow && isFollower && isFollowing) {
                console.log("3");
                return true;
            }

            if (filters.followersIDontFollow && isFollower && !isFollowing) {
                console.log("4");
                return true;
            }

            if (filters.followingDontFollowsMe && !isFollower && isFollowing) {
                console.log("5");
                return true;
            }
            console.log("6");
            return false;
        });

        if (filteredUsers.length === 0) {
            const emptyState = document.createElement("p");
            emptyState.className = "igc-empty";
            emptyState.textContent = "No contacts match the selected filters.";
            contactsList.appendChild(emptyState);
            return;
        }

        const fragment = document.createDocumentFragment();

        filteredUsers.forEach((user) => {
            fragment.appendChild(createContactItem(user));
        });

        contactsList.appendChild(fragment);
    }

    function loadCachedContacts() {
        chrome.storage.local.get(contacts_cache_key, (result) => {
            if (chrome.runtime.lastError) {
                return;
            }

            const cachedUsers = result?.[contacts_cache_key];
            if (Array.isArray(cachedUsers)) {
                allContacts = cachedUsers;
                renderContacts(cachedUsers);
            }
        });
    }

    function saveCachedContacts(users) {
        if (!Array.isArray(users)) {
            return;
        }

        chrome.storage.local.set({ [contacts_cache_key]: users });
    }

    function setStatus(text, type) {
        if (!statusLabel) {
            return;
        }

        statusLabel.textContent = text;
        statusLabel.classList.remove("igc-status-loading", "igc-status-success", "igc-status-error");

        if (type) {
            statusLabel.classList.add(type);
        }
    }

    function applyStatus(status) {
        if (!status || !status.state) {
            setStatus("Idle", "");
            if (loadButton) {
                loadButton.disabled = false;
            }
            return;
        }

        if (status.state === "loading") {
            setStatus(status.message || "Loading...", "igc-status-loading");
            if (loadButton) {
                loadButton.disabled = true;
            }
            return;
        }

        if (status.state === "success") {
            setStatus(status.message || "Finished.", "igc-status-success");
            if (loadButton) {
                loadButton.disabled = false;
            }
            return;
        }

        if (status.state === "error") {
            setStatus(`Error: ${status.message || "Unknown error"}`, "igc-status-error");
            if (loadButton) {
                loadButton.disabled = false;
            }
            return;
        }

        setStatus("Idle", "");
        if (loadButton) {
            loadButton.disabled = false;
        }
    }

    function loadContacts() {
        setStatus("Loading...", "igc-status-loading");
        if (loadButton) {
            loadButton.disabled = true;
        }

        chrome.runtime.sendMessage({ action: "loadContacts" }, (response) => {
            if (loadButton) {
                loadButton.disabled = false;
            }

            if (chrome.runtime.lastError) {
                setStatus(`Error: ${chrome.runtime.lastError.message}`, "igc-status-error");
                return;
            }

            if (!response) {
                setStatus("Error: no response from background worker", "igc-status-error");
                return;
            }

            if (response.ok) {
                allContacts = response.users;
                saveCachedContacts(response.users);
                renderContacts(response.users);
                applyStatus({
                    state: "success",
                    message: `Finished. Loaded ${response.total} contacts.`
                });
                return;
            }

            applyStatus({ state: "error", message: response.error || "Unknown error" });
        });
    }

    function ensurePanel() {
        if (panel) {
            return panel;
        }

        panel = document.createElement("aside");
        panel.id = panelId;
        panel.className = "igc-panel igc-hidden";

        panel.innerHTML = `
            <div class="igc-header">
                <h2 class="igc-title">IG Contacts</h2>
                <button type="button" class="igc-close" aria-label="Close panel">×</button>
            </div>
            <button type="button" class="igc-btn" id="igc-load-btn">Load contacts</button>
            <div class="igc-filters">
                <div class="igc-filter-group">
                    <label class="igc-filter-checkbox">
                        <input type="checkbox" id="filter-followers-ifollow" checked>
                        <span>Followers I follow</span>
                    </label>
                    <label class="igc-filter-checkbox">
                        <input type="checkbox" id="filter-followers-idontfollow" checked>
                        <span>Followers I don't follow</span>
                    </label>
                    <label class="igc-filter-checkbox">
                        <input type="checkbox" id="filter-following-dontfollowsme" checked>
                        <span>I follow but they don't follow me</span>
                    </label>
                </div>
            </div>
            <p id="igc-status" class="igc-status-label">Idle</p>
            <div id="igc-contacts" class="igc-contacts-list"></div>
        `;

        document.body.appendChild(panel);

        contactsList = panel.querySelector("#igc-contacts");
        statusLabel = panel.querySelector("#igc-status");
        loadButton = panel.querySelector("#igc-load-btn");

        // Set up filter listeners
        const followersIFollowCheckbox = panel.querySelector("#filter-followers-ifollow");
        const followersIDontFollowCheckbox = panel.querySelector("#filter-followers-idontfollow");
        const followingDontFollowsMeCheckbox = panel.querySelector("#filter-following-dontfollowsme");

        followersIFollowCheckbox.addEventListener("change", (e) => {
            filters.followersIFollow = e.target.checked;
            renderContacts(allContacts);
        });

        followersIDontFollowCheckbox.addEventListener("change", (e) => {
            filters.followersIDontFollow = e.target.checked;
            renderContacts(allContacts);
        });

        followingDontFollowsMeCheckbox.addEventListener("change", (e) => {
            filters.followingDontFollowsMe = e.target.checked;
            renderContacts(allContacts);
        });

        panel.querySelector(".igc-close").addEventListener("click", () => {
            panel.classList.add("igc-hidden");
        });

        loadButton.addEventListener("click", loadContacts);

        chrome.runtime.sendMessage({ action: "getLoaderStatus" }, (response) => {
            if (chrome.runtime.lastError || !response?.ok) {
                setStatus("Idle", "");
                return;
            }

            applyStatus(response.status);
        });

        loadCachedContacts();
        return panel;
    }

    function togglePanel(forceOpen = false) {
        const sidebar = ensurePanel();
        if (forceOpen) {
            sidebar.classList.remove("igc-hidden");
            return;
        }

        sidebar.classList.toggle("igc-hidden");
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request?.action === "toggleInPagePanel") {
            togglePanel();
            sendResponse({ ok: true });
            return true;
        }

        return false;
    });
})();
