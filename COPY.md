# Money Buddy – every word on screen

This file is made from `copy.js`. **To change wording, edit `copy.js`** (the words in quotes), then run
`node tools/make-copy-md.js` to refresh this list. If you cannot run that, editing `copy.js` alone is enough — the app reads its words from there.

- `{curly words}` are filled in by the app (like `{amount}` → `$20`). Keep them as they are.
- **Words** = words in the longest sentence. ⚠️ marks sentences over 6 words, so you can check reading level.
- Pictures (emojis) are listed at the bottom.

**8 lines** have a sentence longer than 6 words.

## Everywhere

| Key | Text | Words |
|---|---|---|
| `appName` | Money Buddy | 2 |
| `readToMe` | Read to me | 3 |
| `stopReading` | Stop | 1 |
| `next` | Next | 1 |
| `back` | Back | 1 |
| `goHome` | Go home | 2 |
| `typeNumber` | Type a number. | 3 |
| `typeNumberOrZero` | Type a number. Type 0 if none. | 4 |
| `noSaveWarning` | This phone may not save. Ask for help. | 5 |
| `save` | Save | 1 |
| `change` | Change | 1 |
| `yes` | Yes | 1 |
| `notYet` | Not yet | 2 |
| `testDay` | Test day: {date} | 3 |

## Money sources

| Key | Text | Words |
|---|---|---|
| `bankName` | Bank money | 2 |
| `cuseName` | 'Cuse Cash | 2 |
| `bankLower` | bank money | 2 |
| `cuseLower` | 'Cuse Cash | 2 |

## Keypad (heard by screen readers)

| Key | Text | Words |
|---|---|---|
| `keypadLabel` | Number keys | 2 |
| `keyPoint` | point | 1 |
| `keyDelete` | Delete | 1 |
| `keypadEmpty` | No number. | 2 |
| `keypadSays` | {key}. {amount}. | 1 |
| `amountLabel` | Amount: {amount} | 2 |

## Setup

| Key | Text | Words |
|---|---|---|
| `stepOf` | Step {n} of {total} | 4 |
| `welcomeTitle` | Hi! | 1 |
| `welcomeText` | Let's make your money plan. | 5 |
| `start` | Start | 1 |
| `bankTitle` | How much money is in your bank? | 7 ⚠️ |
| `cuseTitle` | How much 'Cuse Cash do you have? | 7 ⚠️ |
| `saveBankTitle` | How much bank money to save? | 6 |
| `saveCuseTitle` | How much 'Cuse Cash to save? | 6 |
| `saveHint` | This is money you save. | 5 |
| `saveHint2` | Do not spend it. | 4 |
| `youHave` | You have {amount}. | 3 |
| `saveTooMuch` | That is more than you have. Try a smaller number. | 6 |
| `bigTitle` | What big things will you buy this month? | 8 ⚠️ |
| `bigLastMonth` | Last month you had: | 4 |
| `bigKeep` | Keep | 1 |
| `bigKeepLabel` | Keep {name}, {amount} | 3 |
| `bigYours` | Your big things: | 3 |
| `bigAdd` | Tap a picture to add one. | 6 |
| `bigRemove` | Remove | 1 |
| `bigRemoveLabel` | Remove {name}, {amount} | 3 |
| `bigDone` | I'm done | 2 |
| `bigHowMuch` | How much is it? | 4 |
| `bigWhich` | Bank or 'Cuse Cash? | 4 |
| `bigDateTitle` | When will you buy it? | 5 |
| `dontKnow` | I don't know | 3 |
| `bigPickTitle` | What will you buy? | 4 |
| `otherPickTitle` | Pick a picture. | 3 |
| `otherNameTitle` | What is it called? | 4 |
| `otherNameHint` | You can skip this. | 4 |
| `otherNameLabel` | Name | 1 |
| `planShortTitle` | Uh oh. | 2 |
| `planShortText` | You do not have enough {source} for all of this. | 10 ⚠️ |
| `planShortNumbers` | You need {need}. You have {have}. | 3 |
| `changeIt` | Change it | 2 |
| `keepGoing` | Keep going | 2 |
| `summaryTitle` | Your plan is ready! | 4 |
| `rowHave` | You have | 2 |
| `rowSave` | Save | 1 |
| `rowSaveSub` | For your goal and big things. | 6 |
| `rowFree` | Free to spend | 3 |
| `goToMoney` | Go to my money | 4 |

## Big things (pictures to tap)

| Key | Text | Words |
|---|---|---|
| `tileConcert` | Concert | 1 |
| `tileLaundry` | Laundry | 1 |
| `tileGift` | Birthday gift | 2 |
| `tileFood` | Food | 1 |
| `tileBus` | Bus | 1 |
| `tileClothes` | Clothes | 1 |
| `tilePhone` | Phone bill | 2 |
| `tileOther` | Other | 1 |
| `otherIconGift` | Gift | 1 |
| `otherIconGame` | Game | 1 |
| `otherIconMovie` | Movie | 1 |
| `otherIconHair` | Haircut | 1 |
| `otherIconDoctor` | Doctor | 1 |
| `otherIconPet` | Pet | 1 |
| `otherIconSchool` | School | 1 |
| `otherIconHome` | Home | 1 |
| `otherIconCar` | Ride | 1 |
| `otherIconTrip` | Trip | 1 |
| `otherIconMusic` | Music | 1 |
| `otherIconStar` | Star | 1 |

## Home

| Key | Text | Words |
|---|---|---|
| `homeTitle` | My money | 2 |
| `daysLeft` | {n} days left this month | 5 |
| `daysLeftOne` | Last day of the month | 5 |
| `freeToSpend` | Free to spend | 3 |
| `youHaveShort` | You have {amount} | 3 |
| `usedSave` | You used {amount} of save money. | 6 |
| `statusGreen` | Doing great | 2 |
| `statusYellow` | Be careful | 2 |
| `statusRed` | Low | 1 |
| `bigToPay` | Big things to pay | 4 |
| `paidIt` | I paid it | 3 |
| `paidItLabel` | I paid it: {name}, {amount} | 5 |
| `paidDone` | Paid | 1 |
| `buySomething` | I want to buy something | 5 |
| `gotMoney` | I got money | 3 |
| `whatIBought` | What I bought | 3 |
| `settings` | Settings | 1 |
| `myCalendar` | My calendar | 2 |
| `fixMoney` | Fix my money | 3 |
| `fixMoneyLabel` | Fix my money: {source} | 4 |
| `changeGoal` | Change my save goal | 4 |
| `changeGoalLabel` | Change my save goal: {source} | 5 |

## Reminders (top of Home)

| Key | Text | Words |
|---|---|---|
| `remindToday` | Today: {thing}, {amount}. Did you pay it? | 4 |
| `remindPast` | Did you pay for {thing}? | 5 |
| `remindWasOn` | It was on {date}. | 4 |
| `remindSoon` | {thing} is in {n} days. | 5 |
| `remindTomorrow` | {thing} is tomorrow. | 3 |
| `remindYesLabel` | Yes, I paid {name} | 4 |
| `remindNotYetLabel` | Not yet, {name} | 3 |
| `notYetDone` | Okay. We will ask tomorrow. | 4 |

## Calendar

| Key | Text | Words |
|---|---|---|
| `calTitle` | My calendar | 2 |
| `calMonth` | Month | 1 |
| `calList` | List | 1 |
| `calViewLabel` | Show as | 2 |
| `calWeekdays` | Sun Mon Tue Wed Thu Fri Sat | 7 ⚠️ |
| `calToday` | Today | 1 |
| `calNothing` | Nothing planned | 2 |
| `calPast` | Past day | 2 |
| `calNoDay` | No day yet | 3 |
| `calListEmpty` | No days picked yet. | 4 |
| `dayNothing` | Nothing on this day. | 4 |
| `dayAdd` | Add a big spend on this day | 7 ⚠️ |

## Change a big thing

| Key | Text | Words |
|---|---|---|
| `bigEditTitle` | Change this big thing | 4 |
| `changeAmount` | Change amount | 2 |
| `changeDay` | Change day | 2 |
| `notPaidYet` | Not paid yet | 3 |
| `bigRemoveTitle` | Remove {thing}, {amount}? | 3 |
| `removeBigUp` | Your money will go back up. | 6 |
| `removeBigFree` | Your free money will go up. | 6 |

## Fix my money

| Key | Text | Words |
|---|---|---|
| `fixBankTitle` | How much money is really in your bank? | 8 ⚠️ |
| `fixCuseTitle` | How much 'Cuse Cash do you really have? | 8 ⚠️ |
| `fixAppSays` | The app says {amount}. | 4 |
| `fixSame` | Okay. Nothing changed. | 2 |
| `fixedTitle` | All fixed! | 2 |
| `goalDoneTitle` | Saved! | 1 |
| `goalDoneText` | You will save {amount}. | 4 |

## Undo

| Key | Text | Words |
|---|---|---|
| `undoButton` | Oops! Undo | 1 |
| `undoReady` | Made a mistake? Tap Undo. | 3 |
| `undoDone` | Okay. We undid it. | 3 |
| `undoBought` | You bought {thing}, {amount}. | 4 |
| `undoGot` | You got {amount}. | 3 |
| `undoPaid` | You paid {thing}. | 3 |
| `undoFixed` | You fixed your {source}. | 4 |
| `undoGoal` | You changed your save goal. | 5 |
| `undoRemoved` | You removed {thing}. | 3 |
| `undoChanged` | You changed {thing}. | 3 |
| `undoAdded` | You added {thing}. | 3 |
| `undoNotPaid` | {thing} is not paid. | 4 |

## I paid it

| Key | Text | Words |
|---|---|---|
| `paidConfirmTitle` | Did you pay for this? | 5 |
| `yesPaid` | Yes, I paid | 3 |
| `noGoBack` | No, go back | 3 |
| `paidDoneTitle` | Good job! | 2 |
| `paidDoneText` | It is paid. | 3 |

## I want to buy something

| Key | Text | Words |
|---|---|---|
| `buyHowMuch` | How much is it? | 4 |
| `payWith` | Pay with? | 2 |
| `freeUnder` | {amount} free | 2 |
| `payWithLabel` | {source}, {amount} free to spend | 5 |
| `whatIsIt` | What is it? | 3 |
| `catFood` | Food | 1 |
| `catFun` | Fun | 1 |
| `catClothes` | Clothes | 1 |
| `catStuff` | Stuff | 1 |
| `catTravel` | Travel | 1 |
| `catOther` | Other | 1 |

## Alerts

| Key | Text | Words |
|---|---|---|
| `yellowTitle` | Wait! Think first. | 2 |
| `yellowText` | This is a lot for now. | 6 |
| `orangeTitle` | Be careful! | 2 |
| `orangeText` | This is a lot of money. | 6 |
| `orangeLeft` | Then you will have {amount} left. | 6 |
| `stopTitle` | Stop! | 1 |
| `stopText` | This money is for your plans. | 6 |
| `loseHeading` | You will not have enough for: | 6 |
| `loseSave` | Your savings | 2 |
| `loseOnDay` | {name} on {date} | 3 |
| `notEnoughTitle` | Not enough money | 3 |
| `notEnoughText` | You only have {amount}. | 4 |
| `itemLine` | {thing}, {amount}, {source} | 3 |
| `wait` | I will wait | 3 |
| `buyAnyway` | Buy it anyway | 3 |
| `sureTitle` | Are you sure? | 3 |
| `sureBig` | Your {thing} money will go down. | 6 |
| `sureSave` | Your save money will go down. | 6 |
| `sureNotEnough` | Your money will go below zero. | 6 |
| `noWait` | No, wait | 2 |
| `yesBuy` | Yes, buy it | 3 |

## After you choose

| Key | Text | Words |
|---|---|---|
| `greenTitle` | Got it! | 2 |
| `greenText` | You bought {thing} for {amount}. | 5 |
| `freeLeft` | You have {amount} free to spend. | 6 |
| `waitedTitle` | Great choice! | 2 |
| `waitedText` | You saved {amount}. | 3 |
| `boughtTitle` | Okay. We wrote it down. | 4 |

## I got money

| Key | Text | Words |
|---|---|---|
| `gotHowMuch` | How much money did you get? | 6 |
| `gotWhere` | Where did it go? | 4 |
| `gotHaveLabel` | {source}, you have {amount} | 4 |
| `gotDoneTitle` | Yay! | 1 |
| `gotDoneText` | Your money went up. | 4 |
| `gotNow` | You have {amount} now. | 4 |

## What I bought

| Key | Text | Words |
|---|---|---|
| `listTitle` | What I bought | 3 |
| `waitedMany` | You waited {n} times this month! | 6 |
| `waitedOne` | You waited 1 time this month! | 6 |
| `waitedNone` | Here is what you bought. | 5 |
| `listEmpty` | Nothing yet. | 2 |
| `youWaited` | You waited! | 2 |
| `gotEntry` | You got money | 3 |
| `fixedBank` | You fixed your bank money | 5 |
| `fixedCuse` | You fixed your 'Cuse Cash | 5 |
| `plusWord` | plus | 1 |
| `removeLabel` | Remove {thing}, {amount}, {date} | 4 |
| `removeTitle` | Remove {amount} {thing}? | 3 |
| `removeGotTitle` | Remove {amount} you got? | 4 |
| `removeFixTitle` | Remove this fix of {amount}? | 5 |
| `removeUp` | Your money will go back up. | 6 |
| `removeDown` | Your money will go down. | 5 |
| `removeNone` | It will come off the list. | 6 |
| `yesRemove` | Yes, remove | 2 |
| `noKeep` | No, keep it | 3 |
| `removedText` | It is off the list. | 5 |

## Settings

| Key | Text | Words |
|---|---|---|
| `settingsTitle` | Settings | 1 |
| `autoRead` | Read alerts out loud | 4 |
| `on` | On | 1 |
| `off` | Off | 1 |

## New month

| Key | Text | Words |
|---|---|---|
| `newMonthTitle` | New month! | 2 |
| `recapSaved` | Last month you saved {amount}. | 5 |
| `recapWaitedMany` | You waited {n} times. | 4 |
| `recapWaitedOne` | You waited 1 time. | 4 |
| `recapFresh` | New month. New start! | 2 |
| `makePlan` | Make a new plan | 4 |

## How words are said out loud

| Key | Text | Words |
|---|---|---|
| `sayCuse` | Kyooz | 1 |

## Pictures

| Key | Picture |
|---|---|
| `read` | 🔊 |
| `stop` | ⏹️ |
| `next` | ➡️ |
| `back` | ⬅️ |
| `home` | 🏠 |
| `start` | ▶️ |
| `coin` | 🪙 |
| `wave` | 👋 |
| `bank` | 🏦 |
| `cuse` | 🍊 |
| `pig` | 🐷 |
| `calendar` | 📅 |
| `check` | ✅ |
| `remove` | ❌ |
| `plus` | ➕ |
| `pencil` | ✏️ |
| `warn` | ⚠️ |
| `stopSign` | 🛑 |
| `hand` | ✋ |
| `star` | 🌟 |
| `party` | 🎉 |
| `note` | 📝 |
| `cart` | 🛒 |
| `cash` | 💵 |
| `list` | 📋 |
| `gear` | ⚙️ |
| `moneyBag` | 💰 |
| `smile` | 😊 |
| `worried` | 😟 |
| `sprout` | 🌱 |
| `backspace` | ⌫ |
| `dotGreen` | 🟢 |
| `dotYellow` | 🟡 |
| `dotRed` | 🔴 |
| `undo` | ↩️ |
| `test` | 🧪 |
| `bell` | 🔔 |
| `later` | ⏳ |
| `concert` | 🎟️ |
| `laundry` | 🧺 |
| `gift` | 🎂 |
| `food` | 🍕 |
| `bus` | 🚌 |
| `clothes` | 👕 |
| `phone` | 📱 |
| `other` | ➕ |
| `oGift` | 🎁 |
| `oGame` | 🎮 |
| `oMovie` | 🎬 |
| `oHair` | 💇 |
| `oDoctor` | 🏥 |
| `oPet` | 🐶 |
| `oSchool` | 🎓 |
| `oHome` | 🏠 |
| `oCar` | 🚗 |
| `oTrip` | ✈️ |
| `oMusic` | 🎵 |
| `oStar` | ⭐ |
| `catFood` | 🍔 |
| `catFun` | 🎉 |
| `catClothes` | 👕 |
| `catStuff` | 🧴 |
| `catTravel` | 🚌 |
| `catOther` | ➕ |

## Spoken only

The 🔊 "Read to me" voice leaves out emojis. It says `sayCuse` in place of "'Cuse" so the word is said right.
Screen readers (VoiceOver, TalkBack) read the real words and use the labels marked "heard by screen readers".
