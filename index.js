// =================================================================
// 🤖 Gemini AI Bot - بوت الذكاء الاصطناعي، توليد الصور، والإدارة الشاملة
// =================================================================

import { Client, GatewayIntentBits, Partials, EmbedBuilder, AttachmentBuilder, PermissionsBitField, ActivityType } from "discord.js";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import http from "http";

dotenv.config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!DISCORD_TOKEN || !GEMINI_API_KEY) {
  console.error("❌ خطأ: يرجى تحديد DISCORD_TOKEN و GEMINI_API_KEY");
  process.exit(1);
}

// إعداد عميل Google AI
const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: {
    headers: { "User-Agent": "aistudio-build" },
  },
});

const SYSTEM_PROMPT = `أنت مساعد ذكاء اصطناعي فائق الذكاء ومرح في سيرفر دسكورد، تتحدث باللغة العربية بطلاقة، وإجاباتك واضحة وموجزة ومفيدة مع استخدام الإيموجي المناسب.`;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// دالة توليد النصوص
async function generateAiReply(promptText, systemPrompt = SYSTEM_PROMPT) {
  const models = ["gemini-flash-latest", "gemini-3.8-flash", "gemini-3.1-flash-lite"];
  let lastErr = null;
  for (const m of models) {
    try {
      const res = await ai.models.generateContent({
        model: m,
        contents: promptText,
        config: { systemInstruction: systemPrompt },
      });
      if (res?.text) return res.text;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("فشل توليد النص.");
}

// دالة توليد الصور
async function generateAiImage(imagePrompt) {
  const response = await ai.models.generateImages({
    model: "imagen-3.0-generate-002",
    prompt: imagePrompt,
    config: {
      numberOfImages: 1,
      outputMimeType: "image/jpeg",
      aspectRatio: "1:1",
    },
  });

  const base64Bytes = response.generatedImages?.[0]?.image?.imageBytes;
  if (!base64Bytes) throw new Error("لم يتم إرجاع أي صورة.");
  return Buffer.from(base64Bytes, "base64");
}

client.once("ready", () => {
  console.log(`🚀 البوت متصل بنجاح كـ: ${client.user.tag}`);
  client.user.setActivity({
    name: "الذكاء الاصطناعي | !صورة | !تصفير",
    type: ActivityType.Playing,
  });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  const isMentioned = client.user && message.mentions.has(client.user);
  let cleanPrompt = content;
  if (isMentioned && client.user) {
    cleanPrompt = content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
  }

  // ===================== [ 1. الأوامر الإدارية ] =====================

  // أ) مسح الروم بالكامل (Nuke / تصفير الشات)
  if (content === "!تصفير" || content === "!nuke" || content === "!مسح الكل" || content === "!clear all") {
    // التحقق من صلاحية العضو
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels) && 
        !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("⛔ هذا الأمر مخصص للمشرفين فقط (يتطلب صلاحية إدارة القنوات Manage Channels)!");
    }

    try {
      const channel = message.channel;
      const position = channel.position;
      const waitMsg = await message.reply("💣 جاري تصفير الشات ومسح كافة الرسائل نهائياً...");

      // استنساخ الروم وحذف القديم لمسح كل الرسائل مهما كان عددها وتاريخها
      const newChannel = await channel.clone();
      await channel.delete();
      await newChannel.setPosition(position);

      const nukeEmbed = new EmbedBuilder()
        .setTitle("💥 تم تصفير الشات بنجاح!")
        .setDescription(`تم مسح كل رسائل الروم بواسطة المشرف: **${message.author.username}** 🧹`)
        .setColor(0xed4245)
        .setImage("https://media.giphy.com/media/oe33xf3B50fsc/giphy.gif")
        .setTimestamp();

      const sent = await newChannel.send({ embeds: [nukeEmbed] });
      setTimeout(() => sent.delete().catch(() => {}), 7000);
      return;
    } catch (err) {
      console.error(err);
      return message.channel.send("⚠️ حدث خطأ أثناء تصفير الشات. تأكد من إعطاء البوت صلاحية Manage Channels و Administrator!");
    }
  }

  // ب) مسح عدد محدد من الرسائل (!مسح [عدد])
  if (content.startsWith("!clear") || content.startsWith("!مسح")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply("⛔ تحتاج إلى صلاحية (Manage Messages) لاستخدام هذا الأمر!");
    }

    const parts = content.split(/\s+/);
    const count = Math.min(Math.max(parseInt(parts[1]) || 10, 1), 100);

    try {
      await message.channel.bulkDelete(count + 1, true);
      const notify = await message.channel.send(`🧹 تم مسح **${count}** رسالة بنجاح!`);
      setTimeout(() => notify.delete().catch(() => {}), 4000);
      return;
    } catch (delErr) {
      return message.reply("⚠️ لا يمكن مسح الرسائل الأقدم من 14 يوماً عبر الحذف السريع. استخدم `!تصفير` لتنظيف الروم بالكامل!");
    }
  }

  // ج) أمر الميوت السريع (!ميوت @عضو [دقائق])
  if (content.startsWith("!ميوت ") || content.startsWith("!mute ")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("⛔ تحتاج إلى صلاحية (Timeout Members)!");
    }
    const target = message.mentions.members.first();
    if (!target) return message.reply("⚠️ حدد العضو بالمنشن: `!ميوت @عضو 10`");

    const parts = content.split(/\s+/);
    const minutes = parseInt(parts[2]) || 10;
    try {
      await target.timeout(minutes * 60 * 1000, `طُلب بواسطة ${message.author.tag}`);
      return message.reply(`🔇 تم إسكات **${target.user.username}** لمدة ${minutes} دقيقة بنجاح!`);
    } catch {
      return message.reply("⚠️ لا أستطيع إسكات هذا العضو (قد تكون رتبته أعلى من رتبة البوت).");
    }
  }

  // ===================== [ 2. أمر توليد الصور ] =====================
  const isImageCmd = content.startsWith("!صورة ") || content.startsWith("!image ") ||
                     (isMentioned && (cleanPrompt.startsWith("ارسم ") || cleanPrompt.startsWith("ولد صورة ")));

  if (isImageCmd) {
    let imgPrompt = cleanPrompt;
    if (imgPrompt.startsWith("!صورة ")) imgPrompt = imgPrompt.slice(6).trim();
    else if (imgPrompt.startsWith("!image ")) imgPrompt = imgPrompt.slice(7).trim();
    else if (imgPrompt.startsWith("ارسم ")) imgPrompt = imgPrompt.slice(5).trim();
    else if (imgPrompt.startsWith("ولد صورة ")) imgPrompt = imgPrompt.slice(9).trim();

    if (!imgPrompt) {
      return message.reply("⚠️ اكتب وصف الصورة المطلوب، مثال:\n`!صورة فارس عربي في قلعة تاريخية وقت الغروب`");
    }

    const waitMsg = await message.reply("🎨 جاري رسم صورتك بأحدث نموذج ذكاء اصطناعي (Imagen 3)، لحظات...");
    try {
      await message.channel.sendTyping();
      const imgBuffer = await generateAiImage(imgPrompt);
      const attachment = new AttachmentBuilder(imgBuffer, { name: "ai_art.jpg" });

      const embed = new EmbedBuilder()
        .setTitle("🖼️ تم توليد الصورة بنجاح!")
        .setDescription(`**الوصف:** ${imgPrompt}`)
        .setImage("attachment://ai_art.jpg")
        .setColor(0x5865f2)
        .setFooter({ text: `طُلبت بواسطة ${message.author.username}` })
        .setTimestamp();

      await waitMsg.delete().catch(() => {});
      return message.reply({ embeds: [embed], files: [attachment] });
    } catch (err) {
      console.error(err);
      return waitMsg.edit("❌ تعذر توليد الصورة، تأكد من صحة المفتاح وأن الوصف ملائم.");
    }
  }

  // ===================== [ 3. التحدث والدردشة الذكية ] =====================
  const isPrefixAsk = content.startsWith("!ask ") || content.startsWith("!اسأل ");
  if (isMentioned || isPrefixAsk) {
    if (cleanPrompt.startsWith("!ask ")) cleanPrompt = cleanPrompt.slice(5).trim();
    if (cleanPrompt.startsWith("!اسأل ")) cleanPrompt = cleanPrompt.slice(6).trim();

    if (!cleanPrompt) {
      return message.reply("مرحباً بك! أنا في خدمتك: اسألني أي سؤال، أو استخدم `!صورة [الوصف]` لتوليد الصور، أو `!تصفير` لمسح الشات 🤖");
    }

    try {
      await message.channel.sendTyping();
      const answer = await generateAiReply(cleanPrompt, SYSTEM_PROMPT);

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
      await message.reply("⚠️ حدث خطأ أثناء معالجة السؤال، يرجى المحاولة لاحقاً.");
    }
  }
});

// خادم الـ Keep-Alive للبقاء متصلاً على Render
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("🤖 البوت يعمل بكفاءة 24/7 مع كافة صلاحيات الإدارة وتوليد الصور!");
}).listen(PORT, () => {
  console.log(`🌐 Server running on port: ${PORT}`);
});

client.login(DISCORD_TOKEN);
