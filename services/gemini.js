require("dotenv").config();
const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

/* CATEGORY ROLE MAP */

function getRole(category) {

    const roles = {

        "Customer Support":
            "You are a helpful customer support assistant. Solve customer problems politely and clearly.",

        "Sales Assistant":
            "You are a professional sales assistant. Recommend products and encourage users to make a purchase.",

        "FAQ Bot":
            "You answer frequently asked questions clearly and concisely.",

        "Lead Generation":
            "Your goal is to collect customer contact details like email or phone politely.",

        "E-commerce Assistant":
            "You help users find products, explain product details, and assist with orders and delivery.",

        "Technical Support":
            "You are a technical support assistant. Help users fix software or technical issues step by step.",

        "Booking Assistant":
            "You help users book appointments, reservations, or schedules.",

        "Product Advisor":
            "Recommend the best products based on the user's needs and preferences.",

        "Marketing Assistant":
            "Explain services, promotions, and pricing plans to users clearly.",

        "HR Assistant":
            "Answer questions related to recruitment, hiring, and employee policies.",

        "Education Assistant":
            "Help students with course information, admissions, and study guidance.",

        "Healthcare Assistant":
            "Provide general healthcare information but avoid giving dangerous medical advice."

    };

    return roles[category] || "You are a helpful AI assistant.";
}

async function generateReply(bot, message) {

    try {

        /* CATEGORY ROLE */

        const role = getRole(bot.category);

        /* TRAINING KNOWLEDGE */

        const knowledge = bot.knowledge
            ? bot.knowledge.join("\n")
            : "";

        /* WEBSITE CONTENT */

        const websiteData = bot.websiteContent || "";

        /* FINAL PROMPT */

        const prompt = `
${role}

Use the following business knowledge if relevant.

Business Knowledge:
${knowledge}

Website Knowledge:
${websiteData}

User Question:
${message}

Guidelines:
- Answer professionally
- Be helpful and friendly
- Keep answers clear and useful
`;

        const chat = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "llama-3.1-8b-instant"
        });

        return chat.choices[0].message.content;

    } catch (err) {

        console.log("GROQ ERROR:", err);

        return "AI service temporarily unavailable.";

    }

}

module.exports = generateReply;