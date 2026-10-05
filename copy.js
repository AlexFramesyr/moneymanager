/*
 * Money Buddy – ALL words and pictures shown in the app.
 *
 * To change wording: edit the text in quotes below, save, and reload.
 * Keep each sentence short (3–6 words) and use easy words.
 * Words in {curly braces} are filled in by the app – keep them as they are.
 *
 * After editing, you can refresh COPY.md by running:  node tools/make-copy-md.js
 */
(function (root, factory) {
  var copy = factory();
  if (typeof module === 'object' && module.exports) module.exports = copy;
  else root.MB_COPY = copy;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var sections = [
    {
      name: 'Everywhere',
      items: {
        appName: 'Money Buddy',
        readToMe: 'Read to me',
        stopReading: 'Stop',
        next: 'Next',
        back: 'Back',
        goHome: 'Go home',
        typeNumber: 'Type a number.',
        typeNumberOrZero: 'Type a number. Type 0 if none.',
        noSaveWarning: 'This phone may not save. Ask for help.'
      }
    },
    {
      name: 'Money sources',
      items: {
        bankName: 'Bank money',
        cuseName: "'Cuse Cash",
        bankLower: 'bank money',
        cuseLower: "'Cuse Cash"
      }
    },
    {
      name: 'Keypad (heard by screen readers)',
      items: {
        keypadLabel: 'Number keys',
        keyPoint: 'point',
        keyDelete: 'Delete',
        keypadEmpty: 'No number.',
        keypadSays: '{key}. {amount}.',
        amountLabel: 'Amount: {amount}'
      }
    },
    {
      name: 'Setup',
      items: {
        stepOf: 'Step {n} of {total}',
        welcomeTitle: 'Hi!',
        welcomeText: "Let's make your money plan.",
        start: 'Start',
        bankTitle: 'How much money is in your bank?',
        cuseTitle: "How much 'Cuse Cash do you have?",
        saveBankTitle: 'How much bank money to save?',
        saveCuseTitle: "How much 'Cuse Cash to save?",
        saveHint: 'This is money you save.',
        saveHint2: 'Do not spend it.',
        youHave: 'You have {amount}.',
        saveTooMuch: 'That is more than you have. Try a smaller number.',
        bigTitle: 'What big things will you buy this month?',
        bigLastMonth: 'Last month you had:',
        bigKeep: 'Keep',
        bigKeepLabel: 'Keep {name}, {amount}',
        bigYours: 'Your big things:',
        bigAdd: 'Tap a picture to add one.',
        bigRemove: 'Remove',
        bigRemoveLabel: 'Remove {name}, {amount}',
        bigDone: "I'm done",
        bigHowMuch: 'How much is it?',
        bigWhich: "Bank or 'Cuse Cash?",
        otherPickTitle: 'Pick a picture.',
        otherNameTitle: 'What is it called?',
        otherNameHint: 'You can skip this.',
        otherNameLabel: 'Name',
        planShortTitle: 'Uh oh.',
        planShortText: 'You do not have enough {source} for all of this.',
        planShortNumbers: 'You need {need}. You have {have}.',
        changeIt: 'Change it',
        keepGoing: 'Keep going',
        summaryTitle: 'Your plan is ready!',
        rowHave: 'You have',
        rowSave: 'Save',
        rowSaveSub: 'For your goal and big things.',
        rowFree: 'Free to spend',
        goToMoney: 'Go to my money'
      }
    },
    {
      name: 'Big things (pictures to tap)',
      items: {
        tileConcert: 'Concert',
        tileLaundry: 'Laundry',
        tileGift: 'Birthday gift',
        tileFood: 'Food',
        tileBus: 'Bus',
        tileClothes: 'Clothes',
        tilePhone: 'Phone bill',
        tileOther: 'Other',
        otherIconGift: 'Gift',
        otherIconGame: 'Game',
        otherIconMovie: 'Movie',
        otherIconHair: 'Haircut',
        otherIconDoctor: 'Doctor',
        otherIconPet: 'Pet',
        otherIconSchool: 'School',
        otherIconHome: 'Home',
        otherIconCar: 'Ride',
        otherIconTrip: 'Trip',
        otherIconMusic: 'Music',
        otherIconStar: 'Star'
      }
    },
    {
      name: 'Home',
      items: {
        homeTitle: 'My money',
        daysLeft: '{n} days left this month',
        daysLeftOne: 'Last day of the month',
        freeToSpend: 'Free to spend',
        youHaveShort: 'You have {amount}',
        usedSave: 'You used {amount} of save money.',
        statusGreen: 'Doing great',
        statusYellow: 'Be careful',
        statusRed: 'Low',
        bigToPay: 'Big things to pay',
        paidIt: 'I paid it',
        paidItLabel: 'I paid it: {name}, {amount}',
        paidDone: 'Paid',
        buySomething: 'I want to buy something',
        gotMoney: 'I got money',
        whatIBought: 'What I bought',
        settings: 'Settings'
      }
    },
    {
      name: 'I paid it',
      items: {
        paidConfirmTitle: 'Did you pay for this?',
        yesPaid: 'Yes, I paid',
        noGoBack: 'No, go back',
        paidDoneTitle: 'Good job!',
        paidDoneText: 'It is paid.'
      }
    },
    {
      name: 'I want to buy something',
      items: {
        buyHowMuch: 'How much is it?',
        payWith: 'Pay with?',
        freeUnder: '{amount} free',
        payWithLabel: '{source}, {amount} free to spend',
        whatIsIt: 'What is it?',
        catFood: 'Food',
        catFun: 'Fun',
        catClothes: 'Clothes',
        catStuff: 'Stuff',
        catTravel: 'Travel',
        catOther: 'Other'
      }
    },
    {
      name: 'Alerts',
      items: {
        yellowTitle: 'Wait! Think first.',
        yellowText: 'This is a lot for now.',
        orangeTitle: 'Be careful!',
        orangeText: 'This is a lot of money.',
        orangeLeft: 'Then you will have {amount} left.',
        stopTitle: 'Stop!',
        stopText: 'This money is for your plans.',
        loseHeading: 'You will not have enough for:',
        loseSave: 'Your savings',
        notEnoughTitle: 'Not enough money',
        notEnoughText: 'You only have {amount}.',
        itemLine: '{thing}, {amount}, {source}',
        wait: 'I will wait',
        buyAnyway: 'Buy it anyway',
        sureTitle: 'Are you sure?',
        sureBig: 'Your {thing} money will go down.',
        sureSave: 'Your save money will go down.',
        sureNotEnough: 'Your money will go below zero.',
        noWait: 'No, wait',
        yesBuy: 'Yes, buy it'
      }
    },
    {
      name: 'After you choose',
      items: {
        greenTitle: 'Got it!',
        greenText: 'You bought {thing} for {amount}.',
        freeLeft: 'You have {amount} free to spend.',
        waitedTitle: 'Great choice!',
        waitedText: 'You saved {amount}.',
        boughtTitle: 'Okay. We wrote it down.'
      }
    },
    {
      name: 'I got money',
      items: {
        gotHowMuch: 'How much money did you get?',
        gotWhere: 'Where did it go?',
        gotHaveLabel: '{source}, you have {amount}',
        gotDoneTitle: 'Yay!',
        gotDoneText: 'Your money went up.',
        gotNow: 'You have {amount} now.'
      }
    },
    {
      name: 'What I bought',
      items: {
        listTitle: 'What I bought',
        waitedMany: 'You waited {n} times this month!',
        waitedOne: 'You waited 1 time this month!',
        waitedNone: 'Here is what you bought.',
        listEmpty: 'Nothing yet.',
        youWaited: 'You waited!',
        removeLabel: 'Remove {thing}, {amount}, {date}',
        removeTitle: 'Take this off the list?',
        yesRemove: 'Yes, take it off',
        noKeep: 'No, keep it',
        removedText: 'It is off the list.'
      }
    },
    {
      name: 'Settings',
      items: {
        settingsTitle: 'Settings',
        autoRead: 'Read alerts out loud',
        on: 'On',
        off: 'Off'
      }
    },
    {
      name: 'New month',
      items: {
        newMonthTitle: 'New month!',
        recapSaved: 'Last month you saved {amount}.',
        recapWaitedMany: 'You waited {n} times.',
        recapWaitedOne: 'You waited 1 time.',
        recapFresh: 'New month. New start!',
        makePlan: 'Make a new plan'
      }
    },
    {
      name: 'How words are said out loud',
      items: {
        sayCuse: 'Kyooz'
      }
    }
  ];

  /* Pictures. Change an emoji here to change it everywhere. */
  var icons = {
    read: '🔊', stop: '⏹️', next: '➡️', back: '⬅️', home: '🏠', start: '▶️',
    coin: '🪙', wave: '👋', bank: '🏦', cuse: '🍊', pig: '🐷', calendar: '📅',
    check: '✅', remove: '❌', plus: '➕', pencil: '✏️', warn: '⚠️', stopSign: '🛑',
    hand: '✋', star: '🌟', party: '🎉', note: '📝', cart: '🛒', cash: '💵',
    list: '📋', gear: '⚙️', moneyBag: '💰', smile: '😊', worried: '😟', sprout: '🌱',
    backspace: '⌫', dotGreen: '🟢', dotYellow: '🟡', dotRed: '🔴',
    // Big-thing tiles
    concert: '🎟️', laundry: '🧺', gift: '🎂', food: '🍕', bus: '🚌', clothes: '👕', phone: '📱', other: '➕',
    // "Other" picture choices
    oGift: '🎁', oGame: '🎮', oMovie: '🎬', oHair: '💇', oDoctor: '🏥', oPet: '🐶',
    oSchool: '🎓', oHome: '🏠', oCar: '🚗', oTrip: '✈️', oMusic: '🎵', oStar: '⭐',
    // Purchase categories
    catFood: '🍔', catFun: '🎉', catClothes: '👕', catStuff: '🧴', catTravel: '🚌', catOther: '➕'
  };

  return { sections: sections, icons: icons };
});
