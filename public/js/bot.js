(function () {

    const script = document.currentScript
    const botId = script.getAttribute("data-bot")
    const botName = script.getAttribute("data-name") || "Assistant"

    /* FONT */

    const font = document.createElement("link")
    font.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap"
    font.rel = "stylesheet"
    document.head.appendChild(font)

    /* CHAT BUTTON CONTAINER */

    const buttonWrapper = document.createElement("div")
    buttonWrapper.style.position = "fixed"
    buttonWrapper.style.bottom = "20px"
    buttonWrapper.style.right = "20px"
    buttonWrapper.style.display = "flex"
    buttonWrapper.style.flexDirection = "column"
    buttonWrapper.style.alignItems = "center"
    buttonWrapper.style.zIndex = "9999"

    document.body.appendChild(buttonWrapper)

    /* CHAT BUBBLE */

    const bubble = document.createElement("div")

    bubble.innerHTML = "💬"

    bubble.style.width = "60px"
    bubble.style.height = "60px"
    bubble.style.background = "#000"
    bubble.style.color = "#fff"
    bubble.style.display = "flex"
    bubble.style.alignItems = "center"
    bubble.style.justifyContent = "center"
    bubble.style.borderRadius = "50%"
    bubble.style.cursor = "pointer"
    bubble.style.fontSize = "22px"
    bubble.style.boxShadow = "0 10px 25px rgba(0,0,0,0.25)"

    buttonWrapper.appendChild(bubble)

    /* BOT NAME UNDER ICON */

    const nameLabel = document.createElement("div")
    nameLabel.innerText = botName

    nameLabel.style.marginTop = "6px"
    nameLabel.style.fontSize = "12px"
    nameLabel.style.fontFamily = "Inter"
    nameLabel.style.color = "#333"

    buttonWrapper.appendChild(nameLabel)

    /* CHAT WINDOW */

    const chat = document.createElement("div")

    chat.style.position = "fixed"
    chat.style.bottom = "100px"
    chat.style.right = "20px"
    chat.style.width = "340px"
    chat.style.height = "480px"
    chat.style.background = "#fff"
    chat.style.borderRadius = "14px"
    chat.style.boxShadow = "0 20px 60px rgba(0,0,0,0.25)"
    chat.style.display = "none"
    chat.style.flexDirection = "column"
    chat.style.fontFamily = "Inter"
    chat.style.overflow = "hidden"

    chat.innerHTML = `

<div style="
background:#000;
color:#fff;
padding:14px;
font-weight:600;
font-size:14px;
">
${botName}
</div>

<div id="messages" style="
flex:1;
padding:12px;
overflow-y:auto;
background:#f6f6f6;
display:flex;
flex-direction:column;
gap:6px;
"></div>

<div style="
display:flex;
padding:10px;
border-top:1px solid #eee;
background:#fff;
">

<input id="msgInput"
placeholder="Type message..."
style="
flex:1;
border:1px solid #ddd;
border-radius:8px;
padding:8px;
font-size:13px;
outline:none;
">

<button id="sendBtn"
style="
margin-left:8px;
background:#000;
color:#fff;
border:none;
padding:8px 14px;
border-radius:8px;
cursor:pointer;
font-size:13px;
">
Send
</button>

</div>
`

    document.body.appendChild(chat)

    /* OPEN / CLOSE CHAT */

    bubble.onclick = () => {

        chat.style.display =
            chat.style.display === "none" ? "flex" : "none"

    }

    /* MESSAGE HELPERS */

    function addUserMessage(text) {

        const messages = document.getElementById("messages")

        const row = document.createElement("div")
        row.style.display = "flex"
        row.style.justifyContent = "flex-end"

        const bubble = document.createElement("div")
        bubble.innerText = text

        bubble.style.background = "#e9e9e9"
        bubble.style.padding = "8px 12px"
        bubble.style.borderRadius = "12px"
        bubble.style.fontSize = "13px"
        bubble.style.maxWidth = "70%"
        bubble.style.wordWrap = "break-word"

        row.appendChild(bubble)
        messages.appendChild(row)

        messages.scrollTop = messages.scrollHeight

    }

    function addBotMessage(text) {

        const messages = document.getElementById("messages")

        const row = document.createElement("div")
        row.style.display = "flex"
        row.style.justifyContent = "flex-start"

        const bubble = document.createElement("div")
        bubble.innerText = text

        bubble.style.background = "#dff6e4"
        bubble.style.padding = "8px 12px"
        bubble.style.borderRadius = "12px"
        bubble.style.fontSize = "13px"
        bubble.style.maxWidth = "70%"
        bubble.style.wordWrap = "break-word"

        row.appendChild(bubble)
        messages.appendChild(row)

        messages.scrollTop = messages.scrollHeight

    }

    /* SEND MESSAGE */

    document.addEventListener("click", async function (e) {

        if (e.target.id === "sendBtn") {

            const input = document.getElementById("msgInput")
            const message = input.value.trim()

            if (!message) return

            input.value = ""

            addUserMessage(message)

            /* TYPING INDICATOR */

            const messages = document.getElementById("messages")

            const typing = document.createElement("div")
            typing.innerText = "Typing..."
            typing.style.fontSize = "12px"
            typing.style.color = "#777"

            messages.appendChild(typing)

            messages.scrollTop = messages.scrollHeight

            try {

                const res = await fetch("https://neuroassist-xw90.onrender.com/chat", {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        botId,
                        message
                    })

                })

                const data = await res.json()

                typing.remove()

                addBotMessage(data.reply)

            } catch (err) {

                typing.remove()

                addBotMessage("Server error. Please try again.")

            }

        }

    })

})()