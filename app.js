import {
  auth,
  sendOTP,
  verifyOTP,
  saveProfile,
  getProfile,
  searchByPhone,
  searchByFacebook,
  updateProfile
} from "./firebase.js";

const PENDING_KEY = "loveroyality_pending_profile";

function normalizePhone(phone) {
  return phone.replace(/[^\d+]/g, "");
}

function normalizeFacebookUrl(url) {
  try {
    const parsed = new URL(url.trim());

    let host = parsed.hostname.toLowerCase();

    if (host === "www.facebook.com") {
      host = "facebook.com";
    }

    if (host !== "facebook.com" && host !== "m.facebook.com") {
      return "";
    }

    let path = parsed.pathname.replace(/\/+$/, "");

    return `https://${host}${path}`.toLowerCase();
  } catch {
    return "";
  }
}

function showMessage(message, type = "info") {
  const oldMessage = document.querySelector(".app-message");

  if (oldMessage) {
    oldMessage.remove();
  }

  const box = document.createElement("div");
  box.className = `app-message ${type}`;
  box.textContent = message;

  document.body.prepend(box);

  setTimeout(() => {
    box.remove();
  }, 4500);
}

function getPendingProfile() {
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY));
  } catch {
    return null;
  }
}

function clearPendingProfile() {
  localStorage.removeItem(PENDING_KEY);
}

function savePendingProfile(data) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(data));
}

async function handleRegistration() {
  const form = document.querySelector("#registerForm");

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const fullName = document.querySelector("#fullName")?.value.trim();
    const username = document.querySelector("#username")?.value.trim();
    const phone = document.querySelector("#phoneNumber")?.value.trim();
    const facebook = document.querySelector("#facebookUrl")?.value.trim();
    const password = document.querySelector("#password")?.value;
    const privacy = document.querySelector("#privacyAgree")?.checked;

    if (!fullName || !username || !phone) {
      showMessage("Please complete all required fields.", "error");
      return;
    }

    if (!privacy) {
      showMessage(
        "Please accept the public profile and privacy agreement.",
        "error"
      );
      return;
    }

    if (password && password.length < 8) {
      showMessage(
        "Password must contain at least 8 characters.",
        "error"
      );
      return;
    }

    let facebookNormalized = "";

    if (facebook) {
      facebookNormalized = normalizeFacebookUrl(facebook);

      if (!facebookNormalized) {
        showMessage("Please enter a valid Facebook profile URL.", "error");
        return;
      }
    }

    const phoneNormalized = normalizePhone(phone);

    const profileData = {
      fullName,
      username,
      phone,
      phoneNormalized,
      facebookUrl: facebook || "",
      facebookUrlNormalized: facebookNormalized,
      publicSearch: true,
      passwordSet: Boolean(password)
    };

    savePendingProfile(profileData);

    try {
      await sendOTP(phoneNormalized);

      sessionStorage.setItem("loveroyality_otp_mode", "register");

      showMessage(
        "OTP sent successfully. Complete phone verification.",
        "success"
      );

      window.location.href = "login.html?verify=1";
    } catch (error) {
      console.error(error);

      showMessage(
        error.message || "Unable to send OTP. Please try again.",
        "error"
      );
    }
  });
}

async function handleOTPVerification() {
  const otpForm = document.querySelector("#otpForm");

  if (!otpForm) return;

  otpForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const otp = document.querySelector("#otpCode")?.value.trim();

    if (!otp || otp.length < 6) {
      showMessage("Enter the 6-digit OTP.", "error");
      return;
    }

    try {
      const user = await verifyOTP(otp);
      const pendingProfile = getPendingProfile();

      if (!user) {
        throw new Error("Phone verification failed.");
      }

      if (pendingProfile) {
        await saveProfile(user.uid, {
          ...pendingProfile,
          phoneVerified: true
        });

        clearPendingProfile();
      }

      sessionStorage.removeItem("loveroyality_otp_mode");

      showMessage(
        "Phone verified successfully.",
        "success"
      );

      setTimeout(() => {
        window.location.href = `profile.html?uid=${encodeURIComponent(
          user.uid
        )}`;
      }, 800);
    } catch (error) {
      console.error(error);

      showMessage(
        error.message || "Invalid or expired OTP.",
        "error"
      );
    }
  });
}

async function handleProfilePage() {
  const profileContainer = document.querySelector("[data-profile]");

  if (!profileContainer) return;

  const params = new URLSearchParams(window.location.search);
  const uid = params.get("uid");

  if (!uid) {
    return;
  }

  try {
    const profile = await getProfile(uid);

    if (!profile) {
      showMessage("Profile not found.", "error");
      return;
    }

    const nameElement = document.querySelector("[data-profile-name]");
    const usernameElement = document.querySelector("[data-profile-username]");
    const facebookElement = document.querySelector("[data-profile-facebook]");
    const partnerElement = document.querySelector("[data-profile-partner]");

    if (nameElement) {
      nameElement.textContent = profile.fullName || "Loveroyality User";
    }

    if (usernameElement) {
      usernameElement.textContent = profile.username
        ? `@${profile.username}`
        : "";
    }

    if (partnerElement) {
      partnerElement.textContent =
        profile.partnerName || "Relationship information";
    }

    if (facebookElement) {
      if (profile.facebookUrl) {
        facebookElement.href = profile.facebookUrl;
        facebookElement.target = "_blank";
        facebookElement.rel = "noopener noreferrer";
      } else {
        facebookElement.style.display = "none";
      }
    }

    document.querySelectorAll("[data-verified]").forEach((element) => {
      element.textContent = profile.phoneVerified
        ? "Phone OTP Verified"
        : "Not Verified";
    });

    document.querySelectorAll("[data-status]").forEach((element) => {
      element.textContent =
        profile.profileStatus === "active"
          ? "Public & Verified"
          : "Inactive";
    });
  } catch (error) {
    console.error(error);
    showMessage("Unable to load this profile.", "error");
  }
}

async function handleSearch() {
  const form = document.querySelector("#searchForm");

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const type =
      document.querySelector("#searchType")?.value ||
      new URLSearchParams(window.location.search).get("type") ||
      "phone";

    const input = document.querySelector("#searchInput");
    const resultContainer = document.querySelector("#searchResult");

    if (!input || !resultContainer) return;

    const value = input.value.trim();

    if (!value) {
      showMessage("Enter a phone number or Facebook URL.", "error");
      return;
    }

    resultContainer.innerHTML =
      '<div class="search-loading">Searching verified profiles...</div>';

    try {
      let results = [];

      if (type === "facebook") {
        const normalized = normalizeFacebookUrl(value);

        if (!normalized) {
          throw new Error("Enter a valid Facebook profile URL.");
        }

        results = await searchByFacebook(normalized);
      } else {
        const normalized = normalizePhone(value);
        results = await searchByPhone(normalized);
      }

      if (!results.length) {
        resultContainer.innerHTML = `
          <div class="empty-result">
            <h3>No public profile found</h3>
            <p>
              No verified Loveroyality profile matching this information
              is currently available.
            </p>
          </div>
        `;
        return;
      }

      resultContainer.innerHTML = results
        .map((profile) => {
          const safeName = escapeHTML(
            profile.fullName || "Loveroyality User"
          );

          const safeUsername = escapeHTML(
            profile.username ? `@${profile.username}` : ""
          );

          const safePartner = escapeHTML(
            profile.partnerName || "Relationship information"
          );

          return `
            <div class="profile-result-card">
              <div class="result-avatar">
                ${safeName.charAt(0).toUpperCase()}
              </div>

              <div class="result-info">
                <h3>${safeName}</h3>
                <p>${safeUsername}</p>
                <span class="verified-result">
                  ✓ Phone Verified
                </span>
              </div>

              <div class="result-relationship">
                <small>Relationship</small>
                <strong>${safePartner}</strong>
              </div>

              <button
                class="view-profile-btn"
                data-profile-id="${escapeHTML(profile.uid)}"
              >
                View Profile
              </button>
            </div>
          `;
        })
        .join("");

      document
        .querySelectorAll(".view-profile-btn")
        .forEach((button) => {
          button.addEventListener("click", () => {
            const profileId = button.dataset.profileId;

            window.location.href =
              `profile.html?uid=${encodeURIComponent(profileId)}`;
          });
        });
    } catch (error) {
      console.error(error);

      resultContainer.innerHTML = `
        <div class="empty-result">
          <h3>Search failed</h3>
          <p>${escapeHTML(
            error.message || "Please try again later."
          )}</p>
        </div>
      `;
    }
  });
}

async function handleEditProfile() {
  const button = document.querySelector("#editProfileBtn");

  if (!button) return;

  button.addEventListener("click", async () => {
    if (!auth.currentUser) {
      window.location.href = "login.html";
      return;
    }

    showMessage(
      "Profile editing requires phone OTP verification.",
      "info"
    );
  });
}

async function handleRelationshipChange() {
  const button = document.querySelector("#changeRelationshipBtn");

  if (!button) return;

  button.addEventListener("click", async () => {
    if (!auth.currentUser) {
      window.location.href = "login.html";
      return;
    }

    showMessage(
      "Changing a relationship requires OTP verification and consent from both people.",
      "info"
    );
  });
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initializeSearchFromURL() {
  const params = new URLSearchParams(window.location.search);

  const type = params.get("type");
  const queryValue = params.get("q");

  const searchType = document.querySelector("#searchType");
  const searchInput = document.querySelector("#searchInput");

  if (searchType && type) {
    searchType.value = type;
  }

  if (searchInput && queryValue) {
    searchInput.value = queryValue;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  handleRegistration();
  handleOTPVerification();
  handleProfilePage();
  handleSearch();
  handleEditProfile();
  handleRelationshipChange();
  initializeSearchFromURL();
});
