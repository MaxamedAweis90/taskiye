import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '../.env'), override: true });

const router = Router();

const TASKIYE_SYSTEM_PROMPT = `You are Taskiye AI Assistant (Kaaliyaha Taskiye), the intelligent, motivational productivity companion for Taskiye.
Taskiye is an all-in-one personal habit tracker, daily task organizer, and productivity gamification platform.

LANGUAGES & TONE:
- You have fluent, natural bilingual support in English and Somali (Af-Soomaali).
- Always detect the user's language and respond naturally in the same language (English or Somali).
- If the user greets in Somali (e.g., "Asc", "Sidee tahay", "I caawi", "Waa maxay Taskiye?"), reply warmly in Somali.
- If the user greets in English (e.g., "Hi", "Hello", "How does this work?"), reply in English.
- If the user asks in both or requests a specific language, respect their choice.
- Keep answers encouraging, structured, easy to read, and concise.

FORMATTING RULES:
- Never output markdown headers with hashes (like # or ###).
- Never output triple asterisks (***) or awkward standalone asterisks.
- Use clean bold headings and bullet points (- or 1., 2.).
- Always make answers clean, conversational, and highly readable.

STRICT SCOPE BOUNDARIES & OFF-TOPIC REFUSAL (CRITICAL):
- You are EXCLUSIVELY the personal productivity companion for the Taskiye app.
- You are NOT a general knowledge AI, search engine, Wikipedia, or political directory.
- You MUST strictly refuse to answer questions about politics, heads of state, government officials (e.g. presidents, prime ministers, elections), world news, celebrities, general trivia, movies, sports scores, or unrelated topics.
- If the user asks ANY question outside of Taskiye, habits, tasks, streaks, schedules, and personal productivity (such as "who is the president of Somalia", "what is the capital of...", "tell me about history", etc.):
  - In English, respond ONLY:
    "I am Taskiye AI, your dedicated productivity assistant. I can only help you organize your daily tasks, habits, streaks, and schedules on Taskiye. How can I help you organize your tasks or habits today?"
  - In Somali, respond ONLY:
    "Waxaan ahay Kaaliyaha Taskiye, waxaan kaa caawin karaa oo kaliya hawlahaaga maalinlaha ah, caadooyinkaaga, taxanahaaga, iyo jadwalkaaga Taskiye. Sideen maanta kaaga caawin karaa abaabulka hawlahaaga?"
- NEVER answer general knowledge questions, even if the user insists. Always steer them back to managing their habits and tasks on Taskiye.

TASKIYE PLATFORM KNOWLEDGE BASE:

1. DASHBOARD & CHECKLIST:
- Overview Metrics: Displays Total Items, Completed Count, Pending Tasks, and High Priority counts for today.
- Today's Checklist: Combines today's standalone tasks and scheduled habit instances in one unified workspace.
- Reordering: Users can drag-and-drop reorder checklist items, and the custom sequence persists across page reloads and syncs to the server.
- Activity Heatmap Matrix: Visualizes daily consistency and completion intensity over the calendar year like a GitHub contribution matrix.

2. TASKS (HAWLAHA):
- Chronological History: Tasks are organized into date-chunked sections: Tomorrow (Upcoming), Today (Active), Yesterday, and historical dates.
- Intra-Day Reordering: In Task History, items can be moved Up and Down strictly within their specific day section using chevron buttons. Tasks never cross day boundaries.
- Reschedule: Missed or upcoming tasks can be rescheduled easily to "Today", "Tomorrow", or a custom calendar date.
- Categories: Work, Health, Personal, Learning, Finance, Routine Activity, etc.
- Priority: Normal or High Priority.
- 30-Day Trash & Recovery: Deleted tasks and habits move to Trash where they are safely kept for 30 days before permanent cleanup. 1-click Undo and Restore is supported anytime.

3. HABITS (CAADOOCYINKA):
- Habit Creation: Add recurring habits with custom frequencies (Daily, or specific weekdays like Monday, Wednesday, Friday).
- Time of Day: Morning, Afternoon, Evening, or Anytime.
- Streaks (Taxanaha): Tracking consecutive completion days.
- Streak Freeze (Barafeynta Taxanaha): Each user gets 1 emergency streak freeze per month to protect their streak if they cannot complete a habit.
- Warning alerts before a streak is broken.

4. RANKING & SOCIAL (HEERKA & GUULAHA):
- Level & Tiers: Users advance ranks (Bronze, Silver, Gold, Platinum, Diamond, Master) by consistently completing daily tasks and sustaining habit streaks.
- Friends: Search users by username, send friend requests, accept requests, and compare streaks on the Leaderboard.
- LinkedIn & QR Card: Users can generate a stylish Taskiye profile card with a QR code to share on LinkedIn or social media.

5. ACCOUNTS, SYNC & GUEST MODE:
- Guest Mode: New visitors can use Taskiye immediately without logging in! Stores up to 30 tasks and habits locally in browser storage.
- Cloud Sync: Signing up (via Email/Password with verification or Google OAuth) automatically migrates all guest items to the cloud account.
- PWA & Notifications: Installable as a Progressive Web App (PWA) on iOS, Android, and Desktop, with smart push notification reminders for daily routines.

6. IN-APP NAVIGATION & CLICKABLE ROUTE LINKS (CRITICAL):
Whenever a user asks how to access something, where to find a page or feature, or you explain how a feature works in Taskiye, ALWAYS guide the user to that destination using clean markdown links so they can click and navigate there instantly:
- Habits & Streaks: [Go to Habits](/habits) (Somali: [Fur Bogga Caadooyinka](/habits))
- Task History & Upcoming tasks: [Go to Task History](/tasks) (Somali: [Fur Taariikhda Hawlaha](/tasks))
- Leaderboard & Ranks: [Go to Leaderboard & Ranks](/rank) (Somali: [Fur Leaderboard-ka](/rank))
- Dashboard & Checklist: [Go to Dashboard](/) (Somali: [Fur Bogga Hore](/)
- 30-Day Trash & Recovery: [Open Trash](/trash) (Somali: [Fur Qashinka](/trash))
Always explain clearly first, then provide the clickable route link naturally!

SOMALI VOCABULARY REFERENCE:
- Habits: Caadooyinka
- Daily Tasks: Hawlaha maalinlaha ah
- Streaks: Taxanaha / Xiriirka caadooyinka
- Streak Freeze: Barafeynta taxanaha (ilaalinta xiriirka)
- Ranking / Levels: Heerarka iyo Darajooyinka
- Trash: Qashinka (dib u soo celin 30 maalmood gudahood)
- Guest Mode: Habka martida (ilaa 30 shay oo bilaash ah)
- Dashboard: Bogga hore / Xarunta koontaroolka`;

// Rule-based responses for when GEMINI_API_KEY is unavailable
function getFallbackResponse(
  query: string,
  lang: 'en' | 'so',
  user?: { name?: string; email?: string; isGuest?: boolean }
): string {
  const q = query.toLowerCase().trim();
  const isSomali = lang === 'so' || /asc|salaam|sidee|waa maxay|caado|hawl|baraf|heer|asx|qashin/i.test(q);

  // Identity query: "Who am I?"
  if (
    /who\s+am\s+i|who\s+i\s+am|who\s+is\s+this|what(?:'s|\s+is)\s+my\s+name|my\s+name|my\s+profile|my\s+account|about\s+me|waa\s+kuma\s+anigu|yaan\s+ahay|magacayga|xogtayda/i.test(
      q
    )
  ) {
    const name = user?.name || (isSomali ? 'Marti (Guest)' : 'Guest');
    const isGuest = user?.isGuest ?? (!user?.email && !user?.name);
    if (isSomali) {
      return isGuest
        ? `**Xogtaada Taskiye (Habka Martida):**\n\nWaxaad hadda ku dhex jirtaa **Habka Martida (Guest Mode)**.\n- **Magaca:** Marti\n- **Kaydinta:** Browser-kaaga maxalliga ah (ilaa 30 shay)\n\nWaxaad abuuran kartaa akoon bilaash ah markasta si aad xogtaada ugu kaydiso daruuraha!`
        : `**Xogtaada Taskiye (Profile-kaaga):**\n\n- **Magaca:** **${name}**\n- **Email:** \`${user?.email || 'N/A'}\`\n- **Xaaladda:** Xubin Buuxda (Daruuriga ku xiran ⚡)\n\nSideen maanta kaaga caawin karaa hawlahaaga ama caadooyinkaaga?`;
    }
    return isGuest
      ? `**Your Taskiye Profile (Guest Mode):**\n\nYou are currently using Taskiye in **Guest Mode**.\n- **Name:** Guest\n- **Storage:** Local Browser Storage (up to 30 items)\n\nYou can sign up anytime for free to sync your tasks and habits across all your devices!`
      : `**Your Taskiye Profile:**\n\n- **Name:** **${name}**\n- **Email:** \`${user?.email || 'N/A'}\`\n- **Status:** Member (Cloud Synced ⚡)\n\nHow can I help you organize your tasks or habits today?`;
  }

  // Assistant query: "Who are you?"
  if (/who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|introduce\s+yourself|waa\s+kuma\s+adigu|yaad\s+tahay/i.test(q)) {
    return isSomali
      ? `**Kaaliyaha Taskiye AI** ⚡\n\nWaxaan ahay kaaliyahaaga garaadka macmalka ah ee Taskiye. Waxaan kaa caawinayaa abaabulka hawlahaaga, dhisidda caadooyinka, barafeynta taxanaha (streak freeze), iyo darajooyinka. Sideen maanta kuu caawin karaa?`
      : `**Taskiye AI Assistant** ⚡\n\nI am your personal AI productivity companion for Taskiye. I can help you create and organize daily tasks, build and freeze habit streaks, and track your leaderboard ranks. How can I help you today?`;
  }

  // Strict scope check for outside queries (e.g. presidents, ministers, politics, general trivia)
  const isOutOfScope =
    /president|madaxweyne|prime minister|ra'iisul|wasiir|minister|election|doorasho|football|soccer|kubad|capital|caasimad|weather|cimilada|who is|waa kuma|tell me a joke|homework|who won/i.test(
      q
    ) && !/taskiye|habit|task|caado|hawl/i.test(q);

  if (isOutOfScope) {
    return isSomali
      ? `Waxaan ahay Kaaliyaha Taskiye, waxaan kaa caawin karaa oo kaliya hawlahaaga maalinlaha ah, caadooyinkaaga, taxanahaaga, iyo jadwalkaaga Taskiye. Sideen maanta kaaga caawin karaa abaabulka hawlahaaga?`
      : `I am Taskiye AI, your dedicated productivity assistant. I can only help you organize your daily tasks, habits, streaks, and schedules on Taskiye. How can I help you organize your tasks or habits today?`;
  }

  if (isSomali) {
    // 1. Habits & Streaks
    if (/caado|habit|streak|taxane/i.test(q)) {
      return `**Caadooyinka & Taxanaha (Habits & Streaks):**\n\n- **Abuurista Caado:** Tag bogga *Habits* si aad u dhistid caado cusub (Maalinle ama maalmo gaar ah sida Isniin & Arbaco).\n- **Waqtiga:** Waxaad u qoondeyn kartaa Subax, Galab, Fiid, ama Waqti kasta.\n- **Barafeynta Taxanaha (Streak Freeze):** Waxaad haysataa 1 barafeyn bishiiba si aad u ilaaliso taxanahaaga haddii aad maalin seegto!\n\nMa jiraa wax kale oo aad rabto inaad ka ogaato caadooyinka?`;
    }

    // 2. Task Deletion / Removal
    if (/tirtir|masax|remove.*task|delete.*task|tir.*hawl/i.test(q)) {
      return `**Sida Loo Tirtiro Hawl (Delete Task):** 🗑️\n\n1. **Dashboard-ka:** Dul tag hawsha oo riix astaanta **Qashinka (🗑️)** si aad u tirtirto.\n2. **Taariikhda Hawlaha (Task History):** Riix astaanta qashinka ee ku taal safka hawsha si aad ugu wareejiso Qashin-qubka 30-ka maalmood (oo aad dib uga soo celin karto).\n3. **I weydii si toos ah:** Kaliya ii sheeg: *"tirtir hawsha [magaca hawsha]"* anigaa kaa tirtiraya!`;
    }

    // 3. Task Reordering
    if (/kala\s*hormar|kala\s*hagaaji|reorder|drag/i.test(q)) {
      return `**Kala Hormarinta Hawlaha:** ↕️\n\n- **Today's Checklist (Dashboard):** Jiid oo dhig (*Drag & Drop*) hawl kasta kor ama hoos si aad u habayso.\n- **Task History:** Isticmaal fallaadha **Kor (↑)** iyo **Hoos (↓)** si aad u kala hormariso hawlaha maalintaas.`;
    }

    // 4. Task Rescheduling
    if (/dib\s*u\s*ballan|dib\s*u\s*dhig|reschedule|u\s*wareeji/i.test(q)) {
      return `**Dib-u-ballanqaadka Hawlaha:** 📅\n\n- Riix badhanka **Reschedule** si aad hawsha ugu wareejiso **Maanta**, **Barri**, ama taariikh gaar ah.\n- Waxaad kaloo i dhihi kartaa: *"hawlaha u wareeji barri"* anigaana kuu qabanaya!`;
    }

    // 5. Creating Tasks
    if (/abuur.*hawl|sidee.*hawl.*loo.*abuur|samee.*hawl/i.test(q)) {
      return `**Abuurista Hawlaha Cusub:** ✍️\n\n- Riix badhanka **+ New Task** ee Dashboard-ka ama Task History.\n- Ama aniga ii sheeg tusaale:\n  • *"Abuur hawl diyaarinta warbixinta ee berri"*\n  • *"Abuur hawl jimicsi 10 Oct"*\n  Waxaan kuu diyaarin doonaa horudhac aad xaqiijiso intaanan abuurin!`;
    }

    // 6. General Tasks
    if (/hawl|checklist/i.test(q)) {
      return `**Maareynta Hawlahaaga Taskiye:** ⚡\n\n- **Abuur:** Ii sheeg *"abuur hawl [magaca]"* ama riix **+ New Task**.\n- **Dhameystir:** Riix goobada hawsha horteeda ku taal si aad u calaamadeyso inay dhammaatay.\n- **Tirtir:** Riix astaanta qashinka (🗑️) ama ii sheeg *"tirtir hawsha [magaca]"*.\n- **Taariikhda:** Booqo bogga **Task History** (/tasks) si aad u aragto hawlaha hore iyo kuwa soo socda.`;
    }

    if (/heer|rank|leaderboard|saaxiib|friend/i.test(q)) {
      return `**Heerarka & Asxaabta (Rank & Social):**\n\n- **Heerarka (Ranks):** Markasta oo aad dhameysid hawlo iyo caadooyin maalinle ah, waxaad kordhinaysaa darajadaada (Bronze ilaa Master).\n- **Asxaabta:** Waxaad ku dari kartaa asxaab adoo baadi-goobaya magacooda (username) ama scanning ku samaynaya QR Code-kooda LinkedIn.\n- **Hogaanka:** Arag halka aad kaga jirto tartanka asxaabtaada!`;
    }
    if (/marti|guest|kayd|sync/i.test(q)) {
      return `**Habka Martida & Kaydinta (Guest Mode & Sync):**\n\n- **Bilaa Akoon:** Waxaad Taskiye isticmaali kartaa bilaa akoon adoo kaydsanaya ilaa **30 hawlood & caadooyin** browser-kaaga.\n- **Isku-xirka Daruuriga (Cloud Sync):** Markaad is-diiwaangeliso (Email ama Google), dhammaan xogtaadii martida waxay si toos ah ugu wareegaysaa akoonkaaga cusub!`;
    }
    return `**Ku soo dhawoow Taskiye!** ⚡\n\nWaxaan ahay kaaliyahaaga garaadka macmalka ah (AI Assistant). Waxaan kaa caawin karaa:\n\n1. **Abuurista & Maareynta Hawlaha**\n2. **Dhisidda Caadooyinka & Streaks**\n3. **Fahamka Heerarka (Ranks) & Tartanka Asxaabta**\n4. **Ilaalinta taxanahaaga (Streak Freeze)**\n\nSideen maanta kuu caawin karaa?`;
  } else {
    // 1. Habits & Streaks
    if (/habit|streak|freeze/i.test(q)) {
      return `**Habits & Streaks in Taskiye:**\n\n- **Creating Habits:** Head to the *Habits* tab to set daily or recurring habits on specific weekdays.\n- **Time Tags:** Schedule for Morning, Afternoon, Evening, or Anytime.\n- **Streak Freeze:** You get 1 emergency freeze per month to save your streak if you miss a day.\n\nWould you like help setting up your first habit?`;
    }

    // 2. Task Deletion / Removal
    if (/remove.*task|delete.*task|trash.*task|clear.*task|how.*delete|how.*remove/i.test(q)) {
      return `**How to Delete or Remove a Task:** 🗑️\n\n1. **Dashboard Checklist:** Hover over or tap any task row and click the **Trash icon (🗑️)** to remove it.\n2. **Task History:** Click the **Trash icon (🗑️)** on any task row. Items move to the 30-Day Trash where you can restore them anytime.\n3. **Ask me directly:** You can also tell me: *"delete task [task name]"* and I will remove it for you!`;
    }

    // 3. Task Reordering
    if (/reorder|arrange|drag\s*(?:and|&)?\s*drop|move.*up|move.*down|order/i.test(q)) {
      return `**How to Reorder Tasks:** ↕️\n\n- **Today's Checklist (Dashboard):** Drag and drop any task row up or down to set your ideal flow. The sequence saves instantly.\n- **Task History:** Use the **Up (↑)** and **Down (↓)** arrows on any task row to organize tasks within that day.`;
    }

    // 4. Task Rescheduling
    if (/reschedule|postpone|delay|move.*to.*tomorrow|move.*date/i.test(q)) {
      return `**How to Reschedule a Task:** 📅\n\n- Click the **Reschedule** button on any missed or active task to quickly move it to **Today**, **Tomorrow**, or pick a **Specific Date**.\n- You can also ask me: *"reschedule remaining tasks to tomorrow"* and I will do it automatically!`;
    }

    // 5. Creating Tasks
    if (/how.*(?:create|add|make).*task|create.*task|add.*task|new.*task/i.test(q)) {
      return `**Creating Tasks with Taskiye:** ✍️\n\n- **Quick Add:** Click the **+ New Task** button on the Dashboard or in Task History.\n- **Via AI Chat:** Tell me what you want to achieve, like:\n  • *"Create task finish presentation for tomorrow"*\n  • *"Create task gym workout for 10 Oct"*\n  I will create a preview draft for you to confirm before scheduling!`;
    }

    // 6. General Tasks
    if (/task|checklist/i.test(q)) {
      return `**Managing Tasks in Taskiye:** ⚡\n\n- **Create:** Tell me *"create task [name] for [date]"* or click **+ New Task** on the Dashboard.\n- **Complete:** Click the circle next to any task to check it off and boost your daily progress.\n- **Delete:** Click the trash icon (🗑️) on any task or tell me *"delete [task name]"*.\n- **History:** Visit **Task History** (/tasks) to review past achievements and view upcoming scheduled tasks.`;
    }

    if (/rank|tier|level|friend|leaderboard/i.test(q)) {
      return `**Rankings & Social Features:**\n\n- **Tiers & Progression:** Complete daily tasks and build habit streaks to progress from Bronze to Master.\n- **Friends & Leaderboard:** Add friends by username or scan their custom QR profile card.\n- **LinkedIn Sharing:** Generate a branded Taskiye badge to share your achievements with your network.`;
    }
    if (/guest|limit|storage|sync/i.test(q)) {
      return `**Guest Mode & Cloud Sync:**\n\n- **Guest Access:** You can use Taskiye immediately with up to 30 locally saved items.\n- **Seamless Migration:** When you sign up with Google or Email, your guest tasks and habits automatically sync to your cloud account.`;
    }
    return `**Welcome to Taskiye!** ⚡\n\nI am your AI productivity assistant. I can help you with:\n\n1. **Creating & Managing Tasks**\n2. **Building & Freezing Habit Streaks**\n3. **Climbing the Leaderboard Ranks**\n4. **Guest Mode & Cloud Sync**\n\nHow can I help you today? Feel free to ask in English or Af-Soomaali!`;
  }
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      messages,
      language = 'en',
      stream = false,
      user,
    } = req.body as {
      messages?: Array<{ role: 'user' | 'model' | 'assistant'; content: string }>;
      language?: 'en' | 'so';
      stream?: boolean;
      user?: { name?: string; username?: string; email?: string; isGuest?: boolean };
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required',
      });
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    // If API key is available, call Google Gemini via @google/genai SDK
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        // Find the first user message index to ensure valid conversation structure for Gemini
        const firstUserIndex = messages.findIndex((m) => m.role === 'user');
        const validMessages = firstUserIndex >= 0 ? messages.slice(firstUserIndex) : [{ role: 'user' as const, content: lastUserMessage }];

        // Convert messages to GenAI contents format
        const contents = validMessages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : m.role,
          parts: [{ text: m.content }],
        }));

        // Prioritized list of active Google Gemini Flash models with available quota
        const CANDIDATE_MODELS = [
          'gemini-flash-lite-latest',
          'gemini-3.5-flash-lite',
          'gemini-3.7-flash',
          'gemini-3.6-flash',
        ];

        const userContext = user
          ? `\n\nCURRENT USER CONTEXT:\n- Name: ${user.name || 'User'}\n- Email: ${user.email || 'N/A'}\n- Account Type: ${user.isGuest ? 'Guest (Local storage session)' : 'Member (Cloud synced)'}\nIf the user asks who they are ("who am i", "my name", etc.), acknowledge them accurately with their name and status.`
          : '';
        const fullSystemInstruction = TASKIYE_SYSTEM_PROMPT + userContext;

        let activeStream = null;
        let activeText = '';

        for (const modelCandidate of CANDIDATE_MODELS) {
          try {
            if (stream) {
              const responseStream = await ai.models.generateContentStream({
                model: modelCandidate,
                contents,
                config: {
                  systemInstruction: fullSystemInstruction,
                  temperature: 0.7,
                },
              });
              activeStream = responseStream;
              break;
            } else {
              const response = await ai.models.generateContent({
                model: modelCandidate,
                contents,
                config: {
                  systemInstruction: fullSystemInstruction,
                  temperature: 0.7,
                },
              });
              if (response.text) {
                activeText = response.text;
                break;
              }
            }
          } catch (modelError: any) {
            console.warn(
              `[Gemini model ${modelCandidate} failed]:`,
              modelError?.status || modelError?.message?.slice(0, 100)
            );
            continue;
          }
        }

        if (activeStream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          for await (const chunk of activeStream) {
            const textChunk = chunk.text || '';
            if (textChunk) {
              res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
            }
          }

          res.write(`data: [DONE]\n\n`);
          return res.end();
        }

        if (activeText) {
          return res.status(200).json({
            success: true,
            data: {
              reply: activeText,
              role: 'model',
            },
          });
        }
      } catch (geminiError) {
        console.warn('[Gemini API Warning] Falling back to local intelligence:', geminiError);
        // Fallback gracefully below
      }
    }

    // Fallback response generator (works reliably with zero configuration)
    const fallbackText = getFallbackResponse(lastUserMessage, language, user);

    if (stream) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
      }

      // Simulate stream chunks for snappy UI typing animation
      const words = fallbackText.split(' ');
      for (let i = 0; i < words.length; i += 3) {
        const chunk = words.slice(i, i + 3).join(' ') + ' ';
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
        await new Promise((r) => setTimeout(r, 20));
      }
      res.write(`data: [DONE]\n\n`);
      return res.end();
    }

    return res.status(200).json({
      success: true,
      data: {
        reply: fallbackText,
        role: 'model',
      },
    });
  } catch (error) {
    console.error('[Chat Route Error]:', error);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while processing the chat message.',
    });
  }
});

export default router;
