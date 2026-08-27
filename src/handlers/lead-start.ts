import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { adminChatId, inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { now } from "../time.js";
import { saveApplication, type Application, type Material, type ServiceKey } from "../lead-data.js";

type FlowStep = "service" | "custom-service" | "task" | "materials" | "contact";
type LeadSession = { lead?: { step: FlowStep; service?: string; task?: string; materials: Material[] } };

registerMainMenuItem({ label: "📝 Оставить заявку", data: "lead:start", order: 50 });
const composer = new Composer<Ctx>();
const keyboard = (items: Array<[string, string]>) => inlineKeyboard(items.map(([text, data]) => [inlineButton(text, data)]));
const flow = (ctx: Ctx) => ctx.session as LeadSession;

function serviceName(key: ServiceKey): string {
  return ({ photo: "AI‑фото", video: "AI‑видео", advertising: "Реклама для брендов", custom: "Другая услуга" })[key];
}

async function chooseService(ctx: Ctx): Promise<void> {
  flow(ctx).lead = { step: "service", materials: [] };
  await ctx.reply("Что хотите создать?", { reply_markup: keyboard([["AI‑фото", "lead:service:photo"], ["AI‑видео", "lead:service:video"], ["Реклама для брендов", "lead:service:advertising"], ["Другая услуга", "lead:service:custom"], ["Отмена", "lead:cancel"]]) });
}

async function askTask(ctx: Ctx): Promise<void> {
  flow(ctx).lead!.step = "task";
  await ctx.reply("Расскажите о задаче: цель, формат и что важно для бренда.");
}

composer.callbackQuery("lead:start", async (ctx) => { await ctx.answerCallbackQuery(); await chooseService(ctx); });
for (const key of ["photo", "video", "advertising"] as const) {
  composer.callbackQuery(`lead:${key}`, async (ctx) => { await ctx.answerCallbackQuery(); flow(ctx).lead = { step: "task", service: serviceName(key), materials: [] }; await ctx.reply(`Берём ${serviceName(key)}. Расскажите о задаче: цель, формат и что важно для бренда.`); });
  composer.callbackQuery(`lead:service:${key}`, async (ctx) => { await ctx.answerCallbackQuery(); flow(ctx).lead!.service = serviceName(key); await askTask(ctx); });
}
composer.callbackQuery("lead:service:custom", async (ctx) => { await ctx.answerCallbackQuery(); flow(ctx).lead!.step = "custom-service"; await ctx.reply("Напишите, какая услуга вам нужна."); });
composer.callbackQuery("lead:materials:none", async (ctx) => { await ctx.answerCallbackQuery(); const lead = flow(ctx).lead; if (!lead || lead.step !== "materials") return; lead.step = "contact"; await ctx.reply("Как с вами связаться? Оставьте удобный контакт."); });
composer.callbackQuery("lead:materials:done", async (ctx) => { await ctx.answerCallbackQuery(); const lead = flow(ctx).lead; if (!lead || lead.step !== "materials") return; lead.step = "contact"; await ctx.reply("Как с вами связаться? Оставьте удобный контакт."); });
composer.callbackQuery("lead:cancel", async (ctx) => { await ctx.answerCallbackQuery(); delete flow(ctx).lead; await ctx.reply("Заявку не сохраняли. Когда будете готовы, начните снова из меню."); });

function materialFrom(ctx: Ctx): Material | undefined {
  const message = ctx.message;
  if (!message) return undefined;
  if (message.photo?.length) return { kind: "photo", fileId: message.photo[message.photo.length - 1].file_id };
  if (message.video) return { kind: "video", fileId: message.video.file_id, name: message.video.file_name, mimeType: message.video.mime_type };
  if (message.document) return { kind: "document", fileId: message.document.file_id, name: message.document.file_name, mimeType: message.document.mime_type };
  return undefined;
}

async function notifyAdmin(ctx: Ctx, admin: string, application: Application): Promise<boolean> {
  try {
    await ctx.api.sendMessage(admin, `Новая заявка\nУслуга: ${application.serviceType}\nЗадача: ${application.taskDescription}\nКонтакт: ${application.contactInfo}\nМатериалы: ${application.materials.length ? application.materials.length : "нет"}\nСтатус: новая`, { reply_markup: keyboard([["Открыть заявку", `app:view:${application.id}`]]) });
    for (const item of application.materials) {
      if (item.kind === "photo") await ctx.api.sendPhoto(admin, item.fileId);
      else if (item.kind === "video") await ctx.api.sendVideo(admin, item.fileId);
      else await ctx.api.sendDocument(admin, item.fileId);
    }
    return true;
  } catch { return false; }
}

composer.on("message", async (ctx, next) => {
  const lead = flow(ctx).lead;
  if (!lead) return next();
  const text = ctx.message.text?.trim();
  if (lead.step === "custom-service") {
    if (!text) return ctx.reply("Напишите название услуги текстом.");
    lead.service = text; await askTask(ctx); return;
  }
  if (lead.step === "task") {
    if (!text) return ctx.reply("Опишите задачу текстом, чтобы мы поняли ваш запрос.");
    lead.task = text; lead.step = "materials";
    await ctx.reply("Прикрепите фото, видео или документ. Если материалов нет, нажмите «Нет». Можно отправить несколько сообщений.", { reply_markup: keyboard([["Нет", "lead:materials:none"], ["Готово", "lead:materials:done"], ["Отмена", "lead:cancel"]]) }); return;
  }
  if (lead.step === "materials") {
    const material = materialFrom(ctx);
    if (material) { lead.materials.push(material); await ctx.reply("Материал добавлен. Прикрепите ещё или нажмите «Готово».", { reply_markup: keyboard([["Готово", "lead:materials:done"], ["Нет материалов", "lead:materials:none"]]) }); return; }
    if (text === "Нет") { lead.step = "contact"; await ctx.reply("Как с вами связаться? Оставьте удобный контакт."); return; }
    await ctx.reply("Подойдут фото, видео или документ. Прикрепите файл или нажмите «Готово»."); return;
  }
  if (lead.step === "contact") {
    if (!text) return ctx.reply("Оставьте контакт текстом — так команда сможет ответить.");
    const admin = adminChatId(ctx as never);
    if (!admin) { await ctx.reply("Заявки пока не подключены: владельцу нужно настроить чат для приёма заявок."); return; }
    const application: Application = { id: crypto.randomUUID(), serviceType: lead.service ?? "Не выбрано", taskDescription: lead.task ?? "Не указано", materials: lead.materials, contactInfo: text, status: "new", history: [{ status: "new", at: now() }] };
    try {
      if (!(await saveApplication(ctx, admin, application))) { await ctx.reply("Не удалось сохранить заявку. Попробуйте ещё раз чуть позже."); return; }
      const delivered = await notifyAdmin(ctx, admin, application);
      delete flow(ctx).lead;
      await ctx.reply(delivered ? "Заявка отправлена. Команда скоро свяжется с вами." : "Заявка сохранена, но уведомление команде пока не дошло. Попробуйте написать нам позже.");
    } catch { await ctx.reply("Не удалось отправить заявку. Попробуйте ещё раз чуть позже."); }
    return;
  }
  return next();
});

export default composer;
