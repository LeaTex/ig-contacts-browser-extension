let csrftoken = "";
let ds_user_id = "";
const ig_app_id = "936619743392459";
let max_id = "";
let count = 25;  // looks like 25 is the max allowed by Instagram for this endpoint, even if you specify a higher number
let followers = null;
const ig_loader_status_key = "igLoaderStatus";

async function setLoaderStatus(state) {
  await chrome.storage.local.set({
    [ig_loader_status_key]: {
      ...state,
      updated_at: Date.now()
    }
  });
}

async function getLoaderStatus() {
  const data = await chrome.storage.local.get(ig_loader_status_key);
  return data[ig_loader_status_key] || null;
}

function delay() {
  const seconds_to_wait = Math.floor(Math.random() * 8) + 5;
  return new Promise((resolve) => setTimeout(resolve, seconds_to_wait * 1000));
}

async function getCookieValue(name) {
  const cookie = await chrome.cookies.get({
    url: "https://www.instagram.com",
    name
  });

  return cookie ? cookie.value : "";
};

async function loadAllContacts() {
  const contactsById = new Map();

  const upsertContact = (user, relationshipField) => {
    const id = user.pk;
    const existing = contactsById.get(id) || {};

    contactsById.set(id, {
      ...existing,
      id,
      username: user.username,
      full_name: user.full_name,
      profile_pic_url: user.profile_pic_url,
      is_verified: user.is_verified,
      is_private: user.is_private,
      [relationshipField]: true
    });
  };

  const followerUsers = await loadAllFollowers();
  followerUsers.forEach((user) => upsertContact(user, "is_follower"));

  const followingUsers = await loadAllFollowing();
  followingUsers.forEach((user) => upsertContact(user, "is_following"));

  const allContacts = Array.from(contactsById.values());

  allContacts.sort((a, b) => {
    const nameA = (a?.full_name || a?.username || "").trim();
    const nameB = (b?.full_name || b?.username || "").trim();
    return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
  });

  return allContacts;
}

async function loadAllFollowers() {

  csrftoken = await getCookieValue("csrftoken");
  ds_user_id = await getCookieValue("ds_user_id");

  if (!csrftoken || !ds_user_id) {
    throw new Error("Missing required Instagram cookies: csrftoken or ds_user_id");
  }

  const allFollowers = [];
  max_id = "";

  do {
    await delay();

    const requestUrl = `https://www.instagram.com/api/v1/friendships/${ds_user_id}/followers/?count=${count}&max_id=${max_id}`;

    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        "accept": "*/*",
        "x-csrftoken": csrftoken,
        "x-ig-app-id": ig_app_id,
        "x-requested-with": "XMLHttpRequest"
      },
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(`Followers request failed: ${response.status} ${response.statusText}`);
    }

    followers = await response.json();

    if (Array.isArray(followers.users)) {
      allFollowers.push(...followers.users);
    }

    max_id = followers.next_max_id || "";
  } while (max_id);

  return allFollowers;
}

async function loadAllFollowing() {

  csrftoken = await getCookieValue("csrftoken");
  ds_user_id = await getCookieValue("ds_user_id");

  if (!csrftoken || !ds_user_id) {
    throw new Error("Missing required Instagram cookies: csrftoken or ds_user_id");
  }

  const allFollowing = [];
  max_id = "";

  do {
    await delay();

    const requestUrl = `https://www.instagram.com/api/v1/friendships/${ds_user_id}/following/?count=${count}&max_id=${max_id}`;

    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        "accept": "*/*",
        "x-csrftoken": csrftoken,
        "x-ig-app-id": ig_app_id,
        "x-requested-with": "XMLHttpRequest"
      },
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(`Following request failed: ${response.status} ${response.statusText}`);
    }

    following = await response.json();

    if (Array.isArray(following.users)) {
      allFollowing.push(...following.users);
    }

    max_id = following.next_max_id || "";
  } while (max_id);

  return allFollowing;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === "getLoaderStatus") {
    getLoaderStatus()
      .then((status) => sendResponse({ ok: true, status }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message?.action !== "loadContacts") {
    return;
  }

  setLoaderStatus({ state: "loading", message: "Loading..." }).catch(() => {
    // Ignore status persistence failures and continue loading contacts.
  });

  loadAllContacts()
    .then((users) => {
      setLoaderStatus({
        state: "success",
        message: `Finished. Loaded ${users.length} contacts.`,
        total: users.length
      }).catch(() => {
        // Ignore status persistence failures.
      });
      console.log("Finished loading contacts");
      sendResponse({ ok: true, users, total: users.length });
    })
    .catch((error) => {
      setLoaderStatus({ state: "error", message: error.message }).catch(() => {
        // Ignore status persistence failures.
      });

      sendResponse({ ok: false, error: error.message });
    });

  return true;
});
