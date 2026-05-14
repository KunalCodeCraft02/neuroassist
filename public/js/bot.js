(function () {

    console.log("🤖 BOT JS LOADED");

    // =========================
    // SCRIPT CONFIG
    // =========================

    const script =
        document.currentScript ||
        document.querySelector('script[data-bot]');

    if (!script) {
        console.error("❌ Bot script not found");
        return;
    }

    const botId =
        script.getAttribute("data-bot");

    const botName =
        script.getAttribute("data-name") ||
        "Assistant";

    const token =
        script.getAttribute("data-token");

    // Allow explicit API URL override via data-api attribute
    // Falls back to script origin (for production embedding)
    const API =
        script.getAttribute("data-api") ||
        new URL(script.src).origin;

    console.log("✅ BOT ID:", botId);
    console.log("✅ API:", API);

    if (!botId) {
        console.error("❌ Missing botId");
        return;
    }

    // =========================
    // LOAD FONT
    // =========================

    const font = document.createElement("link");

    font.href =
        "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap";

    font.rel = "stylesheet";

    document.head.appendChild(font);

    // =========================
    // BUTTON WRAPPER
    // =========================

    const buttonWrapper =
        document.createElement("div");

    buttonWrapper.style.position = "fixed";
    buttonWrapper.style.bottom = "20px";
    buttonWrapper.style.right = "20px";
    buttonWrapper.style.display = "flex";
    buttonWrapper.style.flexDirection = "column";
    buttonWrapper.style.alignItems = "center";
    buttonWrapper.style.zIndex = "999999";

    document.body.appendChild(buttonWrapper);

    // =========================
    // CHAT BUTTON
    // =========================

    const bubble =
        document.createElement("div");

    bubble.innerHTML = "💬";

    bubble.style.width = "60px";
    bubble.style.height = "60px";
    bubble.style.background = "#000";
    bubble.style.color = "#fff";
    bubble.style.display = "flex";
    bubble.style.alignItems = "center";
    bubble.style.justifyContent = "center";
    bubble.style.borderRadius = "50%";
    bubble.style.cursor = "pointer";
    bubble.style.fontSize = "24px";
    bubble.style.boxShadow =
        "0 10px 25px rgba(0,0,0,0.25)";

    buttonWrapper.appendChild(bubble);

    // =========================
    // BOT NAME
    // =========================

    const nameLabel =
        document.createElement("div");

    nameLabel.innerText = botName;

    nameLabel.style.marginTop = "6px";
    nameLabel.style.fontSize = "12px";
    nameLabel.style.fontFamily = "Inter";
    nameLabel.style.color = "#333";

    buttonWrapper.appendChild(nameLabel);

    // =========================
    // CHAT WINDOW
    // =========================

    const chat =
        document.createElement("div");

    chat.style.position = "fixed";
    chat.style.bottom = "100px";
    chat.style.right = "20px";
    chat.style.width = "340px";
    chat.style.height = "480px";
    chat.style.background = "#fff";
    chat.style.borderRadius = "16px";
    chat.style.boxShadow =
        "0 20px 60px rgba(0,0,0,0.25)";
    chat.style.display = "none";
    chat.style.flexDirection = "column";
    chat.style.fontFamily = "Inter";
    chat.style.overflow = "hidden";
    chat.style.zIndex = "999999";

    // MOBILE
    if (window.innerWidth < 500) {

        chat.style.width = "95vw";
        chat.style.height = "80vh";
        chat.style.right = "2.5vw";
    }

    chat.innerHTML = `

<div style="
background:#000;
color:#fff;
padding:14px;
font-weight:600;
font-size:14px;
display:flex;
justify-content:space-between;
align-items:center;
">

<span>${botName}</span>

<span id="closeBot"
style="
cursor:pointer;
font-size:18px;
">
✕
</span>

</div>

<div id="messages"
style="
flex:1;
padding:12px;
overflow-y:auto;
background:#f6f6f6;
display:flex;
flex-direction:column;
gap:8px;
">
</div>

<div style="
display:flex;
padding:10px;
border-top:1px solid #eee;
background:#fff;
">

<input
id="msgInput"
placeholder="Type message..."
style="
flex:1;
border:1px solid #ddd;
border-radius:10px;
padding:10px;
font-size:13px;
outline:none;
">

<button
id="sendBtn"
style="
margin-left:8px;
background:#000;
color:#fff;
border:none;
padding:10px 14px;
border-radius:10px;
cursor:pointer;
font-size:13px;
">
Send
</button>

</div>
`;

    document.body.appendChild(chat);

    // =========================
    // USER SESSION
    // =========================

    const userId =
        localStorage.getItem("uid") ||
        `user_${Date.now()}`;

    localStorage.setItem("uid", userId);

    // =========================
    // TRACKING
    // =========================

    async function track(action) {

        try {

            await fetch(`${API}/track`, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },

                body: JSON.stringify({
                    botId,
                    token,
                    userId,
                    page: window.location.href,
                    action
                })
            });

        } catch (err) {

            console.log("Track error:", err);
        }
    }

    track("view");

    document.addEventListener("click", () => {
        track("click");
    });

    // =========================
    // AUTO ANALYZE
    // =========================

    setTimeout(async () => {

        try {

            const res =
                await fetch(
                    `${API}/analyze?botId=${botId}&userId=${userId}&token=${token}`
                );

            const data = await res.json();

            console.log("USER STATUS:", data);

            if (data.status === "HOT") {

                chat.style.display = "flex";

                addBotMessage(
                    "🔥 Looks like you're interested! Need help?"
                );
            }

        } catch (err) {

            console.log("Analyze error:", err);
        }

    }, 5000);

    // =========================
    // OPEN / CLOSE
    // =========================

    bubble.onclick = () => {

        chat.style.display =
            chat.style.display === "none"
                ? "flex"
                : "none";
    };

    document.addEventListener("click", (e) => {

        if (e.target.id === "closeBot") {
            chat.style.display = "none";
        }
    });

    // =========================
    // MESSAGE HELPERS
    // =========================

    function addUserMessage(text) {

        const messages =
            document.getElementById("messages");

        if (!messages) return;

        const row =
            document.createElement("div");

        row.style.display = "flex";
        row.style.justifyContent = "flex-end";

        const bubble =
            document.createElement("div");

        bubble.innerText = text;

        bubble.style.background = "#e9e9e9";
        bubble.style.padding = "10px 14px";
        bubble.style.borderRadius = "14px";
        bubble.style.fontSize = "13px";
        bubble.style.maxWidth = "75%";
        bubble.style.wordWrap = "break-word";

        row.appendChild(bubble);

        messages.appendChild(row);

        messages.scrollTop =
            messages.scrollHeight;
    }

    function addBotMessage(text) {

        const messages =
            document.getElementById("messages");

        if (!messages) return;

        const row =
            document.createElement("div");

        row.style.display = "flex";
        row.style.justifyContent = "flex-start";

        const bubble =
            document.createElement("div");

        bubble.innerText = text;

        bubble.style.background = "#dff6e4";
        bubble.style.padding = "10px 14px";
        bubble.style.borderRadius = "14px";
        bubble.style.fontSize = "13px";
        bubble.style.maxWidth = "75%";
        bubble.style.wordWrap = "break-word";

        row.appendChild(bubble);

        messages.appendChild(row);

        messages.scrollTop =
            messages.scrollHeight;
    }

    // =========================
    // SEND MESSAGE
    // =========================

    async function sendMessage() {

        const input =
            document.getElementById("msgInput");

        if (!input) return;

        const message =
            input.value.trim();

        if (!message) return;

        input.value = "";

        addUserMessage(message);

        const messages =
            document.getElementById("messages");

        const typing =
            document.createElement("div");

        typing.innerText = "Typing...";

        typing.style.fontSize = "12px";
        typing.style.color = "#777";

        messages.appendChild(typing);

        messages.scrollTop =
            messages.scrollHeight;

        try {

            const res =
                await fetch(`${API}/chat`, {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        botId,
                        token,
                        message
                    })

                });

            // Handle non-JSON responses (e.g., HTML error pages)
            const contentType = res.headers.get("content-type") || "";
            if (!contentType.includes("application/json")) {
                const text = await res.text();
                console.error("Chat non-JSON response:", res.status, text);
                typing.remove();
                addBotMessage(
                    `⚠️ Server error (${res.status}). Please try again.`
                );
                return;
            }

            const data = await res.json();

            typing.remove();

            if (data.error) {
                console.warn("Chat API error:", data.error);
                addBotMessage(
                    `⚠️ ${data.message || "Server error. Please try again."}`
                );
            } else {
                addBotMessage(
                    data.reply ||
                    "No response received."
                );
            }

        } catch (err) {

            console.error("Chat fetch error:", err);

            typing.remove();

            addBotMessage(
                "⚠️ Network error. Please check your connection."
            );
        }
    }

    // SEND BUTTON
    document.addEventListener("click", (e) => {

        if (e.target.id === "sendBtn") {
            sendMessage();
        }
    });

    // ENTER KEY
    document.addEventListener("keypress", (e) => {

        if (e.key === "Enter") {

            const active =
                document.activeElement;

            if (
                active &&
                active.id === "msgInput"
            ) {
                sendMessage();
            }
        }
    });

})();