import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";

registerMainMenuItem({ label: "📞 Связаться", data: "contact_info", order: 60 });
const composer = new Composer<Ctx>();

composer.callbackQuery("contact_info", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText("Напишите нам прямо здесь — команда на связи ежедневно с 10:00 до 19:00 по Москве.", {
    reply_markup: inlineKeyboard([[inlineButton("← В меню", "menu:main")]]),
  });
});

export default composer;
