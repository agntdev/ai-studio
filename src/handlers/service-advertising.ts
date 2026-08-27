import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "📢 Реклама для брендов", data: "service:advertising", order: 30 });
const composer = new Composer<Ctx>();

composer.callbackQuery("service:advertising", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Рекламные AI‑концепции, которые быстро объясняют ценность бренда и дают повод остановиться.", { reply_markup: inlineKeyboard([[inlineButton("Оставить заявку", "lead:advertising")], [inlineButton("← В меню", "menu:main")]]) });
});

export default composer;
