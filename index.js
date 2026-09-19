// =================================================================
// 🤖 Gemini AI Discord Bot - Discord AI Bot powered by Google Gemini (Node.js)
// Library: discord.js v14 & @google/genai SDK
// =================================================================

import { Client, GatewayIntentBits, Partials, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActivityType } from "discord.js";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLIENT_ID = process.env.CLIENT_ID; // Application ID from Discord Portal

if (!DISCORD_TOKEN || !GEMINI_API_KEY) {
  console.error("❌ خطأ: يرجى تحديد DISCORD_TOKEN و GEMINI_API_KEY في ملف .env أو في الكود مباشرة");
  process.exit(1);
}

// 1. إعداد عميل Google Gemini
const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const SYSTEM_PROMPT = `أنت مساعد ذكاء اصطناعي ودود وشامل في سيرفر دسكورد، تتحدث باللغة العربية الفصحى المبسطة أو الإنجليزية حسب سؤال العضو. استخدم إيموجيات دسكورد بتوازن، ونظم إجاباتك بنقاط واضحة ومختصرة.`;

// 2. إعداد عميل Discord مع الصلاحيات المطلوبة (Intents)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // ⚠️ هام: تأكد من تفعيل هذا الخيار في Discord Developer Portal
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// تعريف الأوامر السريعة (Slash Commands)
const commands = [
  new SlashCommandBuilder()
    .setName("ask")
    .setDescription("اسأل الذكاء الاصطناعي Gemini أي سؤال")
    .addStringOption(option =>
      option.setName("prompt")
        .setDescription("سؤالك أو طلبك")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("summarize")
    .setDescription("تلخيص نص طويل في نقاط سريعة")
    .addStringOption(option =>
      option.setName("text")
        .setDescription("النص المراد تلخيصه")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("معلومات عن البوت وقائمة الأوامر"),
].map(command => command.toJSON());

// تسجيل الأوامر عند تشغيل البوت
async function registerCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
    console.log("⏳ جاري تسجيل الأوامر السريعة (Slash Commands)...");
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log("✅ تم تسجيل الأوامر بنجاح!");
  } catch (error) {
    console.error("❌ فشل تسجيل الأوامر:", error);
  }
}

client.once("ready", async () => {
  console.log(`🚀 البوت متصل الآن بنجاح كـ: ${client.user.tag}`);
  client.user.setActivity({
    name: "Gemini AI | /ask",
    type: ActivityType.Playing,
  });

  if (CLIENT_ID) {
    await registerCommands();
  }
});

// 3. الاستجابة للأوامر السريعة (Slash Commands)
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "ask") {
    const userPrompt = interaction.options.getString("prompt");
    await interaction.deferReply(); // منح البوت وقتاً للتفكير والتوليد

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: userPrompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
        },
      });

      const replyText = response.text || "عذراً، لم أستطع توليد إجابة.";

      // إذا كان الرد طويلاً، نرسله كـ Embed أو مقطع
      if (replyText.length <= 2000) {
        await interaction.editReply(replyText);
      } else {
        const chunks = replyText.match(/[\s\S]{1,1900}/g) || [replyText];
        await interaction.editReply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp(chunks[i]);
        }
      }
    } catch (error) {
      console.error("Error generating content:", error);
      await interaction.editReply("❌ حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.");
    }
  }

  if (commandName === "summarize") {
    const textToSummarize = interaction.options.getString("text");
    await interaction.deferReply();

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `لخص النص التالي في 3 أو 4 نقاط واضحة:\n${textToSummarize}`,
        config: { systemInstruction: "أنت مساعد تلخيص محترف في دسكورد." }
      });

      const embed = new EmbedBuilder()
        .setTitle("📝 ملخص المحتوى بالذكاء الاصطناعي")
        .setDescription(response.text || "لا يوجد محتوى")
        .setColor(0x5865f2)
        .setFooter({ text: "مدعوم بواسطة Google Gemini" });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply("❌ تعذر التلخيص في الوقت الحالي.");
    }
  }

  if (commandName === "help") {
    const helpEmbed = new EmbedBuilder()
      .setTitle("🤖 أوامر بوت الذكاء الاصطناعي")
      .setDescription("مرحباً بك! أنا بوت ذكاء اصطناعي أعمل بنموذج Google Gemini.")
      .addFields(
        { name: "🔹 /ask [سؤالك]", value: "اطرح أي سؤال أو اطلب كتابة كود أو ترجمة.", inline: false },
        { name: "🔹 /summarize [النص]", value: "تلخيص فوري لأي مقال أو رسالة طويلة.", inline: false },
        { name: "🔹 الإشارة للبوت @Mention", value: "يمكنك منشن البوت في أي شات والتحدث معه مباشرة!", inline: false }
      )
      .setColor(0x5865f2)
      .setTimestamp();

    await interaction.reply({ embeds: [helpEmbed] });
  }
});

// 4. الاستجابة لمنشن البوت في الشات العادي
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // إذا تم عمل منشن للبوت
  if (client.user && message.mentions.has(client.user)) {
    const cleanPrompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
    if (!cleanPrompt) {
      await message.reply("مرحباً! كيف يمكنني مساعدتك اليوم؟ اسألني أي سؤال! 🤖");
      return;
    }

    try {
      await message.channel.sendTyping();

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: cleanPrompt,
        config: { systemInstruction: SYSTEM_PROMPT },
      });

      const answer = response.text || "عذراً، لم أستطع الإجابة.";

      if (answer.length <= 1950) {
        await message.reply(answer);
      } else {
        const chunks = answer.match(/[\s\S]{1,1900}/g) || [answer];
        await message.reply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await message.channel.send(chunks[i]);
        }
      }
    } catch (err) {
      console.error(err);
      await message.reply("⚠️ واجهت مشكلة في التفكير، حاول مرة أخرى لاحقاً!");
    }
  }
});

// خادم خفيف لإبقاء البوت متصلاً 24/7 على الاستضافات المجانية (Render / Koyeb / Railway)
import http from "http";
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("🤖 بوت دسكورد للذكاء الاصطناعي يعمل 24/7 بنجاح!");
}).listen(PORT, () => {
  console.log(`🌐 خادم Keep-Alive يعمل على المنفذ: ${PORT}`);
});

// تسجيل الدخول
client.login(DISCORD_TOKEN);
