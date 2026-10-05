# Money Buddy 🪙

Money Buddy is a simple money app for students in Syracuse University's InclusiveU program.
It helps a student **stop and think before they buy something**, so they still have money for their big plans and their savings goal.

- It uses **big text, pictures, and short words**.
- It can **read the screen out loud** (🔊 Read to me).
- It **warns but never blocks**. The student always makes the final choice.
- It works **without internet** after the first visit.
- **No login and no accounts.** Everything is saved only on the student's phone. Nothing is sent anywhere.

---

## What the student does

1. **Make a plan (once a month).** The student enters how much money they have in their bank and on their 'Cuse Cash card, how much they want to save, and the big things they need to pay for this month (like a concert or laundry).
2. **Before buying something,** they tap **🛒 I want to buy something**, type the price, and pick a picture.
3. **The app checks the price.**
   - ✅ **Fine:** it is saved, and the student sees a happy message.
   - ⚠️ **Yellow "Think first"** or **orange "Be careful":** the price is a big part of their spending money.
   - 🛑 **Red "Stop!":** the purchase would use money set aside for a big thing or for savings. The app names what they would lose (for example, "🎟️ Concert").
4. The student taps **✋ I will wait** (and gets a 🌟) or **Buy it anyway**. Both choices are okay.

The warnings get stricter as the month goes on, because there is less time left to make the money last.

---

## Put it on the internet for free (GitHub Pages)

You only do this once. It takes about 15 minutes. You do not need to know how to code.

### 1. Make a GitHub account
Go to **[github.com](https://github.com)** and click **Sign up**. A free account is fine.

### 2. Make a new "repository" (a folder for the app)
1. Click the **+** button at the top right, then **New repository**.
2. For **Repository name**, type `money-buddy`.
3. Choose **Public**. (Free GitHub Pages needs this. Only the app's code is public. Student money data stays on their phones.)
4. Click **Create repository**.

### 3. Upload the app files
1. On the new page, click the link **uploading an existing file**.
2. Open the `money-buddy` folder on your computer. Select **everything inside it**: all the files *and* the `icons` and `docs` folders. Drag them into the browser window.
   *Tip: Chrome and Edge let you drag folders. If folders don't upload, upload the files first, then click **Add file → Upload files** again for the `icons` folder.*
3. Wait for the uploads to finish. Then click the green **Commit changes** button.

### 4. Turn on GitHub Pages
1. Click **Settings** (near the top of the repository page).
2. In the left menu, click **Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Set **Branch** to **main**, and the folder to **/ (root)**. Click **Save**.
5. Wait 1–2 minutes, then refresh the page. You will see: **"Your site is live at `https://YOUR-NAME.github.io/money-buddy/`"**.

That link is the app. Send it to students, or turn it into a QR code to print.

---

## Put it on a phone's Home Screen

Students should do this **before** making their plan. *(On iPhone, the Home Screen app keeps its own saved data, separate from Safari. A plan made in a Safari tab will not show up in the Home Screen app.)*

### iPhone (use **Safari**)

![iPhone steps: 1 Tap Share. 2 Tap Add to Home Screen. 3 Tap Add.](docs/iphone-steps.svg)

1. Open the app link in **Safari**.
2. Tap the **Share** button (a square with an arrow pointing up ⬆️).
   - On newer iPhones, you may need to tap **⋯** (three dots) at the bottom first, then **Share**.
3. Scroll down and tap **Add to Home Screen**. If you don't see it, tap **View More** or **Edit Actions**.
4. Tap **Add** at the top right.
5. Find the **smiling coin** 🪙 on the Home Screen and open Money Buddy from there.

### Android (use **Chrome**)

![Android steps: 1 Tap the three dots. 2 Tap Add to Home screen. 3 Tap Add.](docs/android-steps.svg)

1. Open the app link in **Chrome**.
2. Tap **⋮** (three dots) at the top right.
3. Tap **Add to Home screen**. (On some phones it says **Install app**.)
4. Tap **Add** (or **Install**).
5. Find the **smiling coin** 🪙 on the Home Screen and open Money Buddy from there.

---

## Good to know

| Question | Answer |
|---|---|
| **Where is the data saved?** | Only on that one phone, inside the app. It is never sent anywhere. |
| **Can it move to a new phone?** | No. On a new phone, the student makes a new plan. |
| **What erases the data?** | Deleting the app from the Home Screen, or clearing the browser's website data. |
| **Does it need internet?** | Only the first time. After that, it works offline. |
| **What happens on the 1st of the month?** | The app shows a short recap ("Last month you saved $X 🐷"), then starts a new plan. Last month's big things show up as ideas the student can tap to keep. |
| **The 🔊 button is missing.** | That phone or browser can't read out loud. Everything else still works. |
| **It reads alerts out loud by itself.** | That helps students who don't read well. To turn it off, go to **⚙️ Settings**. Students who use VoiceOver or TalkBack should turn it off, so two voices don't talk at once. |

---

## Changing the words

Every word the app shows is in **one file: `copy.js`**.

1. On GitHub, click `copy.js`, then click the ✏️ pencil icon.
2. Change only the words **inside the quotes**. Keep words in `{curly braces}` exactly as they are (the app fills them in, for example `{amount}` → `$20`).
3. Click **Commit changes**.
4. Follow **"After any change"** below.

**`COPY.md`** is an easy-to-read list of every phrase, with a word count to help keep the reading level low. Lines with a sentence over 6 words are marked ⚠️. If you have Node.js, run `node tools/make-copy-md.js` after editing to update the list.

You can change the emojis too. They are at the bottom of `copy.js`, under `icons`.

---

## After any change

Phones keep a saved copy of the app so it works offline. To make phones get your new version:

1. Open **`sw.js`** on GitHub and click ✏️.
2. Find this line near the top:
   ```js
   var CACHE = 'money-buddy-v1';
   ```
   Change the number: `v1` → `v2` (next time, `v3`, and so on).
3. Click **Commit changes**.

Students will get the new version the **second** time they open the app (the first open downloads it quietly).

---

## For developers

- Plain HTML, CSS, and JavaScript. No build step and no dependencies.
- `logic.js` holds all the budgeting math as pure functions. `app.js` holds the screens. `copy.js` holds the words. `storage.js` handles saving (`localStorage` key `moneyBuddy.v1`). `speech.js` handles reading out loud. `sw.js` handles offline use.
- **Tests:** `npm test` (or `node --test tests/logic.test.js`). Uses Node's built-in test runner, Node 18 or newer.
- **Run locally:** `python -m http.server 8000` in this folder, then open `http://localhost:8000`. (Opening `index.html` directly works too, but offline mode needs a web server.)
- **Icons:** `node tools/make-icons.js` redraws the PNG and SVG icons.
- If saved data is unreadable, the app starts a fresh plan and keeps a copy of the bad data under `moneyBuddy.v1.broken`.

### The alert rules

For each money source: **free money** = money you have − save goal − big things not yet paid.

| Day of month | Threshold |
|---|---|
| 1–7 | 50% |
| 8–14 | 40% |
| 15–21 | 20% |
| 22–end | 10% |

| Alert | When |
|---|---|
| 🛑 Not enough money | price > all the money in that source |
| 🛑 Stop! | price > free money (it would use big-thing or save money) |
| ⚠️ Be careful (orange) | price > 2 × threshold × free money |
| ⚠️ Think first (yellow) | price > threshold × free money |
| ✅ Fine | everything else |

In week 1 (50%), "2 × threshold" equals all of the free money, so the orange alert can't happen in week 1. That follows directly from the rules.
