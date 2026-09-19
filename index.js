// =================================================================
// 🤖 Gemini & AI Art Bot - النسخة النهائية المعتمدة
// =================================================================

import { Client, GatewayIntentBits, Partials, EmbedBuilder, AttachmentBuilder, PermissionsBitField, ActivityType } from "discord.js";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import http from "http";

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!DISCORD_TOKEN || !GEMINI_API_KEY) {
  console.error("❌ تأكد من توفر المفاتيح في Render");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: { headers: { "User-Agent": "aistudio-build" } },
});

const SYSTEM_PROMPT = `أنت مساعد ذكي ومرح في دسكورد، تتحدث باللغة العربية بأسلوب راقي ومختصر ومفيد، مع استخدام الإيموجي المناسب.`;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// دالة المحادثة النصية مع إعادة المحاولة التلقائية
async function generateAiReply(promptText) {
  const models = ["gemini-flash-latest", "gemini-3.8-flash"];
  let lastError = null;

  for (const modelName of models) {
    try {
      const res = await ai.models.generateContent({
        model: modelName,
        contents: promptText,
        config: { systemInstruction: SYSTEM_PROMPT },
      });
      if (res?.text) return res.text;
    } catch (err) {
      lastError = err;
      // إذا كان المفتاح مشغولاً (Rate limit 429)، ننتظر ثانية ونحاول مرة أخرى
      if (err?.message?.includes("429") || err?.status === "RESOURCE_EXHAUSTED") {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  throw lastError || new Error("المفتاح مشغول حالياً، يرجى الانتظار نصف دقيقة فقط.");
}

// دالة توليد الصور المضمونة 100% بدون أي أخطاء شبكة
async function getImageUrl(promptText) {
  const lower = promptText.toLowerCase();

  // تحسين ذكي ودقيق للزي السعودي والعربي
  let artPrompt = `cinematic 8k photorealistic portrait of ${promptText}, sharp focus, studio lighting`;
  if (lower.includes("شماغ") || lower.includes("ثوب") || lower.includes("سعودي")) {
    artPrompt = `cinematic photorealistic portrait of a young Saudi man wearing authentic traditional red and white shemagh, black agal, and white thobe, detailed face, elegant background, ultra 8k resolution, professional photography`;
  } else if (lower.includes("صقر") || lower.includes("falcon")) {
    artPrompt = `majestic majestic Arabian hunting falcon sitting on a desert perch, golden hour sunset, hyper-detailed feathers, 8k photography`;
  } else if (lower.includes("سيارة") || lower.includes("car")) {
    artPrompt = `supercar racing through Riyadh city at night, neon lights, 8k realistic automotive render`;
  }

  const encoded = encodeURIComponent(artPrompt);
  const randomSeed = Math.floor(Math.random() * 999999);
  // رابط صورة مباشر وسريع يدعمه دسكورد فوراً
  return `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${randomSeed}`;
}

client.once("ready", () => {
  console.log(`🚀 البوت يعمل بنجاح كـ: ${client.user.tag}`);
  client.user.setActivity({ name: "الذكاء وتوليد الصور | !صورة | !تصفير", type: ActivityType.Playing });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  const isMentioned = client.user && message.mentions.has(client.user);
  let clean = content;
  if (isMentioned && client.user) {
    clean = content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
  }

  // 1. أمر تصفير الشات بالكامل (!تصفير)
  if (content === "!تصفير" || content === "!nuke" || content === "!مسح الكل" || clean === "تصفير") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) && 
        !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("⛔ هذا الأمر للمشرفين فقط!");
    }
    try {
      const ch = message.channel;
      const pos = ch.position;
      const newCh = await ch.clone();
      await ch.delete();
      await newCh.setPosition(pos);

      const embed = new EmbedBuilder()
        .setTitle("💥 تم تصفير الشات بنجاح!")
        .setDescription(`تم تنظيف الروم بالكامل بواسطة المشرف: **${message.author.username}** 🧹`)
        .setColor(0xed4245)
        .setTimestamp();

      const sent = await newCh.send({ embeds: [embed] });
      setTimeout(() => sent.delete().catch(() => {}), 5000);
      return;
    } catch {
      return message.channel.send("⚠️ يحتاج البوت لرتبة تحتوي على صلاحية Administrator.");
    }
  }

  // 2. أمر مسح عدد معين من الرسائل (!مسح 20)
  if (content.startsWith("!clear") || content.startsWith("!مسح")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply("⛔ تحتاج لصلاحية (Manage Messages)!");
    }
    const count = Math.min(Math.max(parseInt(content.split(/\s+/)[1]) || 10, 1), 100);
    try {
      await message.channel.bulkDelete(count + 1, true);
      const m = await message.channel.send(`🧹 تم مسح **${count}** رسالة بنجاح!`);
      setTimeout(() => m.delete().catch(() => {}), 3000);
      return;
    } catch {
      return message.reply("⚠️ استخدم `!تصفير` لمسح الروم بالكامل دفعة واحدة.");
    }
  }

  // 3. كشف أي طلب لصورة (مباشر وسلس 100%)
  const lower = clean.toLowerCase();
  const isImageRequest = 
    content.startsWith("!صورة ") || content.startsWith("!image ") ||
    (isMentioned && (
      lower.includes("صوره") || lower.includes("صورة") || 
      lower.includes("ارسم") || lower.includes("رسم") || 
      lower.includes("شماغ") || lower.includes("تصميم")
    ));

  if (isImageRequest) {
    let imgPrompt = clean
      .replace(/^(!صورة|!image)\s*/i, "")
      .replace(/^(ابيك|ابي|ودي|ممكن|تكفى|بالله|لو سمحت)?\s*(تسوي|تصمم|ترسم|تولد|تعمل|تسويلي|تصمملي)?\s*(لي)?\s*(صوره|صورة)?\s*(لـ|عن|حق|توضح)?\s*/i, "")
      .trim();

    if (!imgPrompt) imgPrompt = "شخص لابس شماغ وثوب سعودي";

    const waitMsg = await message.reply("🎨 **أبشر! جاري رسم الصورة الآن بأعلى دقة، لحظات...** ⏳");

    try {
      await message.channel.sendTyping();
      const imageUrl = await getImageUrl(imgPrompt);

      const embed = new EmbedBuilder()
        .setTitle("🖼️ تفضل صورتك المطلوبة!")
        .setDescription(`**طلبك:** ${imgPrompt}\n**الجودة:** فوتوغرافية فائقة الدقة (Ultra-HD) ✨`)
        .setImage(imageUrl)
        .setColor(0x5865f2)
        .setFooter({ text: `طُلبت بواسطة ${message.author.username}` })
        .setTimestamp();

      await waitMsg.delete().catch(() => {});
      return message.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      return waitMsg.edit("❌ حدث خطأ، جرب كتابة: `!صورة شخص لابس شماغ`");
    }
  }

  // 4. الرد على الأسئلة والمحادثة الذكية
  if (isMentioned || content.startsWith("!ask ")) {
    if (clean.startsWith("!ask ")) clean = clean.slice(5).trim();
    if (!clean) return message.reply("أهلاً بك! اسألني أي سؤال أو اطلب صورة بالمنشن أو بالأمر: `!صورة [الوصف]` 🎨");

    try {
      await message.channel.sendTyping();
      const reply = await generateAiReply(clean);

      if (reply.length <= 1950) {
        await message.reply(reply);
      } else {
        const parts = reply.match(/[\s\S]{1,1900}/g) || [reply];
        await message.reply(parts[0]);
        for (let i = 1; i < parts.length; i++) await message.channel.send(parts[i]);
      }
    } catch (err) {
      console.error(err);
      if (err?.message?.includes("429") || err?.status === "RESOURCE_EXHAUSTED") {
        await message.reply("⏳ مفتاح Gemini مشغول بالأسئلة الآن، انتظر 30 ثانية واسألني مرة أخرى وسأجيبك فوراً!");
      } else {
        await message.reply("⚠️ واجهت مشكلة بسيطة في الاتصال، أعد السؤال بعد لحظات.");
      }
    }
  }
});

// خادم الـ Keep-Alive للبقاء متصلاً على Render 24/7
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("🤖 البوت يعمل بكفاءة 24/7!");
}).listen(PORT);

client.login(DISCORD_TOKEN);
