// HabitForge Session Management

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

function getLoggedInUser() {
    try {
        const savedUser =
            localStorage.getItem("habitforgeUser");

        if (!savedUser) {
            return null;
        }

        return JSON.parse(savedUser);

    } catch (error) {

        console.error(
            "Invalid user session:",
            error
        );

        return null;
    }
}


function updateActivity() {

    const user = getLoggedInUser();

    // If the user is not logged in,
    // do nothing.
    if (!user) {
        return;
    }

    localStorage.setItem(
        "habitforgeLastActivity",
        Date.now().toString()
    );
}


function checkSession() {

    const user = getLoggedInUser();

    // No logged-in user
    if (!user) {
        return;
    }

    let lastActivity =
        localStorage.getItem(
            "habitforgeLastActivity"
        );

    // First time using the session system
    if (!lastActivity) {

        localStorage.setItem(
            "habitforgeLastActivity",
            Date.now().toString()
        );

        return;
    }

    const inactiveTime =
        Date.now() - Number(lastActivity);

    if (inactiveTime >= SESSION_TIMEOUT) {

        localStorage.removeItem(
            "habitforgeUser"
        );

        localStorage.removeItem(
            "habitforgeLastActivity"
        );

        alert(
            "Your session has expired. Please login again."
        );

        window.location.href =
            "login.html";
    }
}


// Update activity when the user interacts
document.addEventListener(
    "click",
    updateActivity
);

document.addEventListener(
    "keydown",
    updateActivity
);

document.addEventListener(
    "scroll",
    updateActivity
);


// Initialize session safely
if (getLoggedInUser()) {

    const existingActivity =
        localStorage.getItem(
            "habitforgeLastActivity"
        );

    if (!existingActivity) {

        localStorage.setItem(
            "habitforgeLastActivity",
            Date.now().toString()
        );
    }

    setInterval(
        checkSession,
        60 * 1000
    );
}