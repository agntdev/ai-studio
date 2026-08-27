# AI Studio Lead Collector — Bot specification

**Archetype:** commerce

**Voice:** modern and confident — write every user-facing message, button label, error, and empty state in this voice.

Telegram bot for collecting AI content service leads (AI photos, videos, advertising) and forwarding them to an admin. Focuses on lead capture, service selection, and admin notifications.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- small businesses
- marketers
- brands
- entrepreneurs

## Success criteria

- Leads collected and sent to admin chat
- Admin receives complete application data with files

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with service options
- **📸 AI‑фото** (button, actor: user, callback: service:photo) — Show AI photo service description and lead form
- **🎬 AI‑видео** (button, actor: user, callback: service:video) — Show AI video service description and lead form
- **📢 Реклама для брендов** (button, actor: user, callback: service:advertising) — Show advertising service description and lead form
- **💰 Прайс** (button, actor: user, callback: price_list) — Display service pricing list
- **📝 Оставить заявку** (button, actor: user, callback: lead:start) — Start lead submission flow
- **📞 Связаться** (button, actor: user, callback: contact_info) — Show business contacts and working hours

## Flows

### Service Selection
_Trigger:_ button:service:*

1. Show service description with call-to-action buttons
2. Offer 'Оставить заявку' or 'Назад в меню'

_Data touched:_ Service

### Lead Submission
_Trigger:_ button:lead:start

1. Ask for service type (buttons + free text option)
2. Request task description (text input)
3. Ask for materials (file attachments or 'Нет')
4. Collect contact info (free text field)
5. Confirm submission and send to admin

_Data touched:_ Application

### Admin Notification
_Trigger:_ lead_submission_complete

1. Format application data with files
2. Send to ADMIN_CHAT_ID with status tracking

_Data touched:_ Application

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat ID where lead notifications are sent
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **Service** _(retention: persistent)_ — Available AI content services with descriptions
  - fields: name, description, price_range
- **Application** _(retention: persistent)_ — Client lead with service request and contact info
  - fields: service_type, task_description, materials, contact_info, status
- **Admin** _(retention: persistent)_ — Administrator receiving lead notifications
  - fields: chat_id

## Integrations

- **Telegram** (required) — Bot API messaging and file handling
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Edit price list entries
- View application status history
- Change application statuses (new/processing/completed)

## Notifications

- Lead submission confirmation to user
- Admin notification with full application data and files

## Permissions & privacy

- Stores application data until admin marks as processed
- Handles file metadata but does not process file contents
- Contact info stored as-is without validation

## Edge cases

- User sends unsupported file types
- Multiple file attachments in one message
- Incomplete lead submissions
- Admin chat ID not configured

## Required tests

- End-to-end lead submission flow with file attachments
- Admin notification delivery with all application data
- Status tracking visibility for owner

## Assumptions

- Price list can be edited by owner post-deployment
- Admin will manually handle status updates
- All file handling is done through Telegram's API
